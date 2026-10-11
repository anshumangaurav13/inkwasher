// js/ui.js - Left Sidebar Toolbar UI Controller & Interaction

import { BRUSH_TYPES, BRUSH_METADATA } from './brushes.js';

export class UIController {
  constructor(app) {
    this.app = app;
    this.sim = app.sim;
    this.brushes = app.brushes;
    this.history = app.history;

    this.sidebarEl = document.getElementById('sidebar');
    this.toggleBtn = document.getElementById('btnSidebarToggle');
    this.undoBtn = document.getElementById('btnUndo');
    this.redoBtn = document.getElementById('btnRedo');
    this.newBtn = document.getElementById('btnNew');
    this.fixBtn = document.getElementById('btnFix');
    this.clearBtn = document.getElementById('btnClear');
    this.exportBtn = document.getElementById('btnExport');
    this.saveBtn = document.getElementById('btnSave');
    this.resetViewBtn = document.getElementById('btnResetView');
    this.fullscreenBtn = document.getElementById('btnFullscreen');
    this.helpBtn = document.getElementById('btnHelp');

    this.newModal = document.getElementById('newCanvasModal');
    this.newCloseBtn = document.getElementById('btnNewClose');
    this.helpModal = document.getElementById('helpModal');
    this.helpCloseBtn = document.getElementById('btnHelpClose');
    this.toastEl = document.getElementById('toast');

    this.colorPicker = document.getElementById('inputColor');
    this.colorPreview = document.getElementById('colorPreview');
    this.btnWhiteMode = document.getElementById('btnWhiteMode');

    this.initBrushesUI();
    this.initSliders();
    this.initPalette();
    this.initActions();
    this.initHistoryObserver();
    this.initKeyboardShortcuts();
    this.initSidebarToggle();
  }

