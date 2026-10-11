// js/fluid-sim.js - Navier-Stokes Fluid & Pigment Simulation Engine

import {
  copyFS, splatFS, advectVelFS, advectWetFS, advectInkFS,
  divergenceFS, pressureFS, gradSubFS, curlFS, vorticityFS,
  exchangeFS, displayFS, paperBakeFS
} from './shaders.js';

export class FluidSimulation {
  constructor(glCtx) {
    this.glCtx = glCtx;
    this.gl = glCtx.gl;

    // Simulation Parameters
    this.P = {
      SIZE: 0.5,
      FLOW: 0.6,
      BLEED: 0.5,
      DRY: 0.45,
      COLOR: 0.5,
      BINK: 0.0
    };

    this.SIM_BASE = 256;
    this.PRESSURE_ITER = 16; // Optimized Jacobi iterations (27% fewer draw calls)
    this.fixTimer = 0;
    this.brushFootprint = { x: 0, y: 0, r: 0 };
    this.activeFrames = 120; // Adaptive sleep counter

    this.initPrograms();
    this.initTargets();
  }

  wake(frames = 120) {
    this.activeFrames = Math.max(this.activeFrames, frames);
  }

  getRes(base) {
    const ar = this.glCtx.canvas.width / this.glCtx.canvas.height;
    return ar > 1
      ? { w: Math.round(base * ar), h: base }
      : { w: base, h: Math.round(base / ar) };
  }

  initPrograms() {
    const gl = this.gl;
    this.progCopy = this.glCtx.createProgram(copyFS);
    this.progSplat = this.glCtx.createProgram(splatFS);
    this.progAdvVel = this.glCtx.createProgram(advectVelFS);
    this.progAdvWet = this.glCtx.createProgram(advectWetFS);
    this.progAdvInk = this.glCtx.createProgram(advectInkFS);
    this.progExch = this.glCtx.createProgram(exchangeFS);
    this.progDiv = this.glCtx.createProgram(divergenceFS);
    this.progPressure = this.glCtx.createProgram(pressureFS);
    this.progGradSub = this.glCtx.createProgram(gradSubFS);
    this.progCurl = this.glCtx.createProgram(curlFS);
    this.progVort = this.glCtx.createProgram(vorticityFS);
    this.progDisplay = this.glCtx.createProgram(displayFS);
    this.progPaperBake = this.glCtx.createProgram(paperBakeFS);

    // Static sampler bindings assigned once to eliminate per-frame driver overhead
    this.progCopy.bind();
    gl.uniform1i(this.progCopy.u.uTex, 0);

    this.progAdvVel.bind();
    gl.uniform1i(this.progAdvVel.u.uVelocity, 0);
    gl.uniform1i(this.progAdvVel.u.uWet, 1);

    this.progCurl.bind();
    gl.uniform1i(this.progCurl.u.uVelocity, 0);

    this.progVort.bind();
    gl.uniform1i(this.progVort.u.uVelocity, 0);
    gl.uniform1i(this.progVort.u.uCurl, 1);

    this.progDiv.bind();
    gl.uniform1i(this.progDiv.u.uVelocity, 0);

    this.progPressure.bind();
    gl.uniform1i(this.progPressure.u.uPressure, 0);
    gl.uniform1i(this.progPressure.u.uDivergence, 1);

    this.progGradSub.bind();
    gl.uniform1i(this.progGradSub.u.uPressure, 0);
    gl.uniform1i(this.progGradSub.u.uVelocity, 1);

    this.progAdvWet.bind();
    gl.uniform1i(this.progAdvWet.u.uVelocity, 0);
    gl.uniform1i(this.progAdvWet.u.uWet, 1);

    this.progAdvInk.bind();
    gl.uniform1i(this.progAdvInk.u.uVelocity, 0);
    gl.uniform1i(this.progAdvInk.u.uSource, 1);
    gl.uniform1i(this.progAdvInk.u.uWet, 2);

    this.progExch.bind();
    gl.uniform1i(this.progExch.u.uFixed, 0);
    gl.uniform1i(this.progExch.u.uInk, 1);
    gl.uniform1i(this.progExch.u.uWet, 2);

    this.progDisplay.bind();
    gl.uniform1i(this.progDisplay.u.uInk, 0);
    gl.uniform1i(this.progDisplay.u.uWet, 1);
    gl.uniform1i(this.progDisplay.u.uFixed, 2);
    gl.uniform1i(this.progDisplay.u.uPaperTex, 3);
  }

