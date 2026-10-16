# Changelog

All notable changes to the INVST Gaming frontend are recorded here.
Format follows [Keep a Changelog](https://keepachangelog.com/); versions are
[semantic](https://semver.org/) and mirrored as annotated git tags.

## How versions are kept

- Every release is an **annotated git tag** (`vMAJOR.MINOR.PATCH`) on the commit
  that shipped it — the canonical way to retrieve a past build.
  - See tags: `git tag -l`
  - Inspect one: `git show v1.0.0`
  - Browse a past build without disturbing `main`: `git checkout v1.0.0`
    (return with `git checkout main`)
  - Restore a single file from a past build: `git checkout v1.0.0 -- assets/style.css`
- **MAJOR** = a redesign / breaking visual overhaul, **MINOR** = new page or
  feature, **PATCH** = fixes and tweaks.
- The site deploys from `main` on every push (GitHub Pages Actions), so a tag is a
  stable pointer to "what was live" at that moment.

---

## [2.4.0] — 2026-10-16 — Review fixes

### Fixed
- **Trending lede + hub teaser no longer show dropped-out games** as the
  "strongest new entrant this week" — games marked `dropped` are excluded (their
  `latest` figure is from an old week).
- **Dates no longer shift a day/month for visitors west of GMT.** Date-only JSON
  strings are UTC midnight; the Concentration and bump-chart month labels, the
  Historical movers caption and the Trending week headings now format in UTC.
- **Historical masthead** shows the real span of the rankings data instead of a
  hard-coded "Mar 2024 – Jun 2025".
- Live: restoring the expanded category after an auto-refresh no longer fires a
  spurious `category_expand` analytics event.
- Data from Twitch/IGDB is now escaped in the chart category chips and the
  load-error message (the remaining unescaped `innerHTML` sinks).
- `loadData` only updates the chart-focus ranking / palette list from slices that
  carry `current`, so side fetches can't wipe them.
- Consent banner on mobile was ~350px tall (the message's 280px row flex-basis
  became a height once the banner stacked); now sized to its content.
- Links inside section captions (`.cap a`) use the accent colour instead of
  browser-default blue.

### Added
- **"Privacy settings" footer link** on every page reopens the consent banner;
  declining after accepting revokes analytics consent and clears GA cookies.
- **⌘K palette accessibility**: focus is kept in the dialog and restored on close;
  combobox/listbox ARIA with `aria-activedescendant` / `aria-selected`.
- `404.html`, `robots.txt` and `sitemap.xml`.

### Changed
- Auto-refresh pauses while the tab is hidden and checks once when it's shown again.
- Removed the unreachable Chart.js legend click/mobile-legend code (the legend is
  hidden on every chart; the chips handle series toggling).
- Cache-bust bumped (`style.css?v=25`, `common.js?v=26`).

## [2.3.0] — 2026-09-23 — Data-freshness alarm

### Added
- Scheduled workflow (`freshness.yml`) checks the live site's `latest_snapshot`
  every 2h; if it's older than 7h the run fails (GitHub emails) and a `stale-data`
  issue opens, auto-closing once fresh data is live.
- The status pill turns amber ("data delayed") and stops pulsing when data is
  older than 7h.
- Cache-bust bumped (`style.css?v=24`, `common.js?v=25`).

## [2.2.0] — 2026-07-18 — Per-page ledes & sparklines

### Added
- Live, Trending, Publishers and Historical each open with a lede + support KPI
  row (the Overview pattern), wired into auto-refresh with skeletons.
- Trending trajectories are inline SVG sparklines coloured by trend state.

### Changed
- Chart tick/legend/tooltip colours unified into `CHART_THEME` in `common.js`;
  `deltaHtml` moved there too.
- Publisher share figures drop the gain-green styling (green = movement).
- Cache-bust bumped (`style.css?v=23`, `common.js?v=24`).

## [2.1.0] — 2026-07-18 — KPI hierarchy & masthead dateline

### Changed
- **The "At a glance" row is a lede and its support**, not four equal tiles.
  Tracked viewers now reads large (Fraunces) with its delta on the same baseline;
  top category supports it at normal weight. Grid goes `1.6fr 1fr` on desktop,
  stacked on mobile.
- **Dateline added to the masthead.** "Categories Live" and "History Depth" left
  the KPI row for a quiet mono dateline beside the updated pill — they are
  provenance about the dataset (one is a constant, the other ticks up daily),
  not findings, and were taking headline space on the strength of neither.
- Cache-bust bumped (`style.css?v=22`).

### Verified
- No horizontal overflow at 390px (measured in-page: `scrollWidth == clientWidth`).

## [2.0.0] — 2026-07-18 — "Ledger" editorial redesign

A ground-up visual overhaul: from the dark-aurora "instrument" look to an
editorial, data-journalism identity — the design system built in Claude Design,
ported into the live site.

### Changed
- **Display typeface** is now **Fraunces** (characterful serif) over Inter (body)
  and IBM Plex Mono (data), replacing Space Grotesk.
- **Ground** is a green-black (`#0e110f`) instead of the bluish near-black; the
  aurora gradient wash and dot-grid texture are removed for a clean, flat ground.
- **Sections, not cards.** `.panel` boxes became broadsheet sections separated by
  masthead hairlines, each headed by a serif headline over a mono dek.
- **One signal colour.** The purple co-lead is dropped; magnitude bars read in the
  single accent green, which now only ever marks data or state.
- Category names are set in Fraunces; the `fragile` tag moved to amber.
- **Fragility bars colour by severity** (green → amber → red), matching the meter
  spec, via a per-row class in `live.html`.
- **Charts** use the colourblind-validated Ledger categorical palette.
- Wordmark page-name set in italic green Fraunces; quieter active-nav and hero glow.
- Per-page heads: load Fraunces, `theme-color` → `#0e110f`, cache-bust bumped
  (`style.css?v=21`, `common.js?v=23`).

### Notes
- No build step, no dependency changes — plain HTML/CSS/JS + Chart.js as before.
- The design-system source and preview mockups live in `design-system/` and
  `brand-concepts/` (gitignored; synced to the "INVST Gaming" Claude Design project).

## [1.0.0] — original build — "Signal"

The first public build (retroactively tagged at the last commit before the
redesign). The dark, near-black "instrument" dashboard: Space Grotesk display,
aurora gradient + dot-grid texture, green/purple dual accents, glass segmented
nav, KPI cards, the ⌘K command palette, live auto-refresh, and the five pages
(Overview, Live, Trending, Publishers, Historical).

Retrieve it anytime with `git checkout v1.0.0`.