  showToast(msg) {
    if (!this.toastEl) return;
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('visible');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this.toastEl.classList.remove('visible');
    }, 1800);
  }

  initSidebarToggle() {
    if (!this.toggleBtn) return;
    this.toggleBtn.addEventListener('click', () => {
      this.sidebarEl.classList.toggle('collapsed');
      const isCollapsed = this.sidebarEl.classList.contains('collapsed');
      this.toggleBtn.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
      this.toggleBtn.setAttribute('title', isCollapsed ? 'Expand Toolbar' : 'Collapse Toolbar');
    });

    // Modals background click to dismiss
    [this.helpModal, this.newModal].forEach(modal => {
      if (modal) {
        modal.addEventListener('click', (e) => {
          if (e.target === modal) modal.classList.remove('open');
        });
      }
    });

    if (this.helpCloseBtn && this.helpModal) {
      this.helpCloseBtn.addEventListener('click', () => {
        this.helpModal.classList.remove('open');
      });
    }
    if (this.newCloseBtn && this.newModal) {
      this.newCloseBtn.addEventListener('click', () => {
        this.newModal.classList.remove('open');
      });
    }
  }

  initBrushesUI() {
    const list = document.getElementById('brushList');
    if (!list) return;

    list.innerHTML = '';
    Object.values(BRUSH_METADATA).forEach(meta => {
      const btn = document.createElement('button');
      btn.className = `tool-btn brush-btn ${meta.id === this.brushes.activeType ? 'active' : ''}`;
      btn.dataset.brushId = meta.id;
      btn.setAttribute('title', `${meta.name} — ${meta.desc}`);
      btn.innerHTML = `
        <span class="tool-icon">${meta.svgIcon}</span>
        <span class="tool-label">${meta.shortName}</span>
      `;

      btn.addEventListener('click', () => {
        this.selectBrush(meta.id);
      });
      list.appendChild(btn);
    });
  }

  selectBrush(brushId) {
    this.brushes.setBrushType(brushId);

    document.querySelectorAll('.brush-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.brushId === brushId);
    });

    if (this.btnWhiteMode) {
      this.btnWhiteMode.classList.toggle('active', this.brushes.isWhiteMode);
    }

    const meta = BRUSH_METADATA[brushId];
    if (meta) {
      this.showToast(`${meta.name} selected`);
    }
  }

  initPalette() {
    if (this.colorPreview && this.colorPicker) {
      this.colorPreview.addEventListener('click', () => {
        this.colorPicker.click();
      });
      this.colorPicker.addEventListener('input', (e) => {
        const hex = e.target.value;
        this.brushes.setColorHex(hex);
        this.colorPreview.style.backgroundColor = hex;
        this.brushes.isWhiteMode = false;
        if (this.btnWhiteMode) this.btnWhiteMode.classList.remove('active');
        this.updateBrushListStates();
      });
    }

    document.querySelectorAll('.swatch-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const hex = btn.dataset.color;
        if (hex === '#ffffff') {
          this.setWhiteMode(true);
        } else {
          this.brushes.setColorHex(hex);
          if (this.colorPicker) this.colorPicker.value = hex;
          if (this.colorPreview) this.colorPreview.style.backgroundColor = hex;
          this.setWhiteMode(false);
        }
        document.querySelectorAll('.swatch-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    if (this.btnWhiteMode) {
      this.btnWhiteMode.addEventListener('click', () => {
        this.setWhiteMode(!this.brushes.isWhiteMode);
      });
    }
  }

  setWhiteMode(val) {
    this.brushes.isWhiteMode = val;
    if (this.btnWhiteMode) {
      this.btnWhiteMode.classList.toggle('active', val);
    }
    if (val) {
      if (this.colorPreview) this.colorPreview.style.backgroundColor = '#ffffff';
      this.showToast('White gouache highlight enabled');
    } else {
      const hex = this.colorPicker ? this.colorPicker.value : '#16161e';
      if (this.colorPreview) this.colorPreview.style.backgroundColor = hex;
      this.brushes.setColorHex(hex);
      this.showToast('Color ink restored');
    }
  }

  updateBrushListStates() {
    document.querySelectorAll('.brush-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.brushId === this.brushes.activeType);
    });
  }

  initSliders() {
    const sliders = [
      { id: 'sSize', key: 'SIZE', format: v => `${Math.round(v * 100)}%` },
      { id: 'sFlow', key: 'FLOW', format: v => `${Math.round(v * 100)}%` },
      { id: 'sBleed', key: 'BLEED', format: v => `${Math.round(v * 100)}%` },
      { id: 'sDry', key: 'DRY', format: v => `${Math.round(v * 100)}%` },
      { id: 'sBink', key: 'BINK', format: v => `${Math.round(v * 100)}%` },
      { id: 'sColor', key: 'COLOR', format: v => `${Math.round(v * 100)}%` }
    ];

    sliders.forEach(({ id, key, format }) => {
      const el = document.getElementById(id);
      const valEl = document.getElementById(`${id}Val`);
      if (!el) return;

      el.value = this.sim.P[key];
      if (valEl) valEl.textContent = format(this.sim.P[key]);

      el.addEventListener('input', () => {
        const val = parseFloat(el.value);
        this.sim.P[key] = val;
        if (valEl) valEl.textContent = format(val);
        this.sim.wake(60);
        this.app.renderSingle();
      });
    });
  }

  initActions() {
    // New Canvas Modal
    if (this.newBtn && this.newModal) {
      this.newBtn.addEventListener('click', () => {
        this.newModal.classList.add('open');
      });
    }

    // Size preset selection inside New Canvas Modal
    document.querySelectorAll('.preset-size-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const w = parseInt(btn.dataset.w, 10);
        const h = parseInt(btn.dataset.h, 10);
        if (w && h) {
          this.app.createNewCanvas(w, h);
          this.newModal.classList.remove('open');
          this.showToast(`New Canvas: ${w} × ${h}`);
        }
      });
    });

    // Undo
    if (this.undoBtn) {
      this.undoBtn.addEventListener('click', () => {
        if (this.history.undo()) {
          this.app.renderSingle();
          this.showToast('Undo');
        }
      });
    }

    // Redo
    if (this.redoBtn) {
      this.redoBtn.addEventListener('click', () => {
        if (this.history.redo()) {
          this.app.renderSingle();
          this.showToast('Redo');
        }
      });
    }

    // Reset View / Center Canvas
    if (this.resetViewBtn) {
      this.resetViewBtn.addEventListener('click', () => {
        this.app.viewport.resetView();
        this.showToast('View Reset');
      });
    }

    // Fix / Bake drawing
    if (this.fixBtn) {
      this.fixBtn.addEventListener('click', () => {
        this.history.recordState();
        this.sim.fixDrawing();
        this.showToast('Baking ink into paper fibers...');
      });
    }

    // Clear canvas
    if (this.clearBtn) {
      this.clearBtn.addEventListener('click', () => {
        this.history.recordState();
        this.sim.clearAll();
        this.app.renderSingle();
        this.showToast('Canvas cleared (Undo available)');
      });
    }

    // Export / Save PNG
    const triggerExport = () => {
      this.app.exportPNG();
    };
    if (this.exportBtn) this.exportBtn.addEventListener('click', triggerExport);
    if (this.saveBtn) this.saveBtn.addEventListener('click', triggerExport);

    // Fullscreen
    if (this.fullscreenBtn) {
      this.fullscreenBtn.addEventListener('click', () => {
        this.toggleFullscreen();
      });
    }

    // Help modal
    if (this.helpBtn && this.helpModal) {
      this.helpBtn.addEventListener('click', () => {
        this.helpModal.classList.add('open');
      });
    }
  }

  initHistoryObserver() {
    this.history.onChange = (canUndo, canRedo) => {
      if (this.undoBtn) {
        this.undoBtn.disabled = !canUndo;
        this.undoBtn.classList.toggle('disabled', !canUndo);
      }
      if (this.redoBtn) {
        this.redoBtn.disabled = !canRedo;
        this.redoBtn.classList.toggle('disabled', !canRedo);
      }
    };
    this.history.notify();
  }

  toggleFullscreen() {
    const el = document.documentElement;
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      const rfs = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
      if (rfs) rfs.call(el);
      this.showToast('Entered Fullscreen');
    } else {
      const efs = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
      if (efs) efs.call(document);
      this.showToast('Exited Fullscreen');
    }
  }

  initKeyboardShortcuts() {
    window.addEventListener('keydown', e => {
      // Undo / Redo keyboard shortcuts
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          if (this.history.redo()) {
            this.app.renderSingle();
            this.showToast('Redo');
          }
        } else {
          if (this.history.undo()) {
            this.app.renderSingle();
            this.showToast('Undo');
          }
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        if (this.history.redo()) {
          this.app.renderSingle();
          this.showToast('Redo');
        }
        return;
      }

      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.key.toLowerCase()) {
        case '1': this.selectBrush(BRUSH_TYPES.PEN); break;
        case '2': this.selectBrush(BRUSH_TYPES.WATER); break;
        case '3': this.selectBrush(BRUSH_TYPES.WASH); break;
        case '4': this.selectBrush(BRUSH_TYPES.BLEED); break;
        case '5': this.selectBrush(BRUSH_TYPES.GOUACHE); break;
        case '6': this.selectBrush(BRUSH_TYPES.SPLATTER); break;
        case '7': this.selectBrush(BRUSH_TYPES.BLENDER); break;
        case 'b':
          this.selectBrush(this.brushes.activeType === BRUSH_TYPES.PEN ? BRUSH_TYPES.WATER : BRUSH_TYPES.PEN);
          break;
        case 'w':
          this.setWhiteMode(!this.brushes.isWhiteMode);
          break;
        case 'd':
          this.history.recordState();
          this.sim.fixDrawing();
          this.showToast('Baking ink into paper fibers...');
          break;
        case 'c':
          this.history.recordState();
          this.sim.clearAll();
          this.app.renderSingle();
          this.showToast('Canvas cleared');
          break;
        case 's':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            this.app.exportPNG();
          }
          break;
        case 'e':
          this.app.exportPNG();
          break;
        case 'n':
          if (this.newModal) this.newModal.classList.add('open');
          break;
        case 'f':
          this.toggleFullscreen();
          break;
        case 'tab':
          e.preventDefault();
          this.sidebarEl.classList.toggle('collapsed');
          break;
      }
    });
  }
}