  bakePaperTexture() {
    const gl = this.gl;
    this.progPaperBake.bind();
    gl.uniform2f(this.progPaperBake.u.uRes, this.dyeRes.w, this.dyeRes.h);
    this.glCtx.blit(this.paperTex);
  }

  initTargets() {
    const gl = this.gl;
    const HF = this.glCtx.HF;
    const sim = this.getRes(this.SIM_BASE);
    const dye = { w: this.glCtx.canvas.width, h: this.glCtx.canvas.height };

    this.simRes = sim;
    this.dyeRes = dye;

    this.velocity   = this.glCtx.createDoubleFBO(sim.w, sim.h, gl.RG16F, gl.RG, HF, gl.LINEAR);
    this.divergence = this.glCtx.createFBO(sim.w, sim.h, gl.R16F, gl.RED, HF, gl.NEAREST);
    this.curl       = this.glCtx.createFBO(sim.w, sim.h, gl.R16F, gl.RED, HF, gl.NEAREST);
    this.pressure   = this.glCtx.createDoubleFBO(sim.w, sim.h, gl.R16F, gl.RED, HF, gl.NEAREST);

    this.ink        = this.glCtx.createDoubleFBO(dye.w, dye.h, gl.RGBA16F, gl.RGBA, HF, gl.LINEAR);
    this.fixed      = this.glCtx.createDoubleFBO(dye.w, dye.h, gl.RGBA16F, gl.RGBA, HF, gl.LINEAR);
    this.wet        = this.glCtx.createDoubleFBO(dye.w, dye.h, gl.R16F, gl.RED, HF, gl.LINEAR);
    this.paperTex   = this.glCtx.createFBO(dye.w, dye.h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR);
    this.bakePaperTexture();
  }

  reinitTargets(w, h) {
    for (const d of [this.velocity, this.pressure, this.ink, this.fixed, this.wet]) {
      if (d && typeof d.destroy === 'function') d.destroy();
    }
    if (this.divergence && typeof this.divergence.destroy === 'function') this.divergence.destroy();
    if (this.curl && typeof this.curl.destroy === 'function') this.curl.destroy();
    if (this.paperTex && typeof this.paperTex.destroy === 'function') this.paperTex.destroy();

    this.glCtx.setSize(w, h);
    this.initTargets();
    this.clearAll();
  }

  handleResize() {
    const oldInk = this.ink.read.tex;
    const oldFix = this.fixed.read.tex;
    const oldWet = this.wet.read.tex;
    const oldVel = this.velocity.read.tex;

    if (this.paperTex && typeof this.paperTex.destroy === 'function') this.paperTex.destroy();

    this.glCtx.fitCanvas();
    this.initTargets();

    this.glCtx.copyInto(this.progCopy, oldVel, this.velocity.write); this.velocity.swap();
    this.glCtx.copyInto(this.progCopy, oldInk, this.ink.write); this.ink.swap();
    this.glCtx.copyInto(this.progCopy, oldFix, this.fixed.write); this.fixed.swap();
    this.glCtx.copyInto(this.progCopy, oldWet, this.wet.write); this.wet.swap();
  }

