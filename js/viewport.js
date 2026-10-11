// js/viewport.js - Pan, Zoom, Rotate, Coordinate Mapping, and Spring-Loaded Gestures

export class ViewportController {
  constructor(canvas, container = document.body) {
    this.canvas = canvas;
    this.container = container;

    // Fixed canvas logical dimensions (1600x1600 by default)
    this.canvasWidth = 1600;
    this.canvasHeight = 1600;

    // View transform state
    this.panX = 0;
    this.panY = 0;
    this.scale = 1.0;
    this.rotation = 0; // In radians

    // Spring-loaded key state
    this.keySpace = false;
    this.keyCtrl = false;
    this.keyR = false;

    // Mouse/stylus drag navigation state
    this.isNavDragging = false;
    this.navMode = null; // 'pan' | 'zoom' | 'rotate'
    this.dragStart = { x: 0, y: 0 };
    this.transformStart = { panX: 0, panY: 0, scale: 1, rotation: 0 };

    // Multi-touch 2-finger gesture state
    this.touchPointers = new Map();
    this.touchGestureActive = false;
    this.touchStartDist = 0;
    this.touchStartAngle = 0;
    this.touchStartMid = { x: 0, y: 0 };
    this.touchInitialTransform = { panX: 0, panY: 0, scale: 1, rotation: 0 };
    this.touchMaxTravel = 0;

    // Callbacks
    this.onTransformChange = null;

    this.initCanvasLayout();
    this.initKeyboardListeners();
    this.initWindowResize();
    this.resetView();
  }

  initCanvasLayout() {
    this.canvas.width = this.canvasWidth;
    this.canvas.height = this.canvasHeight;
    this.canvas.style.position = 'fixed';
    this.canvas.style.left = '50%';
    this.canvas.style.top = '50%';
    this.canvas.style.transformOrigin = 'center center';
    this.canvas.style.boxShadow = '0 8px 36px rgba(0, 0, 0, 0.16), 0 2px 8px rgba(0, 0, 0, 0.08)';
    this.applyTransform();
  }

  setCanvasSize(width, height) {
    this.canvasWidth = width;
    this.canvasHeight = height;
    this.canvas.width = width;
    this.canvas.height = height;
    this.resetView();
  }

  resetView() {
    this.panX = 0;
    this.panY = 0;
    this.rotation = 0;

    // Fit canvas comfortably into viewport (leave room for sidebar)
    const availW = window.innerWidth - 80;
    const availH = window.innerHeight - 40;
    const fitScale = Math.min(availW / this.canvasWidth, availH / this.canvasHeight) * 0.92;
    this.scale = Math.max(0.1, Math.min(fitScale, 1.5));

    this.applyTransform();
  }

  applyTransform() {
    const transformStr = `translate(-50%, -50%) translate(${this.panX.toFixed(2)}px, ${this.panY.toFixed(2)}px) rotate(${this.rotation.toFixed(4)}rad) scale(${this.scale.toFixed(4)})`;
    this.canvas.style.transform = transformStr;

    if (typeof this.onTransformChange === 'function') {
      this.onTransformChange({
        panX: this.panX,
        panY: this.panY,
        scale: this.scale,
        rotation: this.rotation
      });
    }
  }

  // Active navigation mode from spring-loaded keys
  getActiveSpringMode() {
    if (this.keyCtrl && this.keySpace) return 'zoom';
    if (this.keySpace) return 'pan';
    if (this.keyR) return 'rotate';
    return null;
  }

  // Convert Screen Coordinates (clientX, clientY) to Canvas UV [0, 1]
  screenToCanvasUv(clientX, clientY) {
    const centerX = window.innerWidth / 2 + this.panX;
    const centerY = window.innerHeight / 2 + this.panY;

    // Vector relative to canvas center on screen
    const dx = clientX - centerX;
    const dy = clientY - centerY;

    // Inverse rotation
    const cos = Math.cos(-this.rotation);
    const sin = Math.sin(-this.rotation);
    const unrotatedX = dx * cos - dy * sin;
    const unrotatedY = dx * sin + dy * cos;

    // Inverse scale
    const canvasPxX = unrotatedX / this.scale + this.canvasWidth / 2;
    const canvasPxY = unrotatedY / this.scale + this.canvasHeight / 2;

    // Normalized UV [0, 1], with v=0 at bottom, v=1 at top
    const u = canvasPxX / this.canvasWidth;
    const v = 1.0 - (canvasPxY / this.canvasHeight);
    const inside = u >= 0 && u <= 1 && v >= 0 && v <= 1;

    return { u, v, canvasPxX, canvasPxY, inside };
  }

  // Convert Canvas UV to Screen Coordinates (clientX, clientY)
  canvasUvToScreen(u, v) {
    const canvasPxX = u * this.canvasWidth;
    const canvasPxY = (1.0 - v) * this.canvasHeight;

    const unrotatedX = (canvasPxX - this.canvasWidth / 2) * this.scale;
    const unrotatedY = (canvasPxY - this.canvasHeight / 2) * this.scale;

    const cos = Math.cos(this.rotation);
    const sin = Math.sin(this.rotation);
    const dx = unrotatedX * cos - unrotatedY * sin;
    const dy = unrotatedX * sin + unrotatedY * cos;

    const centerX = window.innerWidth / 2 + this.panX;
    const centerY = window.innerHeight / 2 + this.panY;

    return {
      x: centerX + dx,
      y: centerY + dy
    };
  }

  // Begin Spring-Loaded Drag Navigation
  startNavDrag(clientX, clientY, mode) {
    this.isNavDragging = true;
    this.navMode = mode;
    this.dragStart = { x: clientX, y: clientY };
    this.transformStart = {
      panX: this.panX,
      panY: this.panY,
      scale: this.scale,
      rotation: this.rotation
    };
  }

