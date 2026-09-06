# Automate Senate PTR scraping + add a Senate page to the site

## Goal

1. Convert the manual Colab-based Senate PTR scraper into a fully automated
   pipeline that runs on GitHub Actions on a schedule (no more manual Colab
   runs).
2. Add a new "Senate" project page to `sean-data-portfolio`, mirroring the
   existing House PTR page, with a toggle to switch between House and
   Senate.
3. Automate the site build/deploy so it picks up fresh Senate data and
   publishes itself, instead of the current manual `quarto publish
   gh-pages` step.

## Key decisions confirmed with user

- **Scraping automation:** fully automated via GitHub Actions (no more
  manual Colab runs going forward). The Colab notebook stays as-is for
  manual/exploratory use, but a new plain Python script does the automated
  work.
- **Site deploy automation:** fully automated via GitHub Actions (replacing
  the manual `quarto publish gh-pages` workflow).
- **Data storage:** git-based, not Google Drive. The `senate-ptr-scraper`
  repo is the source of truth for scraped data; `sean-data-portfolio`'s
  build reads from it directly (no Google Drive API / service account
  needed).
- **Raw HTML:** the user wants to keep archiving raw per-filing HTML (not
  just the parsed CSV), and confirmed git (not Google Drive) for this too,
  after discussing the tradeoff. Rationale: routing raw HTML to Drive
  instead would require the *automated* GitHub Action to authenticate to
  the Drive API (service account + secret) — the same complexity avoided
  for the parsed CSV — so it wouldn't actually be simpler for the
  automated path. Estimated scale: ~100 senators with a handful of PTRs/
  year → roughly 1,000–3,000 electronic filings since 2021, growing by a
  few hundred/year; at ~50–150 KB per HTML page, a full backfill likely
  lands in the tens-of-MB to low-hundreds-of-MB range, comfortably under
  GitHub's ~1GB soft-warning threshold for the foreseeable future. Fallback
  options if it ever becomes a problem: Git LFS, or dropping HTML
  archiving from the automated path (the Colab notebook + Drive remain
  available separately for a manual personal archive, since that code path
  already mounts Drive).
- **Senate page structure:** a new, separate page
  (`projects/stock-disclosures-senate.qmd`) mirroring the House page's
  design, with a House ⇄ Senate toggle/switcher added to both pages (not a
  single page with in-page tabs).

## Architecture

```mermaid
flowchart LR
    subgraph SPS["senate-ptr-scraper repo"]
        A[scrape_senate_ptrs.py] --> B[data/ CSVs + raw HTML]
        C[.github/workflows/scrape.yml<br/>schedule + manual trigger] --> A
        C --> D[git commit + push data/]
        D --> E[repository_dispatch<br/>to sean-data-portfolio]
    end

    subgraph SDP["sean-data-portfolio repo"]
        F[.github/workflows/deploy.yml<br/>dispatch + schedule + manual] --> G[checkout both repos]
        G --> H[quarto render]
        H --> I[publish to gh-pages]
    end

    E --> F
```

Both repos already exist locally as sibling folders:
`C:\Users\Sean\Documents\GitHub\senate-ptr-scraper` and
`C:\Users\Sean\Documents\GitHub\sean-data-portfolio`. The website's Quarto
code will read Senate data from a relative sibling path
(`../senate-ptr-scraper/data/...`), and in CI we'll check out
`senate-ptr-scraper` into that same relative location so the exact same
relative path works both locally and in the GitHub Actions build.

## Important blocking issue discovered

`projects/stock-disclosures.qmd` currently reads the **House** data
directly from a local path: `G:/My Drive/Congressional Trading
Data/House_PTRs/07 Public Website Data/house_ptr_transactions_web.csv`.
This path does not exist on a GitHub Actions runner, so **the full site
cannot render in CI today** — it would fail on the House page before ever
reaching the new Senate page.

