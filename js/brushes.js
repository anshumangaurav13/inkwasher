// js/brushes.js - Comprehensive Brush System for Watercolor & Fluid Simulation

export const BRUSH_TYPES = {
  PEN: 'pen',
  WATER: 'water',
  WASH: 'wash',
  BLEED: 'bleed',
  GOUACHE: 'gouache',
  SPLATTER: 'splatter',
  BLENDER: 'blender'
};

export const BRUSH_METADATA = {
  [BRUSH_TYPES.PEN]: {
    id: BRUSH_TYPES.PEN,
    name: 'Fine Dip Pen',
    shortName: 'Pen',
    desc: 'Deep ink, crisp calligraphic lines that pool when resting.',
    icon: 'pen',
    svgIcon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="1.5"/></svg>',
    defaultSize: 0.45,
    defaultFlow: 0.5,
    defaultBleed: 0.4,
    defaultBink: 0.0,
    white: false
  },
  [BRUSH_TYPES.WATER]: {
    id: BRUSH_TYPES.WATER,
    name: 'Clear Water Brush',
    shortName: 'Water',
    desc: 'Living water with zero ink; disperses, bleeds, and blends existing pigment.',
    icon: 'water',
    svgIcon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>',
    defaultSize: 0.55,
    defaultFlow: 0.65,
    defaultBleed: 0.6,
    defaultBink: 0.0,
    white: false
  },
  [BRUSH_TYPES.WASH]: {
    id: BRUSH_TYPES.WASH,
    name: 'Sumi Wash Brush',
    shortName: 'Wash',
    desc: 'Soft sumi-e wash laying down dilute ink and water simultaneously.',
    icon: 'wash',
    svgIcon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M9.06 11.9l8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08"/><path d="M7.07 14.94l-3.8 1.15a1 1 0 0 0-.67 1.25l.8 2.66 4.88-4.88"/></svg>',
    defaultSize: 0.6,
    defaultFlow: 0.55,
    defaultBleed: 0.55,
    defaultBink: 0.35,
    white: false
  },
  [BRUSH_TYPES.BLEED]: {
    id: BRUSH_TYPES.BLEED,
    name: 'Wet-in-Wet Flooder',
    shortName: 'Bleed',
    desc: 'High-volume water brush designed for dramatic watercolor blooming.',
    icon: 'bleed',
    svgIcon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12c2.5-3 5-3 7.5 0s5 3 7.5 0 5-3 7 0"/><path d="M2 7c2.5-3 5-3 7.5 0s5 3 7.5 0 5-3 7 0"/><path d="M2 17c2.5-3 5-3 7.5 0s5 3 7.5 0 5-3 7 0"/></svg>',
    defaultSize: 0.75,
    defaultFlow: 0.85,
    defaultBleed: 0.8,
    defaultBink: 0.0,
    white: false
  },
  [BRUSH_TYPES.GOUACHE]: {
    id: BRUSH_TYPES.GOUACHE,
    name: 'White Gouache',
    shortName: 'Gouache',
    desc: 'Opaque white pigment for highlights, water foam, and mist over dark ink.',
    icon: 'gouache',
    svgIcon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v18m9-9H3m15.36-6.36L5.64 18.36m12.72 0L5.64 5.64"/></svg>',
    defaultSize: 0.45,
    defaultFlow: 0.5,
    defaultBleed: 0.3,
    defaultBink: 0.0,
    white: true
  },
  [BRUSH_TYPES.SPLATTER]: {
    id: BRUSH_TYPES.SPLATTER,
    name: 'Ink Splatter',
    shortName: 'Splatter',
    desc: 'Sprays clusters of randomized organic ink and water droplets.',
    icon: 'splatter',
    svgIcon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><circle cx="12" cy="12" r="3"/><circle cx="6" cy="9" r="1.5"/><circle cx="17" cy="7" r="1.8"/><circle cx="7" cy="16" r="1.6"/><circle cx="16" cy="15" r="2"/><circle cx="12" cy="5" r="1.2"/><circle cx="19" cy="12" r="1.4"/></svg>',
    defaultSize: 0.65,
    defaultFlow: 0.5,
    defaultBleed: 0.5,
    defaultBink: 0.25,
    white: false
  },
  [BRUSH_TYPES.BLENDER]: {
    id: BRUSH_TYPES.BLENDER,
    name: 'Soft Blender',
    shortName: 'Blender',
    desc: 'Stirs and softens active wet edges without flooding paper with new water.',
    icon: 'blender',
    svgIcon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 14a4 4 0 1 1 4-4 4 4 0 0 1-4 4z"/></svg>',
    defaultSize: 0.55,
    defaultFlow: 0.7,
    defaultBleed: 0.7,
    defaultBink: 0.0,
    white: false
  }
};