  clearAll() {
    this.wake(30);
    const gl = this.gl;
    for (const d of [this.velocity, this.pressure, this.ink, this.fixed, this.wet]) {
      for (const f of [d.read, d.write]) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, f.fbo);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
    }
  }

  fixDrawing() {
    this.fixTimer = 1.2;
    this.wake(180);
  }

  splat(target, x, y, r, c, useMax = false) {
    this.wake(140);
    const gl = this.gl;
    const f = target.read;
    gl.bindFramebuffer(gl.FRAMEBUFFER, f.fbo);
    gl.viewport(0, 0, f.w, f.h);

    const ex = Math.ceil(r * 4.5 * f.h) + 2;
    const cx = Math.round(x * f.w);
    const cy = Math.round(y * f.h);

    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(Math.max(cx - ex, 0), Math.max(cy - ex, 0), ex * 2, ex * 2);
    gl.enable(gl.BLEND);

    if (useMax) {
      gl.blendEquation(gl.MAX);
    } else {
      gl.blendEquation(gl.FUNC_ADD);
      gl.blendFunc(gl.ONE, gl.ONE);
    }

    this.progSplat.bind();
    gl.uniform1f(this.progSplat.u.uAspect, this.glCtx.canvas.width / this.glCtx.canvas.height);
    gl.uniform2f(this.progSplat.u.uPoint, x, y);
    gl.uniform4f(this.progSplat.u.uColor, c[0], c[1], c[2], c[3]);
    gl.uniform1f(this.progSplat.u.uRadius, r * r);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.blendEquation(gl.FUNC_ADD);
    gl.disable(gl.BLEND);
    gl.disable(gl.SCISSOR_TEST);
  }

  step(dt) {
    const gl = this.gl;
    const fixing = this.fixTimer > 0;
    if (fixing) {
      this.fixTimer -= dt;
    }

    // Adaptive Sleep: if fluid has settled and dried, skip heavy simulation passes
    if (this.activeFrames <= 0 && !fixing) {
      return false;
    }
    this.activeFrames--;

    // 1. Velocity Advection & Dissipation
    this.progAdvVel.bind();
    this.velocity.read.attach(0);
    this.wet.read.attach(1);
    gl.uniform2f(this.progAdvVel.u.uTexel, this.velocity.texel[0], this.velocity.texel[1]);
    gl.uniform1f(this.progAdvVel.u.uDt, dt);
    gl.uniform1f(this.progAdvVel.u.uDissipation,
      Math.exp(-dt * (3.0 - this.P.FLOW * 2.4)) * (fixing ? Math.exp(-dt * 7) : 1));
    this.glCtx.blit(this.velocity.write);
    this.velocity.swap();

    // 2. Vorticity Confinement
    this.progCurl.bind();
    this.velocity.read.attach(0);
    gl.uniform2f(this.progCurl.u.uTexel, this.velocity.texel[0], this.velocity.texel[1]);
    this.glCtx.blit(this.curl);

    this.progVort.bind();
    this.velocity.read.attach(0);
    this.curl.attach(1);
    gl.uniform2f(this.progVort.u.uTexel, this.velocity.texel[0], this.velocity.texel[1]);
    gl.uniform1f(this.progVort.u.uCurlAmt, 4 + this.P.FLOW * 22);
    gl.uniform1f(this.progVort.u.uDt, dt);
    this.glCtx.blit(this.velocity.write);
    this.velocity.swap();

    // 3. Divergence
    this.progDiv.bind();
    this.velocity.read.attach(0);
    gl.uniform2f(this.progDiv.u.uTexel, this.velocity.texel[0], this.velocity.texel[1]);
    this.glCtx.blit(this.divergence);

    // 4. Pressure Solver (Jacobi relaxation with optimized iteration count)
    this.progCopy.bind();
    this.pressure.read.attach(0);
    gl.uniform1f(this.progCopy.u.uValue, 0.8);
    this.glCtx.blit(this.pressure.write);
    this.pressure.swap();

    this.progPressure.bind();
    this.divergence.attach(1);
    gl.uniform2f(this.progPressure.u.uTexel, this.velocity.texel[0], this.velocity.texel[1]);
    for (let i = 0; i < this.PRESSURE_ITER; i++) {
      this.pressure.read.attach(0);
      this.glCtx.blit(this.pressure.write);
      this.pressure.swap();
    }

    // 5. Gradient Subtraction
    this.progGradSub.bind();
    this.pressure.read.attach(0);
    this.velocity.read.attach(1);
    gl.uniform2f(this.progGradSub.u.uTexel, this.velocity.texel[0], this.velocity.texel[1]);
    this.glCtx.blit(this.velocity.write);
    this.velocity.swap();

    // 6. Water Evaporation & Diffusion
    const dryTau = fixing ? 0.25 : 2 + (1 - this.P.DRY) * 16;
    this.progAdvWet.bind();
    this.velocity.read.attach(0);
    this.wet.read.attach(1);
    gl.uniform2f(this.progAdvWet.u.uTexel, this.velocity.texel[0], this.velocity.texel[1]);
    gl.uniform2f(this.progAdvWet.u.uSrcTexel, this.wet.texel[0], this.wet.texel[1]);
    gl.uniform1f(this.progAdvWet.u.uDt, dt);
    gl.uniform1f(this.progAdvWet.u.uDecay, Math.exp(-dt / dryTau));
    gl.uniform1f(this.progAdvWet.u.uSpread, 0.12);
    this.glCtx.blit(this.wet.write);
    this.wet.swap();

    // 7. Pigment Advection & Chromatic Bleed
    const C = this.P.COLOR;
    this.progAdvInk.bind();
    this.velocity.read.attach(0);
    this.ink.read.attach(1);
    this.wet.read.attach(2);
    gl.uniform2f(this.progAdvInk.u.uTexel, this.velocity.texel[0], this.velocity.texel[1]);
    gl.uniform2f(this.progAdvInk.u.uSrcTexel, this.ink.texel[0], this.ink.texel[1]);
    gl.uniform1f(this.progAdvInk.u.uDt, dt);
    gl.uniform1f(this.progAdvInk.u.uBleed, this.P.BLEED);
    gl.uniform1f(this.progAdvInk.u.uAspect, this.glCtx.canvas.width / this.glCtx.canvas.height);
    gl.uniform3f(this.progAdvInk.u.uChroma, 1.0 + 0.85 * C, 1.0 + 0.15 * C, Math.max(0.25, 1.0 - 0.65 * C));
    gl.uniform3f(this.progAdvInk.u.uBrush, this.brushFootprint.x, this.brushFootprint.y, this.brushFootprint.r);
    this.glCtx.blit(this.ink.write);
    this.ink.swap();

    // 8. Layer Exchange (settle down mobile pigment into paper while fixing)
    const settle = fixing ? 1 - Math.exp(-dt * 5) : 0;
    this.progExch.bind();
    this.fixed.read.attach(0);
    this.ink.read.attach(1);
    this.wet.read.attach(2);
    gl.uniform1f(this.progExch.u.uSettle, settle);
    gl.uniform1f(this.progExch.u.uDt, dt);
    gl.uniform1f(this.progExch.u.uAspect, this.glCtx.canvas.width / this.glCtx.canvas.height);
    gl.uniform3f(this.progExch.u.uBrush, this.brushFootprint.x, this.brushFootprint.y, this.brushFootprint.r);
    gl.uniform1f(this.progExch.u.uMode, 0);
    this.glCtx.blit(this.fixed.write);
    gl.uniform1f(this.progExch.u.uMode, 1);
    this.glCtx.blit(this.ink.write);
    this.fixed.swap();
    this.ink.swap();

    return true;
  }

  render() {
    const gl = this.gl;
    this.progDisplay.bind();
    this.ink.read.attach(0);
    this.wet.read.attach(1);
    this.fixed.read.attach(2);
    this.paperTex.attach(3);
    gl.uniform2f(this.progDisplay.u.uTexel, this.ink.texel[0], this.ink.texel[1]);
    gl.uniform1f(this.progDisplay.u.uInkStrength, 1.9);
    gl.uniform1f(this.progDisplay.u.uEdge, 1.35);
    gl.uniform1f(this.progDisplay.u.uGrain, 0.55);
    gl.uniform1f(this.progDisplay.u.uWhiteTint, this.P.COLOR * 0.35);
    this.glCtx.blit(null);
  }
}