Fix (in scope for this plan, minimal version): copy the current House CSV
snapshot into the `sean-data-portfolio` repo (e.g.
`data/house_ptr_transactions_web.csv`) and update the R code to read from
that relative path instead. This is a one-time/manual-refresh copy for
now — full House automation (mirroring what we're building for Senate) is
explicitly **out of scope** for this plan, but the door is left open for a
future pass.

## Plan of work

### Phase 1 — Convert the notebook into an automation-friendly script
(`senate-ptr-scraper` repo)

- Add `scripts/scrape_senate_ptrs.py`, porting the logic from Cells 2 and
  5–10 of the notebook (session setup, filing-index search with the
  existing `MAX_SEARCH_PAGES` cap, electronic PTR parsing, transaction
  scraping/resume logic, status table).
- Replace the Drive-mount cell with plain local paths relative to the repo
  (`data/01_html/`, `data/02_filing_index/`, `data/03_transactions/`,
  `data/04_status/`), created via `Path.mkdir(parents=True, exist_ok=True)`.
- Config values (date range, batch size, request delay, `MAX_SEARCH_PAGES`)
  become script constants or env vars with sensible defaults, so the
  workflow can override them if needed (e.g. a shorter lookback window for
  routine runs vs. a full backfill).
- Add `requirements.txt` (`beautifulsoup4`, `lxml`, `openpyxl`, `pandas`,
  `requests`).
- Leave the existing notebook untouched for manual/Colab use; note in the
  README that the script is now the automated path and the notebook is for
  manual/exploratory runs.

### Phase 2 — Scraper GitHub Action
(`senate-ptr-scraper` repo)

- `.github/workflows/scrape.yml`:
  - Triggers: `schedule` (daily, default `06:00 UTC` — adjustable) and
    `workflow_dispatch` (manual runs).
  - Steps: checkout, set up Python, `pip install -r requirements.txt`, run
    `scripts/scrape_senate_ptrs.py`.
  - Commit step: if `git status` shows changes under `data/`, commit and
    push them (using the default `GITHUB_TOKEN`, which requires this repo's
    Settings → Actions → General → Workflow permissions set to "Read and
    write").
  - Final step: fire a `repository_dispatch` event
    (`senate-data-updated`) to `sean-data-portfolio` so its deploy workflow
    runs immediately after new data lands. Requires a **fine-grained
    Personal Access Token** with `contents: write` (or at least
    `actions: write`/dispatch permission) on `sean-data-portfolio`, stored
    as a secret (e.g. `SITE_DISPATCH_TOKEN`) in this repo. **User action
    required** — I can't create GitHub PATs or repo secrets myself.

### Phase 3 — Senate page on the website
(`sean-data-portfolio` repo)

- Add `projects/stock-disclosures-senate.qmd`, reusing the House page's
  structure/CSS (title block hidden, wide-shell layout, featured-card,
  DT table, etc.) so the two pages feel like one product.
- Data is read from `../senate-ptr-scraper/data/03_transactions/<file>.csv`
  (exact filename to match whatever Phase 1's script writes).
- Add a small "House / Senate" toggle control (two linked buttons) near the
  top of both `stock-disclosures.qmd` and the new Senate page, so users can
  jump between chambers. Kept as a simple shared HTML/CSS snippet rather
  than a new nav dropdown, to match the existing page's self-contained
  style.

### Phase 4 — Fix the House data path for CI
(`sean-data-portfolio` repo)

- Copy the current House transactions CSV into
  `data/house_ptr_transactions_web.csv` in this repo.
- Update the R chunk's `data_path` to the relative path.
- Note in the README that this is a manual snapshot for now (refresh by
  re-copying from Drive) until/unless House scraping is automated the same
  way Senate is.

### Phase 5 — Site deploy GitHub Action
(`sean-data-portfolio` repo)

- `.github/workflows/deploy.yml`:
  - Triggers: `repository_dispatch` (type `senate-data-updated`),
    `schedule` (weekly fallback), `push` to `main`, and `workflow_dispatch`.
  - Checkout this repo, then checkout `senate-ptr-scraper` into the sibling
    path `../senate-ptr-scraper` (via `actions/checkout`'s `repository` +
    `path` inputs).
  - Set up R (for the existing `readr`/`dplyr`/`DT`/`jsonlite` chunks) and
    Python (if other project pages need it — to be confirmed while
    auditing all `projects/*.qmd` engines).
  - Install R/Python dependencies, run `quarto render`, then publish the
    rendered `_site/` to the `gh-pages` branch (via the
    `quarto-dev/quarto-actions` publish action).
- **User action required:** confirm GitHub Pages is configured to serve
  from the `gh-pages` branch (Settings → Pages), matching the existing
  manual `quarto publish gh-pages` setup.

### Phase 6 — Validation

- Trigger both workflows manually (`workflow_dispatch`) once set up, before
  relying on the schedules, to confirm: the scraper runs and commits data,
  the dispatch fires, and the site renders + deploys correctly with both
  House and Senate pages live.

## Manual steps only the user can do (not tool-accessible to me)

- Push `senate-ptr-scraper` to a GitHub remote (repo doesn't exist on
  GitHub yet — only pushed locally so far).
- Create a fine-grained PAT for cross-repo `repository_dispatch` and add it
  as a secret in `senate-ptr-scraper`.
- Set `senate-ptr-scraper`'s Actions workflow permissions to "Read and
  write" so the scrape workflow can push commits.
- Confirm/enable GitHub Pages on `sean-data-portfolio` serving from
  `gh-pages`.

## Sequencing decision: Senate first, House as a follow-on project

The user asked whether to automate House PTRs now alongside Senate, or do
Senate first. Investigated the House pipeline
(`G:\My Drive\Congressional Trading Data\House_PTRs\06 Workflow
Notebooks`) to inform this:

- **House has 4 stages, not 1:** (1) download PDFs from the Clerk's XML
  index, (2) archive indexes + verify PDF completeness, (3) extract
  transactions from born-digital PDFs via a hand-built PyMuPDF
  geometry/table parser (~4,900 lines — by far the most complex piece of
  either pipeline), (4) clean/resolve ticker symbols. A 5th notebook is
  just an orchestrator that runs 1–4 in sequence.
- **No GPU/OCR/ML dependencies** in the current House pipeline (good — it
  can run on standard GitHub Actions runners like Senate can), but
  scanned/image-only PDFs are explicitly deferred to an unimplemented
  future OCR/vision stage — out of scope for now, same as House's own
  notebooks already treat it.
- **Data scale:** PDF archive ~200–350MB across 2021–2026 (~3,000 files),
  parsed CSVs under 100MB combined — still git-friendly, but notably
  larger than Senate's HTML archive, and stage 3's complexity means
  porting it to an automation-friendly script is a bigger lift than
  Senate's single script.

**Decision: implement the Senate plan above first.** It's fully scoped,
much simpler to port (one script vs. four stages), and will validate the
whole automation pattern (scheduled scraping → git commit → cross-repo
`repository_dispatch` → automated Quarto deploy) end-to-end. Once that's
working reliably, House automation becomes a second, separate plan that
reuses the same pattern:

- A `house-ptr-scraper` repo (or a `house/` scope within the same repo —
  to be decided later) with 3–4 scripts mirroring stages 1/2/3/4, each with
  its own scheduled or chained GitHub Action (stage 3's PDF parsing may
  need its own resumable-checkpoint-aware workflow given it's the heaviest
  step).
- The same question Senate faced — commit raw PDFs to git, or not — will
  come up again for House, with a similar-in-kind but larger tradeoff
  (~250-400MB vs. Senate's tens-of-MB estimate). Not deciding this now;
  revisit when House is actually planned.
- A `stock-disclosures-house` page swap-in once House data is also
  automated (the House ⇄ Senate toggle built in Phase 3 above will make
  this a small addition later, not a redesign).

This plan file covers **Senate only**. House automation will get its own
plan once Senate is implemented and validated.

## Open items to confirm before/while implementing

- Exact scrape schedule cadence (defaulting to daily — say if you'd prefer
  weekly or another cadence).
- Whether the initial backfill (2021→today, potentially thousands of
  filings) should run once manually/locally first (to avoid a very long
  first Actions run against the Senate's rate limits) versus letting the
  first scheduled Action run do the full backfill.

---

# House PTR Automation Plan

(Written after the Senate pipeline above was implemented, validated end to
end, and is live at
https://strokeofluck.github.io/sean-data-portfolio/projects/stock-disclosures-senate.html.
This section covers House only.)

## Major discovery: a working local port already exists

Before finalizing this plan, found an existing local repo at
`C:\Users\Sean\Documents\GitHub\house-ptr-pipeline` (git remote:
`https://github.com/StrokeOfLuck/house-ptr-pipeline.git`, 2 commits, last
committed the same evening this session started). It is **not** a stub —
it's a complete, faithful local-first Python port of all 5 Colab
notebooks, already restructured into clean stage scripts:

```
house-ptr-pipeline/
├── notebooks/            (the original 5 .ipynb files, preserved as-is)
├── src/
│   ├── config.py         (central path/year config, env-var overridable)
│   ├── stage1_download.py
│   ├── stage2_verify.py
│   ├── stage3_extract.py   (3,161 lines — parse_pdf_geometry_v8 and helpers)
│   ├── stage4_clean.py     (659 lines — ticker resolver)
│   └── publish_latest.py   (already writes house_ptr_transactions_web.csv!)
├── run_pipeline.py       (orchestrator with --from-stage flag)
├── requirements.txt      (requests, pandas, openpyxl, PyMuPDF, xlsxwriter, numpy)
├── docs/NEXT_GITHUB_ACTIONS.md  (already scopes out GitHub Actions next steps)
└── README.md
```

Verified by reading `config.py`, `stage1_download.py`, `stage2_verify.py`,
the top of `stage3_extract.py`/`stage4_clean.py`, and all of
`publish_latest.py`:

- **The "undocumented web CSV" gap flagged earlier is already closed.**
  `publish_latest.py` already copies the V8.2 CSV to a stable
  `house_ptr_transactions_latest.csv`, writes a trimmed
  `house_ptr_transactions_web.csv` with a superset of the columns
  `stock-disclosures.qmd` actually reads, sorted newest-first, plus a
  `house_ptr_metadata.json` (row/column counts, accounted-for/fallback PDF
  counts, timestamp). No new "Stage 5" needs to be written — it already
  exists and matches the plan's intent almost exactly.
- **Resumability/config already match what was planned**: `SAVE_EVERY =
  10`, `MAX_NEW_PDFS_THIS_RUN = None` (chunk-size knob, currently unset),
  `RESET_V8 = False` hardcoded (not env-overridable — already safe by
  default).
- **Current storage model still points at Google Drive**: `config.py`'s
  `DEFAULT_ROOT` is `G:\My Drive\Congressional Trading Data\House_PTRs`,
  overridable via `HOUSE_PTR_ROOT` env var. `docs/NEXT_GITHUB_ACTIONS.md`
  explicitly flags "Google Drive authentication" as the remaining
  cloud-specific piece it expects to need.
- **Planned deviation from that doc**: per the Senate precedent, this plan
  uses git-based storage instead of Google Drive API auth — no service
  account, no Drive credentials in CI. `HOUSE_PTR_ROOT` gets pointed at a
  local `data/` folder inside the repo instead of the `G:` drive, and that
  folder is seeded once with the existing archive (same reasoning as
  Senate: avoids a second, unrelated auth mechanism for the automated
  path).
- **Stage 2 does not yet have the audit improvements discussed** (no
  cross-reference against Stage 3's checkpoint outcomes, no machine-
  readable summary) — those are still worth adding.
- Config folder names still use the original spaced-out Drive-style names
  (`"01 Official House PTR PDFs"`, etc.) and filenames still carry the
  `V8_1`/`V8_2`/`2021_2026` suffixes baked in via `YEAR_LABEL`.

**This substantially shrinks the remaining work** from "port 5 notebooks"
down to "adjust config for git-based storage, apply the naming cleanup,
improve Stage 2, and add the GitHub Action" — the parsing/business logic
itself is already done and doesn't need to be touched.

## Rename request

User wants this repo renamed **`house-ptr-pipeline` → `house-ptr-scraper`**,
matching `senate-ptr-scraper`'s naming. Two parts:

1. **Local folder rename** (tool-doable): rename
   `C:\Users\Sean\Documents\GitHub\house-ptr-pipeline` →
   `...\house-ptr-scraper`. Git itself doesn't care about the local folder
   name matching the remote's name, so this is safe to do independently.
2. **GitHub repo rename** (user must do this — no tool/API access to the
   user's GitHub account for repo administration): Settings → General →
   Repository name → `house-ptr-scraper`. GitHub automatically redirects
   the old name for both git operations and web/API access, so this is
   low-risk and doesn't strictly have to happen before the local rename or
   before pushing — but should be done for consistency, and the local
   `origin` remote URL should be updated afterward
   (`git remote set-url origin https://github.com/StrokeOfLuck/house-ptr-scraper.git`)
   even though the redirect means it isn't strictly required.

All references in this plan below use `house-ptr-scraper` as the final
name.

## Key decisions confirmed with user

- **Seed with existing data**: yes — same reasoning as Senate.
- **Stage 2 (completeness audit)**: runs every time, alongside stages
  1/3/4/publish.
- **Schedule**: daily at ~9:30am US Eastern. `docs/NEXT_GITHUB_ACTIONS.md`
  already scopes this using GitHub Actions' IANA-timezone cron syntax
  (`schedule: - cron: "30 9 * * *"` with `timezone: "America/New_York"`),
  which is cleaner than the two-cron-entry DST workaround used for
  Senate's workflow (that feature wasn't used for Senate simply because it
  wasn't known about yet at the time) — use the timezone-aware single-cron
  syntax for House, and consider back-porting it to Senate's workflow
  later as a small cleanup.
- **Clean up naming**: still applies — see below. Only filenames/folder
  layout change; column names inside CSVs stay exactly as the existing
  scripts already produce them (Stage 4's resolver and the website depend
  on specific column names).
- **Improve the completeness audit**: still applies — see below.

## Stage 2 audit improvements (still to be made)

1. Cross-reference Stage 3's checkpoint (`source_key` column) so the audit
   flags PDFs that exist but came back `needs_fallback`/had a
   `geometry_error`, not just files that are missing outright.
2. Emit a machine-readable summary (JSON or CSV) alongside the existing
   Excel workbook, so the GitHub Action can act on regressions (annotate
   the run, or fail loudly if missing/error counts increase run-over-run)
   instead of the audit being Excel-only/human-only.

## Proposed clean naming convention

Mirroring `senate-ptr-scraper`'s `data/0N_*` folder convention. Requires
changing `config.py`'s path constants (folder names and the
`V8_1`/`V8_2`/`YEAR_LABEL`-suffixed filenames) — the stage scripts
themselves import everything from `config.py`, so this is a single-file
change plus a data-migration/rename pass, not a rewrite of stage logic:

```
house-ptr-scraper/
├── src/                  (existing stage scripts, adjusted per above)
├── data/
│   ├── 01_pdfs/<year>/<doc_id>.pdf
│   ├── 02_xml_indexes/<year>.xml
│   ├── 03_verification/<year>.xlsx + completeness_summary.json
│   ├── 04_transactions/
│   │   ├── transactions_raw.csv       (was PTR_transactions_GEOMETRY_V8_1_...)
│   │   ├── transactions_resolved.csv  (was ..._V8_2_...)
│   │   └── needs_fallback.csv
│   ├── 05_status/checkpoint.csv
│   └── 06_public/
│       ├── house_ptr_transactions_web.csv     (site reads this)
│       ├── house_ptr_transactions_latest.csv
│       └── house_ptr_metadata.json
├── notebooks/            (kept as historical reference, unchanged)
├── run_pipeline.py
├── requirements.txt
└── README.md
```

## Plan of work

### Phase 1 — Rename
- Rename the local folder `house-ptr-pipeline` → `house-ptr-scraper`.
- User renames the GitHub repo to match; update the `origin` remote URL
  locally afterward.

### Phase 2 — Convert to git-based storage + apply naming cleanup
- Update `config.py`: `DEFAULT_ROOT` becomes a local `data/` path relative
  to the repo instead of the `G:` drive path; drop `HOUSE_PTR_ROOT`
  Drive-specific framing (env override can stay for flexibility, just
  pointed at something sensible by default).
- Rename folders/files per the clean convention above. Update all path
  constants in `config.py` accordingly — stage scripts don't need direct
  changes since they import paths from `config.py`.
- Seed `data/` by copying the existing PDF archive, XML indexes,
  transaction CSVs, checkpoint, and public outputs from Drive into the new
  layout (renaming files per convention, not touching column contents).

### Phase 3 — Improve Stage 2
- Add the checkpoint cross-reference and JSON/CSV summary output described
  above.

### Phase 4 — GitHub Action
- `.github/workflows/scrape.yml`: runs `run_pipeline.py` (all stages) daily
  using the timezone-aware single-cron schedule from
  `docs/NEXT_GITHUB_ACTIONS.md` (`cron: "30 9 * * *"` +
  `timezone: "America/New_York"`), plus `workflow_dispatch`. Sets
  `MAX_NEW_PDFS_THIS_RUN` to a conservative default (e.g. 100–300) as a
  safety chunk size for incremental runs. Commits `data/` changes,
  dispatches `sean-data-portfolio` to rebuild (reusing the same
  `SITE_DISPATCH_TOKEN` pattern/secret as Senate).

### Phase 5 — Wire up the website
- Update `stock-disclosures.qmd`'s `data_path` to the same dual-candidate
  pattern used for Senate (tries the local sibling path and the CI nested
  `house-ptr-scraper/` checkout path), pointing at
  `data/06_public/house_ptr_transactions_web.csv`.
- Remove or keep-as-fallback the static `data/house_ptr_transactions_web.csv`
  snapshot in `sean-data-portfolio` (open item below).
- Update `deploy.yml` to also checkout `house-ptr-scraper` (`path:
  house-ptr-scraper`, avoiding the `..`-escape bug already discovered with
  Senate).

### Phase 6 — Validation
- Run the pipeline locally once against the new git-based `data/` path to
  confirm the seeded archive round-trips correctly (should mostly no-op
  since everything is already checkpointed/computed).
- Trigger the GitHub Action manually; confirm it correctly no-ops on the
  seeded PDFs and only processes genuinely new filings.
- Trigger/verify the site deploy picks up House data via the new path and
  renders identically to today's static-snapshot version.

## Manual steps only the user can do

- Rename the GitHub repo `house-ptr-pipeline` → `house-ptr-scraper`.
- Make it **public** (same reason as Senate — the deploy workflow's
  default token can't check out a private repo it doesn't own).
- Set its Actions workflow permissions to "Read and write."
- Add the `SITE_DISPATCH_TOKEN` secret (can reuse the same PAT created for
  Senate, since it's already scoped to `sean-data-portfolio`).

## Open items to confirm before/while implementing

- Confirm the exact `MAX_NEW_PDFS_THIS_RUN` default once real day-to-day
  new-filing volume is observed (starting conservative, e.g. 100).
- Whether to keep the static House CSV snapshot as a fallback in
  `sean-data-portfolio` or remove it entirely once the automated pipeline
  is proven (leaning toward keeping the graceful fallback, matching
  Senate's page).
- Confirm GitHub Actions' `timezone:` field on `schedule` works as
  expected on first real run (it's a relatively recent feature) — fall
  back to Senate's two-cron-entry approach if not.