export class BrushEngine {
  constructor(sim) {
    this.sim = sim;
    this.activeType = BRUSH_TYPES.PEN;
    this.isWhiteMode = false;
    this.inkAbs = [1.00, 0.97, 0.88]; // Near-black ink, faintly cool

    // Splatter throttle
    this.lastSplatterDist = 0;
  }

  setBrushType(type) {
    if (!BRUSH_METADATA[type]) return;
    this.activeType = type;
    const meta = BRUSH_METADATA[type];
    if (meta.white) {
      this.isWhiteMode = true;
    } else if (type !== BRUSH_TYPES.PEN && type !== BRUSH_TYPES.WASH && this.activeType !== BRUSH_TYPES.GOUACHE) {
      // Keep previous white mode if not switching to gouache
    }
  }

  setColorHex(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    if (Math.max(r, g, b) < 0.09) {
      this.inkAbs = [1.00, 0.97, 0.88];
      return;
    }
    const A = [r, g, b].map(v => -Math.log(Math.max(v, 0.02)));
    const m = Math.max(A[0], A[1], A[2], 0.25);
    this.inkAbs = A.map(v => v / m);
  }

  getColorVector(density) {
    if (this.isWhiteMode || this.activeType === BRUSH_TYPES.GOUACHE) {
      return [0, 0, 0, density];
    }
    return [
      this.inkAbs[0] * density,
      this.inkAbs[1] * density,
      this.inkAbs[2] * density,
      0
    ];
  }

  getSizeMultiplier() {
    return Math.pow(3, (this.sim.P.SIZE - 0.5) * 2);
  }

  getPenRadius(pr, speed) {
    const mult = this.getSizeMultiplier();
    return (0.0016 + 0.0042 * pr) * Math.min(Math.max(1.12 - speed * 0.3, 0.55), 1.12) * mult;
  }

  getBrushRadius(pr, speed) {
    const mult = this.getSizeMultiplier();
    return (0.014 + 0.060 * pr) * (1 + Math.min(speed, 2.5) * 0.28) * mult;
  }

