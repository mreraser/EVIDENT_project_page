# EVIDENT — Project Page

Static site for **EVIDENT: Routing MLLM Adaptation through Entity-Grounded Visual Evidence for Cross-Domain Video Temporal Grounding** (NeurIPS 2026). An earlier version, SlotVTG, appeared at the CVPR 2026 GRAIL Workshop.

This repo ships with a custom GitHub Actions workflow that deploys the static
site to GitHub Pages *without* going through Jekyll &mdash; faster and more
reliable than the default branch-based deploy.

## Local preview

The page is a single-file static site. No build step needed.

```bash
# from the repo root
python3 -m http.server 8000
# then open http://localhost:8000
```

Or just open `index.html` in a browser. (Some browsers block local font/CDN
fetches via `file://` &mdash; the `http.server` approach is safer.)

## Deploying to GitHub Pages

1. Push this repo to GitHub (`main` branch).
2. **Repo &rarr; Settings &rarr; Pages &rarr; Build and deployment**:
   - **Source**: choose **"GitHub Actions"** (not "Deploy from a branch").
3. The included `.github/workflows/pages.yml` workflow will run automatically.
4. After the workflow finishes (~30s), your site is live at
   `https://<your-username>.github.io/<repo-name>/`.

### Why a custom workflow?

The default "Deploy from a branch" option triggers `actions/jekyll-build-pages`,
which sometimes fails with a transient
`codeload.github.com … could not be found` error and is unnecessary for a plain
static site. The included `pages.yml` skips Jekyll entirely (the `.nojekyll`
marker file also signals this) and uses
`actions/upload-pages-artifact` + `actions/deploy-pages` directly.

### Re-running a failed deploy

If a deploy fails (transient network issue), open the Actions tab on GitHub,
click the failed run, and hit **"Re-run all jobs"**. No code change needed.

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
