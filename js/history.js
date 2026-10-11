// js/history.js - GPU Texture-to-Texture Undo/Redo History Manager

export class HistoryManager {
  constructor(glCtx, sim, maxHistory = 8) {
    this.glCtx = glCtx;
    this.sim = sim;
    this.gl = glCtx.gl;
    const isMobile = matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints && navigator.maxTouchPoints > 1);
    const isHighRes = sim.dyeRes && (sim.dyeRes.w >= 2000 || sim.dyeRes.h >= 2000);
    this.maxHistory = isHighRes ? 5 : (isMobile ? 6 : maxHistory);

    this.undoStack = [];
    this.redoStack = [];
    this.pool = [];
    this.onChange = null;
  }

  reset() {
    this.clearStacks();
    this.clearPool();
    this.notify();
  }

  // Acquire or allocate a snapshot container { ink, fixed, wet }
  acquireSnapshot() {
    if (this.pool.length > 0) {
      return this.pool.pop();
    }
    const dye = this.sim.dyeRes;
    const gl = this.gl;
    const HF = this.glCtx.HF;

    const ink = this.glCtx.createFBO(dye.w, dye.h, gl.RGBA16F, gl.RGBA, HF, gl.LINEAR);
    const fixed = this.glCtx.createFBO(dye.w, dye.h, gl.RGBA16F, gl.RGBA, HF, gl.LINEAR);
    const wet = this.glCtx.createFBO(dye.w, dye.h, gl.R16F, gl.RED, HF, gl.LINEAR);

    return { ink, fixed, wet };
  }

  recycleSnapshot(snap) {
    if (!snap) return;
    this.pool.push(snap);
  }

  clearPool() {
    for (const snap of this.pool) {
      snap.ink.destroy();
      snap.fixed.destroy();
      snap.wet.destroy();
    }
    this.pool = [];
  }

  clearStacks() {
    while (this.undoStack.length > 0) {
      this.recycleSnapshot(this.undoStack.pop());
    }
    while (this.redoStack.length > 0) {
      this.recycleSnapshot(this.redoStack.pop());
    }
    this.notify();
  }

  notify() {
    if (typeof this.onChange === 'function') {
      this.onChange(this.canUndo(), this.canRedo());
    }
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  // Capture current canvas state into an FBO snapshot
  recordState() {
    const snap = this.acquireSnapshot();
    const copy = this.sim.progCopy;

    this.glCtx.copyInto(copy, this.sim.ink.read.tex, snap.ink);
    this.glCtx.copyInto(copy, this.sim.fixed.read.tex, snap.fixed);
    this.glCtx.copyInto(copy, this.sim.wet.read.tex, snap.wet);

    this.undoStack.push(snap);

    // Enforce history limit
    if (this.undoStack.length > this.maxHistory) {
      const oldest = this.undoStack.shift();
      this.recycleSnapshot(oldest);
    }

    // Invalidate redo stack upon new recorded action
    while (this.redoStack.length > 0) {
      this.recycleSnapshot(this.redoStack.pop());
    }

    this.notify();
  }

  // Restore a snapshot into the simulation's ping-pong targets
  applySnapshot(snap) {
    const copy = this.sim.progCopy;

    // Both ping-pong buffers must match
    this.glCtx.copyInto(copy, snap.ink.tex, this.sim.ink.write);
    this.sim.ink.swap();
    this.glCtx.copyInto(copy, snap.ink.tex, this.sim.ink.write);
    this.sim.ink.swap();

    this.glCtx.copyInto(copy, snap.fixed.tex, this.sim.fixed.write);
    this.sim.fixed.swap();
    this.glCtx.copyInto(copy, snap.fixed.tex, this.sim.fixed.write);
    this.sim.fixed.swap();

    this.glCtx.copyInto(copy, snap.wet.tex, this.sim.wet.write);
    this.sim.wet.swap();
    this.glCtx.copyInto(copy, snap.wet.tex, this.sim.wet.write);
    this.sim.wet.swap();

    // Clear velocity to prevent sudden shock advection
    const gl = this.gl;
    for (const d of [this.sim.velocity, this.sim.pressure]) {
      for (const f of [d.read, d.write]) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, f.fbo);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
    }
  }

  undo() {
    if (!this.canUndo()) return false;

    // 1. Snapshot current state to redo stack
    const currentSnap = this.acquireSnapshot();
    const copy = this.sim.progCopy;
    this.glCtx.copyInto(copy, this.sim.ink.read.tex, currentSnap.ink);
    this.glCtx.copyInto(copy, this.sim.fixed.read.tex, currentSnap.fixed);
    this.glCtx.copyInto(copy, this.sim.wet.read.tex, currentSnap.wet);
    this.redoStack.push(currentSnap);

    // 2. Pop previous state from undo stack
    const prevSnap = this.undoStack.pop();
    this.applySnapshot(prevSnap);
    this.recycleSnapshot(prevSnap);

    this.notify();
    return true;
  }

  redo() {
    if (!this.canRedo()) return false;

    // 1. Snapshot current state to undo stack
    const currentSnap = this.acquireSnapshot();
    const copy = this.sim.progCopy;
    this.glCtx.copyInto(copy, this.sim.ink.read.tex, currentSnap.ink);
    this.glCtx.copyInto(copy, this.sim.fixed.read.tex, currentSnap.fixed);
    this.glCtx.copyInto(copy, this.sim.wet.read.tex, currentSnap.wet);
    this.undoStack.push(currentSnap);

    // 2. Pop state from redo stack
    const nextSnap = this.redoStack.pop();
    this.applySnapshot(nextSnap);
    this.recycleSnapshot(nextSnap);

    this.notify();
    return true;
  }
}
