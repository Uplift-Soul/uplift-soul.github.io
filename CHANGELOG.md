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
