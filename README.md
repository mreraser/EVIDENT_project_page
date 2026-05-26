# SlotVTG — Project Page

Static site for **SlotVTG: Object-Centric Adapter for Generalizable Video Temporal Grounding** (CVPR 2026).

This page is designed to be hosted on **GitHub Pages**. Drop the repo at
`https://github.com/<your-org>/slotvtg-page` and enable Pages from the `main` branch.

## Local preview

The page is a single-file static site. No build step needed.

```bash
# from the repo root
python3 -m http.server 8000
# then open http://localhost:8000
```

Or just open `index.html` in a browser. (Some browsers block local font/CDN
fetches via `file://` — the `http.server` approach is safer.)

## Structure

```
.
├── index.html                 # main page
├── README.md
├── LICENSE
├── SlotVTG_camera_ready.pdf   # add the PDF here so the "Paper" button works
└── static/
    ├── css/
    │   └── style.css          # custom styles (Tailwind via CDN handles the rest)
    └── js/
        ├── slot-animation.js  # the hero slot-decomposition canvas animation
        └── main.js            # nav, BibTeX copy, slot visualization grid
```

## Customization checklist

Before you publish, swap these placeholders:

- [ ] Author links — currently all `href="#"`. Wire them to Google Scholar / personal sites.
- [x] arXiv link wired to `https://arxiv.org/abs/2603.25733`.
- [ ] GitHub button — still says *"soon"*. Replace once the code release is public.
- [x] `SlotVTG_camera_ready.pdf` — already dropped beside `index.html` so the Paper button resolves.
- [ ] BibTeX `year` and venue — already set to CVPR 2026, double-check after acceptance details finalize.
- [ ] Replace the procedural slot-visualization grid (the section *"What do the slots actually learn?"*) with the real `Fig. 4` images from the paper. The procedural rendering is a placeholder — drop your real PNGs at `static/figures/slot_vis_<scene>_<slot>.png` and adjust `main.js`.

## How the slot decomposition animation works

The hero canvas at the top of the page (`static/js/slot-animation.js`) renders a
**6-phase loop** that mirrors the SlotVTG pipeline:

| Phase | Name | What you see |
|-------|------|--------------|
| 0 | scene     | Stylized video frame fades in (alternates between indoor/outdoor scenes) |
| 1 | tokenize  | 8×8 = 64 visual tokens overlay the frame |
| 2 | compete   | Tokens flicker between 4 slot colors over 3 iterations of slot attention; thin lines fly between tokens and slot orbs |
| 3 | assign    | Tokens settle to their dominant slot color |
| 4 | recon     | Four mini-panels light up, each showing the tokens that belong to that slot — the entity-aware reconstruction |
| 5 | hold      | Final state held briefly before looping |

The classification of which token belongs to which slot is the ground-truth
decomposition baked into each `SCENE` object — you can plug in real attention
maps later by replacing `softAt()` and `dominantSlot()`.

## Credits

- Page skeleton inspired by the [Nerfies template](https://nerfies.github.io/) by Keunhong Park et al.
- Slot decomposition animation and styling crafted for this project.
- Built with [Tailwind CSS](https://tailwindcss.com/) (CDN), [Font Awesome](https://fontawesome.com/), and [Academicons](https://jpswalsh.github.io/academicons/).

## License

Page content under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). See `LICENSE`.
