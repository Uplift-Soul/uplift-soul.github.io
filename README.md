# INVST Gaming

**Twitch category intelligence — live viewership, audience concentration, and historical trends.**

🔗 **Live:** https://invstgaming.co.uk

INVST Gaming tracks the top categories (games) on Twitch: who's being watched right
now, how top-heavy each category is, and how viewership has shifted over time. A
Raspberry Pi collects snapshots every ~3 hours and publishes them as JSON to a static
site on GitHub Pages.

## Pages

- **Overview** (`/`) — headline KPIs, a per-category viewership trend (daily peak,
  7-day smoothed), and top-10 concentration over time.
- **Live** (`/live`) — the latest snapshot's top categories (ranked by Twitch), the
  streamers behind each, and a *fragility* ranking (how much a category leans on its
  top 10 streamers).
- **Trending** (`/trending`) — the **Breakout Tracker**: newly released games (per IGDB,
  shipped in the last ~12 months) breaking into the top 50 for the first time. Each week
  drafts that week's top new entrants and then follows them week by week, so you can see
  whether each one keeps climbing or fades out.
- **Historical** (`/historical`) — category rank changes month to month, and the
  biggest viewership risers/fallers (current month-to-date vs the same dates two
  years earlier).

## Architecture

```
Twitch Helix API
      │  every ~3h (cron on a Raspberry Pi)
      ▼
  collector ──► PostgreSQL ──► publish.py ──► *.json
                                              │  git commit + push
                                              ▼
                                  GitHub Pages (Actions) ──► invstgaming.co.uk
```

- A **collector** queries Twitch's Helix API (top 50 categories + their streams) and
  writes snapshots into **PostgreSQL** on the Pi.
- **`publish.py`** reads the database and emits the JSON the frontend consumes, then
  commits and pushes.
- The **frontend** is vanilla HTML/CSS/JS (no build step) plus Chart.js. It fetches
  the JSON and auto-refreshes every 90 seconds.
- **Deployment** is a GitHub Actions workflow (`.github/workflows/deploy.yml`) with
  `cancel-in-progress`, so the frequent data pushes never jam the deploy queue.

> The collector and `publish.py` run only on the Pi and are **gitignored** (they hold
> database/API credentials), so they are not part of this repository.

## Data & methodology

- **Everything is concurrent viewers.** Twitch's API reports how many people are
  watching at the moment of each snapshot — there is no "hours watched" or unique-
  viewer figure.
- **Trends and movers use the daily _peak_** (the busiest moment each day), not a flat
  average. The pre-2026 archive only sampled ~09:00–23:00 while the live feed samples
  24/7, so a daily average makes the live era read artificially low. Both eras
  reliably capture the evening peak, so peak-to-peak is a fair comparison.
- **Concentration / fragility** is a ratio: a category's top-10 streamers' viewers ÷
  its total viewers.
- **New entrants (Breakout Tracker)** use game **release dates from IGDB** (Twitch's own
  game database, queried with the same Twitch credentials). A "new entrant" is a game
  released within the last ~12 months that breaks into the top 50 *and* wasn't already
  present when live collection began — which keeps perennials and annual franchises out
  automatically. Each week's top new entrants are then tracked forward by their weekly
  average daily peak. Release dates are looked up once and cached.
- The collector captures the **top 50 categories** per snapshot; the dashboard
  surfaces the top 20.

## Tech stack

- **Frontend:** HTML, CSS, vanilla JS, [Chart.js](https://www.chartjs.org/) (+ date-fns
  adapter), hosted on GitHub Pages.
- **Backend (on the Pi):** Python (`requests`, `psycopg2`), PostgreSQL, cron.
- **Data sources:** Twitch Helix API (snapshots) + [IGDB](https://www.igdb.com/) (game
  release dates, via the shared Twitch OAuth credentials).

## Repository structure

```
.
├── index.html            # Overview
├── live.html             # Live
├── trending.html         # Trending (Breakout Tracker)
├── historical.html       # Historical
├── assets/               # css · js · images
│   ├── style.css
│   ├── common.js
│   ├── favicon.svg
│   └── og.png
├── *.json                # data published by the Pi (overview / live / history / trending / data)
├── .github/workflows/    # GitHub Pages deploy
├── CNAME                 # custom domain
├── LICENSE
└── README.md
```

## Local development

It's a static site — just serve the folder:

```bash
python -m http.server 8000
# open http://localhost:8000
```

Clean URLs (`/live`, `/trending`, `/historical`) are a GitHub Pages feature; locally use
the `.html` form (`/live.html`).

## Conventions

- **Clean URLs** — link internally without `.html` (`/live`, not `live.html`). A new
  page must link clean *and* be registered in the `common.js` command palette.
- **Cache busting** — bump the `?v=N` query on `assets/style.css` / `assets/common.js`
  whenever they change.
- **Deploy** — every push to `main` triggers the Pages Actions workflow.

## License

[MIT](LICENSE) © 2026 Upliftsoul

---

Contact: invstgaming@gmail.com