  // Update Spring-Loaded Drag Navigation
  updateNavDrag(clientX, clientY) {
    if (!this.isNavDragging) return;

    const dx = clientX - this.dragStart.x;
    const dy = clientY - this.dragStart.y;

    if (this.navMode === 'pan') {
      this.panX = this.transformStart.panX + dx;
      this.panY = this.transformStart.panY + dy;
    } else if (this.navMode === 'zoom') {
      const zoomFactor = Math.exp(-dy * 0.008);
      this.scale = Math.max(0.08, Math.min(this.transformStart.scale * zoomFactor, 8.0));
    } else if (this.navMode === 'rotate') {
      const centerX = window.innerWidth / 2 + this.transformStart.panX;
      const centerY = window.innerHeight / 2 + this.transformStart.panY;
      const angleStart = Math.atan2(this.dragStart.y - centerY, this.dragStart.x - centerX);
      const angleCurrent = Math.atan2(clientY - centerY, clientX - centerX);
      this.rotation = this.transformStart.rotation + (angleCurrent - angleStart);
    }

    this.applyTransform();
  }

  endNavDrag() {
    this.isNavDragging = false;
    this.navMode = null;
  }

  // ---------------- Multi-Touch (2-Finger Gestures) ----------------
  addTouchPointer(id, clientX, clientY) {
    this.touchPointers.set(id, { x: clientX, y: clientY, startX: clientX, startY: clientY });
    if (this.touchPointers.size === 2) {
      const pts = Array.from(this.touchPointers.values());
      const p1 = pts[0], p2 = pts[1];
      this.touchGestureActive = true;
      this.touchStartDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      this.touchStartAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      this.touchStartMid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      this.touchInitialTransform = {
        panX: this.panX,
        panY: this.panY,
        scale: this.scale,
        rotation: this.rotation
      };
      this.touchMaxTravel = 0;
    }
  }

  updateTouchPointer(id, clientX, clientY) {
    if (!this.touchPointers.has(id)) return;
    const pt = this.touchPointers.get(id);
    const travel = Math.hypot(clientX - pt.startX, clientY - pt.startY);
    this.touchMaxTravel = Math.max(this.touchMaxTravel, travel);
    pt.x = clientX;
    pt.y = clientY;

    if (this.touchPointers.size === 2 && this.touchGestureActive) {
      const pts = Array.from(this.touchPointers.values());
      const p1 = pts[0], p2 = pts[1];

      // Pan midpoint
      const currentMid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      const panDx = currentMid.x - this.touchStartMid.x;
      const panDy = currentMid.y - this.touchStartMid.y;
      this.panX = this.touchInitialTransform.panX + panDx;
      this.panY = this.touchInitialTransform.panY + panDy;

      // Pinch zoom
      const currentDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      if (this.touchStartDist > 10) {
        const pinchScale = currentDist / this.touchStartDist;
        this.scale = Math.max(0.08, Math.min(this.touchInitialTransform.scale * pinchScale, 8.0));
      }

      // Two-finger rotate
      const currentAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      const angleDiff = currentAngle - this.touchStartAngle;
      this.rotation = this.touchInitialTransform.rotation + angleDiff;

      this.applyTransform();
    }
  }

  removeTouchPointer(id) {
    this.touchPointers.delete(id);
    if (this.touchPointers.size < 2) {
      const wasActive = this.touchGestureActive;
      const travel = this.touchMaxTravel;
      this.touchGestureActive = false;
      return { wasTwoFingerTap: wasActive && travel < 12 };
    }
    return { wasTwoFingerTap: false };
  }

  initKeyboardListeners() {
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.code === 'Space') {
        e.preventDefault();
        this.keySpace = true;
        this.updateCursorMode();
      }
      if (e.key === 'Control' || e.key === 'Meta') {
        this.keyCtrl = true;
        this.updateCursorMode();
      }
      if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        this.keyR = true;
        this.updateCursorMode();
      }
      // Reset view with '0'
      if (e.key === '0' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.resetView();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this.keySpace = false;
        if (this.isNavDragging && this.navMode === 'pan') this.endNavDrag();
        this.updateCursorMode();
      }
      if (e.key === 'Control' || e.key === 'Meta') {
        this.keyCtrl = false;
        if (this.isNavDragging && this.navMode === 'zoom') this.endNavDrag();
        this.updateCursorMode();
      }
      if (e.key.toLowerCase() === 'r') {
        this.keyR = false;
        if (this.isNavDragging && this.navMode === 'rotate') this.endNavDrag();
        this.updateCursorMode();
      }
    });

    window.addEventListener('blur', () => {
      this.keySpace = false;
      this.keyCtrl = false;
      this.keyR = false;
      this.endNavDrag();
      this.updateCursorMode();
    });
  }

  updateCursorMode() {
    const mode = this.getActiveSpringMode();
    const cursorEl = document.getElementById('cursor');
    if (!cursorEl) return;

    if (mode === 'pan') {
      document.body.style.cursor = 'grab';
      cursorEl.style.display = 'none';
    } else if (mode === 'zoom') {
      document.body.style.cursor = 'zoom-in';
      cursorEl.style.display = 'none';
    } else if (mode === 'rotate') {
      document.body.style.cursor = 'crosshair';
      cursorEl.style.display = 'none';
    } else {
      document.body.style.cursor = 'none';
      cursorEl.style.display = '';
    }
  }

  initWindowResize() {
    window.addEventListener('resize', () => {
      this.applyTransform();
    });
  }
}
