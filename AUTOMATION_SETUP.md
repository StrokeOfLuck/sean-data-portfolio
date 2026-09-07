# Automated Senate data + site deploy — manual setup checklist

This repo and the sibling `senate-ptr-scraper` repo are wired up to scrape
Senate PTR data and rebuild/deploy this site automatically. A few steps
can only be done by you in the GitHub UI (not something an assistant can
do via local tools) — do these once to turn the automation on.

## 1. Push senate-ptr-scraper to GitHub

`senate-ptr-scraper` currently only exists as a local git repo. Create an
empty GitHub repo (no README/gitignore — it already has one), then:

```
cd "C:\Users\Sean\Documents\GitHub\senate-ptr-scraper"
git remote add origin https://github.com/StrokeOfLuck/senate-ptr-scraper.git
git push -u origin main
```

## 2. Allow senate-ptr-scraper's Action to push commits

In `senate-ptr-scraper` on GitHub: **Settings → Actions → General →
Workflow permissions** → select **"Read and write permissions"** → Save.

This lets the `scrape.yml` workflow commit updated data back to the repo
using the default `GITHUB_TOKEN`.

## 3. Create a token so the scraper can notify this site to rebuild

The scraper repo needs to trigger a build in *this* repo when new data
lands — that requires a Personal Access Token (the default `GITHUB_TOKEN`
can't act across repos).

1. GitHub → your profile → **Settings → Developer settings → Personal
   access tokens → Fine-grained tokens → Generate new token**.
2. Resource owner: your account. Repository access: **Only select
   repositories** → `sean-data-portfolio`.
3. Permissions: **Contents: Read and write** (this is what's needed to
   fire a `repository_dispatch` event).
4. Generate the token and copy it.
5. In `senate-ptr-scraper` → **Settings → Secrets and variables →
   Actions → New repository secret** → name it `SITE_DISPATCH_TOKEN`,
   paste the token value.

## 4. Enable GitHub Pages on this repo

**Settings → Pages** → Source: **Deploy from a branch** → Branch:
`gh-pages` / `(root)`. (The `deploy.yml` workflow here publishes to that
branch via `quarto-dev/quarto-actions/publish`.)

## 5. Trigger both workflows manually once, to validate

- In `senate-ptr-scraper` → **Actions → Scrape Senate PTRs → Run
  workflow**. Watch it scrape, commit data, and (if the token from step 3
  is set) fire a dispatch.
- In `sean-data-portfolio` → **Actions → Deploy site → Run workflow** (or
  just wait for the dispatch from the step above). Confirm the site
  builds and the Senate page shows real data.

## Notes

- The scraper runs daily at ~9:30am US Eastern (two cron entries handle
  the EDT/EST shift — see `senate-ptr-scraper/.github/workflows/scrape.yml`).
- The site also rebuilds weekly on its own schedule as a fallback, and on
  every push to `main`, in addition to the dispatch trigger.
- House data is read directly from `house-ptr-scraper/data/06_public/house_ptr_transactions_web.csv`.
  The deploy workflow checks out `house-ptr-scraper` before rendering, so the portfolio repo does not keep a
  second House CSV snapshot.
