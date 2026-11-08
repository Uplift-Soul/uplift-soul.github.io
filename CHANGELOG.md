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

## [2.6.1] — 2026-11-08 — SEO basics

### Changed
- **Keyword-first page titles** (e.g. "Top Twitch Categories Right Now — Live
  Viewers | INVST Gaming") and rewritten meta / og descriptions. The Trending
  description no longer mentions the removed "fastest-growing categories" panel.

### Added
- `<link rel="canonical">` on every page, pointing at the clean URL, so `/live`
  and `/live.html` aren't treated as duplicates.
- JSON-LD structured data: `WebSite` + `Organization` on the Overview, `Dataset`
  on Live, Trending, Publishers and Historical (each linking its JSON slice as a
  download), for Google Dataset Search.

## [2.6.0] — 2026-11-08 — Cookieless analytics & privacy page

### Added
- **Umami (cookieless) visit counting** on every page, loaded once from
  `common.js`. It stores nothing on the device, so it needs no consent and counts
  every visitor — the real traffic totals, where GA only sees those who accept.
  Local test servers are excluded (`data-domains`).
- `track()` and the hub-card / nav click events now go to both GA and Umami.
- **Consent-funnel events** in Umami: `consent_shown` and `consent_choice`
  (`granted` / `denied`, plus whether it was reopened from the footer).
  Ignored = shown − choices.
- **`/privacy` page**: what Umami and GA collect, GA's 14-month retention, the
  stored `invst-consent` choice, other services (GitHub Pages, Google Fonts) and
  UK GDPR rights. It's linked from the banner and footer and listed in the
  sitemap, and offers an inline "Change privacy settings" button.

### Changed
- Banner copy now says visits are counted anonymously without cookies, that GA
  only runs on Accept, and links to the privacy policy.
- Cache-bust bumped (`style.css?v=27`, `common.js?v=28`).

### Fixed
- `sitemap.xml` had stray text after `</urlset>`, which made it invalid XML.

## [2.5.0] — 2026-11-01 — Design pass & mobile

### Changed
- **Time charts open on the live feed** (Overview trend + concentration); Archive
  and All are one tap away. The archive→live gap no longer eats ~40% of the x-axis.
- **Historical: the bump chart is now a rank heatmap** — categories × months, each
  cell the month's rank (single-hue scale, brightest = #1, number printed in the
  cell), with Archive / Live / All. Chart.js is no longer loaded on that page.
- **Trending: games still in the top 50 lead**; dropped-out games fold behind a
  "Show N dropped-out games" toggle (state survives auto-refresh).
- **Mobile**: the nav is the burger + search cluster from the start (the five tabs
  wrapped into a two-row pill); Live category names get the full row with the
  "top 10" note beneath; chart chips are one swipeable row; x-axis capped at 4
  labels; Trending rows keep the sparkline beside the name; tighter kicker.
- Publisher gainers/losers and the "Biggest swing" KPI rank by viewers gained or
  lost, not %.
- KPI and Live deltas use `previous.day_ago` ("vs this time yesterday") when the
  backend sends it, falling back to the previous snapshot.
- Cache-bust bumped (`style.css?v=26`, `common.js?v=27`).

### Fixed
- Live rows showed a stray "›" on its own line (a fourth grid child in a
  three-column row); the redundant caret element is removed.
- Bars showed a grey smear after the fill — the sheen animation ended parked past
  the fill's edge; the fill now clips it.

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