  // Applies active stroke step
  applyStroke(strokeInfo, dt, isBarrelDown = false) {
    this.sim.brushFootprint.r = 0;

    let effectiveType = this.activeType;
    if (isBarrelDown) {
      // Barrel button temporarily toggles between pen/wash and water
      effectiveType = (effectiveType === BRUSH_TYPES.PEN || effectiveType === BRUSH_TYPES.GOUACHE)
        ? BRUSH_TYPES.WATER : BRUSH_TYPES.PEN;
    }

    const { px, py, bx, by, dx, dy, dist, pressure: pr, speed } = strokeInfo;

    switch (effectiveType) {
      case BRUSH_TYPES.PEN:
      case BRUSH_TYPES.GOUACHE: {
        const radius = this.getPenRadius(pr, speed);
        const dens = (0.55 + 1.05 * pr) * Math.min(Math.max(1.25 - speed * 0.45, 0.6), 1.25);
        const col = this.getColorVector(dens);

        if (dist < radius * 0.4) {
          // Ink pools while pen dwells
          this.sim.splat(this.sim.ink, bx, by, radius * 1.15, this.getColorVector(dens * dt * 4), false);
          this.sim.splat(this.sim.wet, bx, by, radius * 2.8, [0.16, 0, 0, 0], true);
          return;
        }

        const spacing = radius * 0.6;
        const steps = Math.min(Math.ceil(dist / spacing), 60);
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          const x = px + dx * t;
          const y = py + dy * t;
          this.sim.splat(this.sim.ink, x, y, radius, col, false);
          if (i % 2 === 0 || steps === 1) {
            this.sim.splat(this.sim.wet, x, y, radius * 2.8, [0.16, 0, 0, 0], true);
          }
        }
        break;
      }

      case BRUSH_TYPES.WATER:
      case BRUSH_TYPES.WASH:
      case BRUSH_TYPES.BLEED:
      case BRUSH_TYPES.BLENDER: {
        let radius = this.getBrushRadius(pr, speed);
        if (effectiveType === BRUSH_TYPES.BLEED) radius *= 1.35;
        if (effectiveType === BRUSH_TYPES.BLENDER) radius *= 0.85;

        this.sim.brushFootprint.x = bx;
        this.sim.brushFootprint.y = by;
        this.sim.brushFootprint.r = radius;

        const wAmp = effectiveType === BRUSH_TYPES.BLEED
          ? 1.0 + 0.3 * pr
          : (effectiveType === BRUSH_TYPES.BLENDER ? 0.25 * pr : 0.5 + 0.5 * pr);

        const flowMult = effectiveType === BRUSH_TYPES.BLEED ? 1.4 : 1.0;
        const force = (15 + this.sim.P.FLOW * 95) * flowMult;
        const vmax = 260;
        let vx = (dx / Math.max(dt, 1e-4)) * force;
        let vy = (dy / Math.max(dt, 1e-4)) * force;
        const vm = Math.hypot(vx, vy);
        if (vm > vmax) {
          vx *= vmax / vm;
          vy *= vmax / vm;
        }

        let bdens = 0;
        if (effectiveType === BRUSH_TYPES.WASH) {
          const inkLoad = Math.max(this.sim.P.BINK, 0.25);
          bdens = inkLoad * 0.12 * (0.4 + 0.6 * pr);
        } else if (this.sim.P.BINK > 0) {
          bdens = this.sim.P.BINK * 0.10 * (0.4 + 0.6 * pr);
        }

        if (dist < radius * 0.25) {
          if (effectiveType !== BRUSH_TYPES.BLENDER) {
            this.sim.splat(this.sim.wet, bx, by, radius, [wAmp, 0, 0, 0], true);
          }
          // Gentle stir while resting
          const a = Math.random() * Math.PI * 2;
          const jm = (6 + 26 * this.sim.P.FLOW) * pr;
          this.sim.splat(this.sim.velocity, bx, by, radius * 0.9, [Math.cos(a) * jm, Math.sin(a) * jm, 0, 0], false);
          if (bdens > 0) {
            this.sim.splat(this.sim.ink, bx, by, radius * 0.8, this.getColorVector(bdens * dt * 5), false);
          }
          return;
        }

        const spacing = radius * 0.65;
        const steps = Math.min(Math.ceil(dist / spacing), 14);
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          const x = px + dx * t;
          const y = py + dy * t;
          if (effectiveType !== BRUSH_TYPES.BLENDER) {
            this.sim.splat(this.sim.wet, x, y, radius, [wAmp, 0, 0, 0], true);
          }
          this.sim.splat(this.sim.velocity, x, y, radius * 1.15, [vx, vy, 0, 0], false);
          if (bdens > 0) {
            this.sim.splat(this.sim.ink, x, y, radius * 0.8, this.getColorVector(bdens), false);
          }
        }
        break;
      }

      case BRUSH_TYPES.SPLATTER: {
        const radius = this.getBrushRadius(pr, speed) * 1.5;
        this.sim.brushFootprint.x = bx;
        this.sim.brushFootprint.y = by;
        this.sim.brushFootprint.r = radius;

        this.lastSplatterDist += dist;
        if (this.lastSplatterDist < radius * 0.3 && dist > 0.001) return;
        this.lastSplatterDist = 0;

        const count = Math.floor(4 + Math.random() * 8 + pr * 6);
        for (let i = 0; i < count; i++) {
          const angle = Math.random() * Math.PI * 2;
          const spread = Math.pow(Math.random(), 0.7) * radius;
          const dropX = bx + Math.cos(angle) * spread;
          const dropY = by + Math.sin(angle) * spread;
          const dropR = (0.001 + Math.random() * 0.0035) * this.getSizeMultiplier();
          const dropDens = 0.4 + Math.random() * 0.9;

          // Random droplet: some pure water, some ink droplets
          if (Math.random() < 0.75) {
            this.sim.splat(this.sim.ink, dropX, dropY, dropR, this.getColorVector(dropDens), false);
            this.sim.splat(this.sim.wet, dropX, dropY, dropR * 2.2, [0.35, 0, 0, 0], true);
          } else {
            this.sim.splat(this.sim.wet, dropX, dropY, dropR * 2.6, [0.6, 0, 0, 0], true);
          }
        }
        break;
      }
    }
  }
}
