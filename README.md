# Sean Ryan — Data Portfolio

Source for [strokeofluck.github.io/sean-data-portfolio](https://strokeofluck.github.io/sean-data-portfolio/), a Quarto
website showcasing data journalism, digital investigations, and civic technology work, currently focused on
politician stock disclosures, public-records data pipelines, and computational political text analysis.

## Structure

- `index.qmd` — homepage / project grid
- `about.qmd` — about page
- `cv.qmd` — resume page, rendered from `data/resume.yml` (see below)
- `projects/*.qmd` — one page per project
- `data/` — small site-owned data files committed directly to the repo (currently `resume.yml`)
- `styles.css` — shared site styling
- `_quarto.yml` — site/nav configuration

The stock-disclosure project pages pull their data directly from the sibling scraper repositories
(`house-ptr-scraper` and `senate-ptr-scraper`) at render time. Those scraper repos are the data sources of truth;
the portfolio repo does not keep duplicate PTR snapshots.

## Editing the resume

The resume page's content lives entirely in [`data/resume.yml`](data/resume.yml) — name, contact info, summary,
experience, volunteer work, projects, education, and skills. Routine updates (a new job, a new bullet, a link fix)
only require editing that file, not `cv.qmd`'s HTML/CSS.

**Quickest way to edit:** open the file directly in GitHub's web editor —
[github.com/StrokeOfLuck/sean-data-portfolio/edit/main/data/resume.yml](https://github.com/StrokeOfLuck/sean-data-portfolio/edit/main/data/resume.yml)
— make changes, and commit. Pushing to `main` automatically triggers a rebuild and redeploy (see below). There's
also an "Edit this resume" link on the live resume page itself that goes straight there.

Only touch `cv.qmd` for structural/layout changes (new section types, styling, the print/PDF stylesheet).

## Local preview

```bash
quarto preview
```

## Deployment

Pushing to `main` triggers [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), which renders the site
with Quarto and publishes it to the `gh-pages` branch (GitHub Pages). No manual `quarto publish` step is needed.
