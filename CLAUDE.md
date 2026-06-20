# CLAUDE.md

Canonical reference for AI assistants (and contributors) working in this repo.

## What this is
**INVST Gaming** (https://invstgaming.co.uk) — a static GitHub Pages dashboard of Twitch
*category intelligence*: live viewership, audience concentration, new-game breakouts, and
publisher/franchise "attention share". **No build step** — plain HTML/CSS/JS + Chart.js (CDN).

## Pages (clean URLs)
- `/` — **landing hub**: short intro + clickable page cards with live teaser stats, then
  KPIs + viewership trend + concentration ("At a glance").
- `/live` — current top categories, top-10 streamers behind each, and a *fragility* ranking
  (how much a category leans on its top 10 streamers).
- `/trending` — **Breakout Tracker**: newly released games (per IGDB, ~last 12 months)
  breaking into the top 50, drafted the week they arrive and tracked week by week.
- `/publishers` — publisher & franchise **attention share** + weekly gainers/losers, with
  publisher logos.
- `/historical` — monthly category rank changes (bump chart) + biggest movers.

## How it works
```
Twitch Helix API + IGDB ──(cron ~3h, on a Raspberry Pi)──► PostgreSQL ──► publish.py ──► *.json
                                                                              │ git commit + push
                                                                              ▼
                                                            GitHub Pages (Actions) → the site
```
- A **collector** writes Twitch snapshots (top 50 categories + their streams) into Postgres.
- **`publish.py`** reads the DB, enriches games with IGDB metadata (release date, publisher,
  franchise, company logo), and writes the per-page JSON the frontend fetches
  (`overview.json`, `live.json`, `history.json`, `trending.json`, `publishers.json`, plus a
  full `data.json` fallback).
- **The collector and `publish.py` are gitignored and run only on the Pi** — they are NOT in
  this repo. Don't look for them here; they're deployed to the Pi out-of-band.

## Data methodology
- Everything is **concurrent viewers** (Twitch's API has no hours-watched / unique figure).
- Trends and movers use the **daily peak** (busiest moment each day), not a flat average:
  the pre-2026 archive only sampled ~09:00–23:00 while the live feed samples 24/7, so
  peak-to-peak is the fair comparison and avoids a false step at the archive→live gap.
- The collector captures the **top 50** categories per snapshot; the dashboard surfaces 20.
- A **"new entrant"** = a game **released in the last ~12 months** (per IGDB) that breaks
  into the top 50 *and* wasn't present when live collection began — this cleanly excludes
  perennials and annual franchises that were already there.

## Frontend conventions
- **No build step.** Shared helpers + the ⌘K command palette live in `assets/common.js`;
  all styles in `assets/style.css`; each page's render logic is inline in its HTML file.
- **Clean URLs** — link internally without `.html` (`/live`, not `live.html`). A new page
  must: link clean in every nav block, set its `og:url`, and register in the `PAGES` array
  in `common.js`.
- **Cache-busting** — bump the `?v=N` on `assets/style.css` / `assets/common.js` (on **every**
  page) whenever you change them, or browsers serve stale assets and pages break.
- `loadData(slice)` fetches a page's JSON slice and falls back to `data.json` if absent.
- Analytics: GA4 (`gtag.js`) is installed once in `common.js`; custom events
  `hub_card_click` / `nav_click`.

## Deploy
- **Site**: every push to `main` triggers the Pages GitHub Actions workflow
  (`.github/workflows/deploy.yml`, with `cancel-in-progress`). Data is pushed automatically
  by the Pi's cron; frontend changes are pushed manually.
- **Backend** (`publish.py`) is deployed to the Pi separately (it's gitignored).

## Working with this repo
- **Brief the plan and get explicit go-ahead before edits, commits, or deploys.**
- **Verify** UI changes by serving locally (`python -m http.server`) and screenshotting with
  headless Chrome before and after deploying.
- Backend/Pi access details and credentials are kept in the maintainer's private notes, not
  in this public repo.
