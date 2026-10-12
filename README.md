# Inkwasher (墨洗) 🖌️

> **Pen-and-ink with living water — WebGL2 fluid watercolor studio for stylus and touch.**

🌐 **[Open Live App](https://anshumangaurav13.github.io/inkwasher/)**

<p align="center">
  <img src="./demo.png" alt="Artwork created with Inkwasher" width="600" />
  <br>
  <em>Artwork created directly in Inkwasher.</em>
</p>

---

## Highlights

- **Fluid watercolor physics** — ink flows, bleeds, and blooms naturally on wet paper.
- **Zero-latency stylus** — hardware unbuffered pipeline with pressure sensitivity and barrel toggles.
- **Fixed canvas (1600×1600)** — smooth 2-finger pan, pinch zoom, and rotate with palm rejection.
- **8 Brushes** — Dip Pen, Clear Water, Sumi Wash, Bleed, White Gouache, Splatter, Blender, Aquarelle Pencil.
- **GPU Undo / Redo** — instant texture snapshots (2-finger tap to undo).
- **Lossless export** — clean 1:1 full-resolution PNG download.
- **Installable PWA** — runs offline on Android tablets (S-Pen) and iPads (Apple Pencil).

---

## Shortcuts & Gestures

| Action | Control |
| :--- | :--- |
| **Select Brush** | Keys `1` through `8` or `P` |
| **Pan Canvas** | Hold `Space` + Drag or **2-Finger Drag** |
| **Zoom Canvas** | Hold `Ctrl + Space` + Drag or **2-Finger Pinch** |
| **Rotate Canvas** | Hold `R` + Drag or **2-Finger Twist** |
| **Reset / Fit View** | `Ctrl + 0` |
| **Undo / Redo** | `Ctrl + Z` / `Ctrl + Y` or **2-Finger Tap** |
| **Bake / Dry Layer** | Key `D` (fixes active ink permanently into paper) |
| **Export PNG** | Key `E` or `Ctrl + S` |
| **New Canvas** | Key `N` |

---

## Run Locally

```bash
git clone https://github.com/anshumangaurav13/inkwasher.git
cd inkwasher
npm start
```

Open `http://localhost:8080` (or the printed LAN IP on your tablet).

---

## License & Credits

- [MIT License](LICENSE) &copy; 2026 Anshuman Gaurav.
- Inspired by and derived from [John Whitaker's inkwash](https://github.com/johnowhitaker/inkwash).
