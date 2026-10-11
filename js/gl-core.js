// js/gl-core.js - WebGL2 Engine Utilities, FBO Management, and Double Buffering

import { VERT } from './shaders.js';

export class GLContext {
  constructor(canvas) {
    this.canvas = canvas;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.fitCanvas();

    const gl = canvas.getContext('webgl2', {
      alpha: false,
      depth: false,
      stencil: false,
      antialias: false,
      preserveDrawingBuffer: true,
      desynchronized: true // Android / Chromium low-latency direct scanout
    });

    if (!gl) {
      throw new Error('WebGL2 is not supported on this device/browser.');
    }

    const floatExt = gl.getExtension('EXT_color_buffer_float');
    if (!floatExt) {
      console.warn('EXT_color_buffer_float not supported, half-float buffers may have limited support');
    }
    gl.disable(gl.BLEND);

    this.gl = gl;
    this.HF = gl.HALF_FLOAT;

    // Fullscreen triangle VAO
    this.quadVS = this.compileShader(gl.VERTEX_SHADER, VERT);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  }

  fitCanvas() {
    // If canvas dimensions are already explicitly set (e.g. 2400x2400), preserve them
    if (this.canvas.width && this.canvas.height && this.canvas.width >= 512) {
      return;
    }
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(2, Math.floor(window.innerWidth * this.dpr));
    this.canvas.height = Math.max(2, Math.floor(window.innerHeight * this.dpr));
  }

  setSize(w, h) {
    this.canvas.width = w;
    this.canvas.height = h;
  }

  compileShader(type, src) {
    const gl = this.gl;
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const err = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error(err + '\n' + src);
    }
    return s;
  }

  createProgram(fsSrc) {
    const gl = this.gl;
    const p = gl.createProgram();
    const fs = this.compileShader(gl.FRAGMENT_SHADER, fsSrc);
    gl.attachShader(p, this.quadVS);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const err = gl.getProgramInfoLog(p);
      gl.deleteProgram(p);
      throw new Error(err);
    }
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const inf = gl.getActiveUniform(p, i);
      u[inf.name] = gl.getUniformLocation(p, inf.name);
    }
    return {
      p,
      u,
      bind: () => gl.useProgram(p)
    };
  }

  createFBO(w, h, internal, format, type, filter) {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, null);

    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    return {
      tex,
      fbo,
      w,
      h,
      internal,
      format,
      type,
      filter,
      texel: [1 / w, 1 / h],
      attach(unit) {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, this.tex);
        return unit;
      },
      destroy() {
        gl.deleteFramebuffer(fbo);
        gl.deleteTexture(tex);
      }
    };
  }

  createDoubleFBO(w, h, internal, format, type, filter) {
    let a = this.createFBO(w, h, internal, format, type, filter);
    let b = this.createFBO(w, h, internal, format, type, filter);
    return {
      w,
      h,
      texel: [1 / w, 1 / h],
      internal,
      format,
      type,
      filter,
      get read() { return a; },
      get write() { return b; },
      swap() {
        const t = a;
        a = b;
        b = t;
      },
      destroy() {
        a.destroy();
        b.destroy();
      }
    };
  }

  blit(target) {
    const gl = this.gl;
    if (target == null) {
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    } else {
      gl.viewport(0, 0, target.w, target.h);
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  copyInto(progCopy, srcTex, dstFBO) {
    const gl = this.gl;
    progCopy.bind();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, srcTex);
    gl.uniform1i(progCopy.u.uTex, 0);
    gl.uniform1f(progCopy.u.uValue, 1.0);
    this.blit(dstFBO);
  }
}
