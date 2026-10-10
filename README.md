# EVIDENT: Project Page

Static site for **EVIDENT: Routing MLLM Adaptation through Entity-Grounded Visual Evidence for Cross-Domain Video Temporal Grounding** (NeurIPS 2026).
An earlier version of this work, SlotVTG, appeared at the CVPR 2026 GRAIL Workshop.

Live page: https://mreraser.github.io/EVIDENT_project_page/

## Local preview

No build step. Serve the folder and open it in a browser:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Opening `index.html` directly also works, but some browsers block local font and CDN requests over `file://`.

## Deployment

Pushing to `main` runs `.github/workflows/pages.yml`, which uploads the folder to GitHub Pages without Jekyll (`.nojekyll` is kept for the same reason).
If a deploy fails for a transient network reason, re-run the job from the Actions tab.

## Structure

```
.
├── index.html
├── static/
│   ├── css/style.css
│   ├── figures/                 # paper figures, README thumbnail, animation frames (anim/)
│   └── js/
│       ├── evident-animation.js # "How EVIDENT works" pipeline animation
│       ├── gains-chart.js       # animated OOD gains bar chart (Results)
│       └── main.js              # nav, BibTeX copy, lightbox, scroll reveal
└── .github/workflows/pages.yml
```

## Credits

- Page skeleton inspired by the [Nerfies template](https://nerfies.github.io/).
- Built with [Tailwind CSS](https://tailwindcss.com/) (CDN), [Font Awesome](https://fontawesome.com/) and [Academicons](https://jpswalsh.github.io/academicons/).

## License

Page content under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). See `LICENSE`.
