// js/app.js - Main Application Coordinator, Low-Latency Pipeline, & Viewport Integration

import { GLContext } from './gl-core.js';
import { FluidSimulation } from './fluid-sim.js';
import { BrushEngine, BRUSH_TYPES } from './brushes.js';
import { HistoryManager } from './history.js';
import { UIController } from './ui.js';
import { ViewportController } from './viewport.js';

export class InkwasherApp {
  constructor() {
    this.canvas = document.getElementById('c');
    this.cursorEl = document.getElementById('cursor');

    // Default 1600x1600 resolution
    this.canvas.width = 1600;
    this.canvas.height = 1600;

    // 1. Initialize Viewport & Camera Controller (Pan, Zoom, Rotate, Spring Keys)
    this.viewport = new ViewportController(this.canvas);

    // 2. Initialize WebGL2 Core with desynchronized: true (Hardware Unbuffered Pipeline)
    this.glCtx = new GLContext(this.canvas);

    // 3. Initialize Simulation Engine
    this.sim = new FluidSimulation(this.glCtx);

    // 4. Initialize Brushes
    this.brushes = new BrushEngine(this.sim);

    // 5. Initialize History Manager (Undo / Redo)
    this.history = new HistoryManager(this.glCtx, this.sim, 8);

    // 6. Initialize UI Controller
    this.ui = new UIController(this);

    // 7. Pointer & Stylus Tracking State
    this.pointerState = {
      down: false,
      tx: 0.5,
      ty: 0.5,
      bx: 0.5,
      by: 0.5,
      speed: 0,
      simPressure: 0.35,
      pressure: 0.35,
      hasForce: false,
      forceTime: 0,
      clientX: 0,
      clientY: 0,
      inWindow: false,
      barrel: false,
      pointerType: 'mouse',
      pointerId: null
    };

    this.stylusSeen = false;
    this.strokeCount = 0;

    // 8. Setup Event Listeners
    this.initPointerEvents();
    this.initWindowEvents();

    // 9. Start Main RAF Loop
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.loop.bind(this));
  }

  readPressure(e) {
    if (e.pointerType === 'touch') {
      this.pointerState.pressure = this.pointerState.simPressure;
      return;
    }
    if (e.pointerType === 'pen' || (e.pressure > 0 && Math.abs(e.pressure - 0.5) > 0.001)) {
      this.pointerState.pressure = e.pressure;
      this.pointerState.hasForce = true;
      this.pointerState.forceTime = performance.now();
    } else if (this.pointerState.hasForce && performance.now() - this.pointerState.forceTime < 3000) {
      // Retain last known force briefly
    } else {
      this.pointerState.pressure = this.pointerState.simPressure;
    }
  }

  pressureNow() {
    const ptr = this.pointerState;
    if (ptr.pointerType === 'touch') return ptr.simPressure;
    if (ptr.hasForce && performance.now() - ptr.forceTime < 3000) return ptr.pressure;
    return ptr.simPressure;
  }

  initPointerEvents() {
    const canvas = this.canvas;
    const windowTarget = window;

    // Pointer Down
    windowTarget.addEventListener('pointerdown', (e) => {
      // Ignore clicks on UI sidebar or modal dialogs
      if (e.target.closest('#sidebar') || e.target.closest('.modal-overlay')) {
        return;
      }

      // Check for Spring-Loaded navigation mode (Space = Pan, Ctrl+Space = Zoom, R = Rotate)
      const springMode = this.viewport.getActiveSpringMode();
      if (springMode) {
        e.preventDefault();
        this.viewport.startNavDrag(e.clientX, e.clientY, springMode);
        return;
      }

      // Handle touch input (Fingers are strictly for viewport navigation: pan/zoom/rotate)
      if (e.pointerType === 'touch') {
        e.preventDefault();
        this.viewport.addTouchPointer(e.pointerId, e.clientX, e.clientY);
        return; // NEVER draw with fingers! No water, no ink, nothing!
      }

      // Check for Spring-Loaded navigation mode (Space = Pan, Ctrl+Space = Zoom, R = Rotate)
      const springMode = this.viewport.getActiveSpringMode();
      if (springMode) {
        e.preventDefault();
        this.viewport.startNavDrag(e.clientX, e.clientY, springMode);
        return;
      }

      // Stylus or Mouse drawing: ignore extra pointers if already drawing with active pointer
      if (this.pointerState.down && e.pointerId !== this.pointerState.pointerId) {
        return;
      }

      const { u, v, inside } = this.viewport.screenToCanvasUv(e.clientX, e.clientY);
      if (!inside) {
        // Tapped outside paper
        return;
      }

      e.preventDefault();

      if (e.pointerType === 'pen') {
        this.stylusSeen = true;
      }

      // Record undo state before applying new stroke
      this.history.recordState();

      this.pointerState.pointerId = e.pointerId;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch (_) {}

      this.pointerState.down = true;
      this.pointerState.tx = u;
      this.pointerState.ty = v;
      this.pointerState.bx = u;
      this.pointerState.by = v;
      this.pointerState.speed = 0;
      this.pointerState.simPressure = 0.35;
      this.pointerState.pointerType = e.pointerType;
      this.pointerState.barrel = (e.buttons & 34) !== 0;
      this.pointerState.clientX = e.clientX;
      this.pointerState.clientY = e.clientY;
      this.pointerState.inWindow = true;

      this.readPressure(e);
      this.strokeCount++;

      const hint = document.getElementById('hint');
      if (hint) hint.classList.add('gone');

      // Immediate first splat for true unbuffered responsiveness
      const dt = 1 / 60;
      this.updatePhysicsStep(u, v, dt);
      this.sim.render();
    }, { passive: false });

    // Pointer Move (with coalesced events for zero-latency stylus dispatch)
    windowTarget.addEventListener('pointermove', (e) => {
      // Handle touch input (Fingers are strictly for viewport navigation: pan/zoom/rotate)
      if (e.pointerType === 'touch') {
        if (this.viewport.touchPointers.has(e.pointerId)) {
          e.preventDefault();
          this.viewport.updateTouchPointer(e.pointerId, e.clientX, e.clientY);
        }
        return; // NEVER draw with fingers!
      }

      // Spring-loaded navigation drag (Space / Ctrl / R with stylus or mouse)
      if (this.viewport.isNavDragging) {
        e.preventDefault();
        this.viewport.updateNavDrag(e.clientX, e.clientY);
        return;
      }

      if (this.pointerState.down && e.pointerId !== this.pointerState.pointerId) return;

      if (e.pointerType === 'pen') {
        this.stylusSeen = true;
      }

      this.pointerState.clientX = e.clientX;
      this.pointerState.clientY = e.clientY;
      this.pointerState.inWindow = true;

      if (!this.pointerState.down) {
        this.pointerState.pointerType = e.pointerType;
        return;
      }

      e.preventDefault();
      this.pointerState.barrel = (e.buttons & 34) !== 0;

      // Unbuffered hardware events: unpack high-frequency digitizer reports
      const events = (e.getCoalescedEvents && typeof e.getCoalescedEvents === 'function')
        ? e.getCoalescedEvents()
        : [e];

      const dt = Math.max(1 / 120, (1 / 60) / events.length);
      for (let i = 0; i < events.length; i++) {
        const evt = events[i];
        this.readPressure(evt);
        const { u, v } = this.viewport.screenToCanvasUv(evt.clientX, evt.clientY);
        this.updatePhysicsStep(u, v, dt);
      }

      // Direct-to-buffer low-latency render
      this.sim.render();
    }, { passive: false });

    // Pointer Up & Cancel
    const endPointer = (e) => {
      if (e && e.pointerType === 'touch') {
        const { wasTwoFingerTap } = this.viewport.removeTouchPointer(e.pointerId);
        if (wasTwoFingerTap) {
          if (this.history.undo()) {
            this.renderSingle();
            this.ui.showToast('Two-finger Tap: Undo');
          }
        }
        return;
      }

      if (this.viewport.isNavDragging) {
        this.viewport.endNavDrag();
      }

      if (e && e.pointerId !== undefined && e.pointerId !== this.pointerState.pointerId) return;

      this.pointerState.down = false;
      this.pointerState.barrel = false;
      this.pointerState.pointerId = null;
    };

    windowTarget.addEventListener('pointerup', endPointer);
    windowTarget.addEventListener('pointercancel', endPointer);
    windowTarget.addEventListener('blur', endPointer);

    windowTarget.addEventListener('pointerleave', () => {
      this.pointerState.inWindow = false;
    });

    windowTarget.addEventListener('contextmenu', e => e.preventDefault());
  }

  // Step physics and brush splats for a coordinate
  updatePhysicsStep(u, v, dt) {
    const ptr = this.pointerState;
    ptr.tx = u;
    ptr.ty = v;

    const k = 1.0 - Math.exp(-dt * 18);
    const px = ptr.bx;
    const py = ptr.by;
    ptr.bx += (ptr.tx - ptr.bx) * k;
    ptr.by += (ptr.ty - ptr.by) * k;

    const dx = ptr.bx - px;
    const dy = ptr.by - py;
    const dist = Math.hypot(dx, dy);
    const inst = dist / Math.max(dt, 1e-4);
    ptr.speed += (inst - ptr.speed) * (1.0 - Math.exp(-dt * 10));

    const targetP = Math.min(Math.max(1.18 - ptr.speed * 0.95, 0.12), 1.0);
    ptr.simPressure += (targetP - ptr.simPressure) * (1.0 - Math.exp(-dt * 6));

    if (!ptr.down) return;

    this.brushes.applyStroke({
      px, py,
      bx: ptr.bx,
      by: ptr.by,
      dx, dy, dist,
      pressure: this.pressureNow(),
      speed: ptr.speed,
      pointerType: ptr.pointerType
    }, dt, ptr.barrel);
  }

  initWindowEvents() {
    const isTouch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 1;
    if (isTouch) {
      document.body.classList.add('touch-device');
    }
  }

  updateCursor() {
    const ptr = this.pointerState;
    if (ptr.pointerType === 'touch' || this.viewport.getActiveSpringMode() || this.viewport.touchGestureActive) {
      this.cursorEl.style.opacity = '0';
      return;
    }
    if (!ptr.inWindow && !ptr.down) {
      this.cursorEl.style.opacity = '0';
      return;
    }

    this.cursorEl.style.opacity = '1';
    const isWater = (this.brushes.activeType === BRUSH_TYPES.WATER) ||
                    (ptr.barrel && this.brushes.activeType === BRUSH_TYPES.PEN);

    const pr = ptr.down ? this.pressureNow() : 0.3;
    const radius = isWater
      ? this.brushes.getBrushRadius(pr, ptr.down ? ptr.speed : 0)
      : this.brushes.getPenRadius(pr, 0);

    // Scale cursor preview with viewport zoom scale!
    const canvasH = this.viewport.canvasHeight;
    const d = Math.max(radius * 2 * canvasH * this.viewport.scale, 4);

    this.cursorEl.style.width = `${d}px`;
    this.cursorEl.style.height = `${d}px`;
    this.cursorEl.style.left = `${ptr.clientX}px`;
    this.cursorEl.style.top = `${ptr.clientY}px`;
    this.cursorEl.classList.toggle('brush-cursor', isWater);
    this.cursorEl.classList.toggle('white-cursor', this.brushes.isWhiteMode || this.brushes.activeType === BRUSH_TYPES.GOUACHE);
  }

  createNewCanvas(width, height) {
    this.viewport.setCanvasSize(width, height);
    this.sim.reinitTargets(width, height);
    this.history.reset();
    this.renderSingle();
  }

  exportPNG() {
    this.sim.render();
    this.canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      const timeStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      a.href = URL.createObjectURL(blob);
      a.download = `inkwasher-${timeStr}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      this.ui.showToast('Artwork exported as PNG!');
    }, 'image/png');
  }

  loop(now) {
    const dt = Math.min((now - this.lastTime) / 1000, 1 / 30) || 1 / 60;
    this.lastTime = now;

    // Simulation advection & drying
    this.sim.step(dt);
    this.sim.render();
    this.updateCursor();

    this.rafId = requestAnimationFrame(this.loop.bind(this));
  }

  renderSingle() {
    this.sim.render();
  }
}

// Bootstrap once DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  try {
    window.app = new InkwasherApp();
  } catch (err) {
    console.error('Failed to initialize Inkwasher:', err);
    document.body.innerHTML = `
      <div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;
                  font-family:sans-serif;color:#444;text-align:center;padding:20px;">
        <div>
          <h2 style="margin:0 0 10px;">WebGL2 Required</h2>
          <p style="margin:0;opacity:0.7;">${err.message || 'Unable to create WebGL2 context.'}</p>
        </div>
      </div>
    `;
  }
});
