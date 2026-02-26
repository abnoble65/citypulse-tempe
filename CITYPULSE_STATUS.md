# CityPulse — Project Status

_Last updated: 2026-02-25_

---

## Overview

CityPulse is a React/TypeScript web app that delivers AI-generated urban intelligence briefings for all 11 San Francisco supervisor districts. It pulls live permit, development pipeline, zoning, and eviction notice data from DataSF, generates narrative analysis via Claude, and presents structured intelligence across six pages. A separate ingestion script populates a Supabase database with 115+ SF Planning Commission hearing records for historical project lookup.

Deployed to Vercel: **https://web-five-omega-87.vercel.app**

---

## Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| UI framework | React + TypeScript | 19.2 / 5.9 |
| Build tool | Vite | 7.3 |
| Routing | React Router | 7.13 |
| AI | Anthropic SDK (claude-sonnet-4-6 / claude-haiku-4-5) | 0.78 |
| Database | Supabase (PostgreSQL) | 2.97 |
| Data source | DataSF Socrata API | — |
| Hosting | Vercel | — |

---

## App Architecture

```
citypulse/
├── web/                          # Vite + React app
│   ├── public/
│   │   └── CityPulse_Logo1_Fun.png
│   ├── src/
│   │   ├── main.tsx              # Router root
│   │   ├── theme.ts              # COLORS + FONTS constants
│   │   ├── districts.ts          # Single source of truth: all 11 district configs
│   │   ├── components/
│   │   │   ├── NavBar.tsx        # Sticky top nav, threads district + briefing state
│   │   │   ├── FilterBar.tsx     # Neighborhood pills (driven by DistrictConfig)
│   │   │   ├── NeighborhoodHero.tsx  # Full-width hero banner per neighborhood
│   │   │   ├── SectionLabel.tsx  # Uppercase section eyebrow label
│   │   │   └── Icons.tsx         # SVG icons (CoitTower, Transamerica, etc.)
│   │   ├── pages/
│   │   │   ├── Home.tsx          # District selector grid + generate button
│   │   │   ├── Briefing.tsx      # AI briefing narrative
│   │   │   ├── Charts.tsx        # Permit + eviction data visualisations
│   │   │   ├── Signals.tsx       # AI-generated signals + public concerns
│   │   │   ├── Outlook.tsx       # AI-generated forward-looking outlook
│   │   │   └── Commission.tsx    # Supabase hearing search + recent hearings
│   │   └── services/
│   │       ├── dataSF.ts         # Raw Socrata API fetches (permits, pipeline, zoning, evictions)
│   │       ├── aggregator.ts     # Aggregates DataSF data → DistrictData struct
│   │       ├── briefing.ts       # Calls Claude to generate narrative + signals + outlook
│   │       └── supabase.ts       # Supabase client (anon key, browser-safe)
│   ├── scripts/
│   │   ├── ingestMinutes.ts      # One-off ingestion: fetches + processes all hearing PDFs
│   │   └── setupDatabase.sql     # Initial Supabase schema
│   ├── vite.config.ts            # Dev server config
│   └── .env                      # API keys (gitignored)
└── CITYPULSE_STATUS.md           # This file
```

### Data Flow

```
Home (district selector)
  → onGenerate(districtConfig)
    → generateBriefing(districtConfig)
        ├── aggregateDistrictData(districtConfig)
        │     ├── fetchBuildingPermits(district.number)   [DataSF i98e-djp9]
        │     ├── fetchDevelopmentPipeline()              [DataSF 6jgi-cpb4]
        │     ├── fetchZoningDistricts()                  [DataSF 3i4a-hu95]
        │     └── fetchEvictions(district.number)         [DataSF 5cei-gny5]
        │         → DistrictData { permit_summary, pipeline_summary,
        │                          zoning_profile, date_range, eviction_summary }
        └── Claude API (claude-sonnet-4-6)
            → briefingText (4-section narrative)
      → App state { briefingText, aggregatedData, districtConfig }
        → Briefing / Charts / Signals / Outlook pages
          → FilterBar (local state per page, defaults to districtConfig.allLabel)
            → re-runs generateSignals() / generateOutlook() per neighborhood
            → re-slices aggregatedData.permit_summary.by_zip for Charts

Commission → Supabase  [hearings, projects, votes, comments]
  (currently only District 3 hearing data is ingested)
```

---

## District Configuration (`districts.ts`)

Single source of truth for all 11 supervisor districts. Each district defines:

```typescript
interface DistrictConfig {
  number: string;               // "3"
  label: string;                // "District 3"
  fullName: string;             // "District 3 — North Beach, Chinatown, Financial"
  allLabel: string;             // "All District 3"
  neighborhoods: DistrictNeighborhood[];
  pipelineNeighborhoods: string[]; // lowercase substrings matched against nhood41
}

interface DistrictNeighborhood {
  name: string;
  zip: string;
  Icon: FC<IconProps>;
  gradient: string;    // NeighborhoodHero background
  subtitle: string;    // e.g. "Telegraph Hill · 94133"
}
```

District 3 has custom hand-crafted icons and gradients per neighborhood. All other districts use `DistrictIcon` and a shared default gradient.

### Neighborhood Coverage

| District | Neighborhoods |
|---|---|
| D1 — Richmond | Inner Richmond · Outer Richmond · Seacliff |
| D2 — Marina, Pacific Heights | Marina · Cow Hollow · Pacific Heights · Presidio Heights |
| D3 — North Beach, Chinatown, Financial | North Beach · Financial District · Chinatown · Russian Hill |
| D4 — Sunset, Parkside | Inner Sunset · Central Sunset · Outer Sunset · Parkside |
| D5 — Haight, Western Addition, NoPa | Haight-Ashbury · NoPa · Lower Haight · Western Addition · Alamo Square |
| D6 — SoMa, Tenderloin | SoMa · Tenderloin · Hayes Valley · Rincon Hill · Mission Bay |
| D7 — West Portal, Glen Park | West Portal · Forest Hill · Diamond Heights · Glen Park |
| D8 — Castro, Noe Valley | Castro · Noe Valley · Eureka Valley · Duboce Triangle |
| D9 — Mission, Bernal Heights | Mission District · Bernal Heights · Portola |
| D10 — Potrero Hill, Bayview | Potrero Hill · Dogpatch · Bayview · Hunters Point · Visitacion Valley |
| D11 — Excelsior, Ingleside | Excelsior · Ingleside · Outer Mission · Ocean View · Crocker Amazon |

---

## Pages

### `/` — Home
District selector grid (11 buttons, `repeat(auto-fill, minmax(155px, 1fr))`, max-width 860px). Each button shows the district number, "District" label, and neighborhood names. Selecting a district sets local state; "Generate [District N] Briefing" button calls `onGenerate(selectedDistrict)`. Default selection is District 3.

### `/briefing` — The Briefing
`FilterBar` below NavBar defaults to "All District N". Selecting a neighborhood re-generates the briefing scoped to that neighborhood's zip code via `generateBriefingFromData()`. Shows three stat cards (active permits, est. value, pipeline units) plus the AI narrative. Permit stats use `permit_summary.by_zip` when a neighborhood filter is active.

### `/charts` — Charts
`FilterBar` below NavBar. Permit stats re-slice to `permit_summary.by_zip[selectedZip]` when a neighborhood is active (sparse-data note shown if <20 permits). Three chart sections:
1. **Permit Status Breakdown** — SVG donut + legend
2. **Estimated Value by Permit Type** — horizontal bar chart (top 5 types by $M)
3. **Top 10 Addresses by Permit Value** — ranked list with mini bars (district-wide)
4. **Eviction Notices** — total count stat + type breakdown bars (left) + 12-month column trend (right). Always district-wide regardless of neighborhood filter.

### `/signals` — Signals
`FilterBar` below NavBar. Selecting a neighborhood re-generates signals via `generateSignals()` scoped to that zip. Each signal card shows title, body, severity badge, and resident concern callout. Below signals, a "Public Concerns" section derives concern-level items from the same signal data. Eviction patterns (Ellis Act, owner move-in, rising monthly trends) are explicitly included in the analysis prompt.

### `/outlook` — Outlook
`FilterBar` below NavBar. Selecting a neighborhood re-generates the outlook via `generateOutlook()`. Sections: Key Events, Risks & Downside Scenarios, Civic Engagement. Outlook prompt requires a 🏘️ displacement risk item when eviction data is non-zero, and a ☀️ shadow-impact item citing shadow-flagged Supabase projects (D3 only).

### `/commission` — Commission Hearings
Two sections:
1. **Address Search** — Supabase full-text substring search on `projects.address`. Returns grouped `HistoryCard` components showing full hearing timeline, votes (colour-coded pills), commissioner comments, shadow impact badge, and PDF links.
2. **Recent Hearings** — Last 10 hearings with project counts, action summaries, and top 3 significant projects highlighted.

`FilterBar` is active; selecting a neighborhood appends `.ilike('address', '%ZIP%')` to the Supabase query. **Note:** Only District 3 hearing data has been ingested — other districts return 0 results (this is expected, not a bug).

---

## Components

### `NavBar`
Sticky `#154360` bar at top of all post-Home pages. Logo left, nav pills right. Passes `districtConfig` and briefing state through navigation calls so data is preserved when switching pages.

### `FilterBar`
Driven by `districtConfig.neighborhoods`. Renders "All District N" pill plus one pill per neighborhood. Active pill is orange-highlighted. Used on Briefing, Charts, Signals, Outlook, and Commission.

### `NeighborhoodHero`
Full-width gradient banner rendered below `FilterBar` on all inner pages. When a neighborhood is selected, shows neighborhood name, subtitle, and key permit stats in a themed gradient. When "All District N" is active, shows a district-level summary.

---

## DataSF Datasets

| Dataset | Socrata ID | Filter | Notes |
|---------|-----------|--------|-------|
| Building Permits | `i98e-djp9` | `supervisor_district='${n}'` (text), limit 1000, `filed_date DESC` | Bucketed by zip in aggregator for client-side filtering |
| Development Pipeline | `6jgi-cpb4` | None server-side; client filters by `nhood41` substring match | Uses `district.pipelineNeighborhoods` for filter terms |
| Zoning Districts | `3i4a-hu95` | None; client drops blank rows | Used for zoning context in briefing only |
| Eviction Notices | `5cei-gny5` | `supervisor_district=${n}` (numeric) AND `file_date > 2 years ago`, limit 1000 | 19 boolean type flags per record; non-fatal on fetch failure |

### `DistrictData` structure

```typescript
{
  permit_summary: {
    total, by_type, by_status, cost_by_type,
    total_estimated_cost_usd, notable_permits,
    by_zip: Record<zip, ZipPermitSummary>   // for client-side neighborhood filtering
  },
  pipeline_summary: { total, net_pipeline_units, by_status, total_affordable_units },
  zoning_profile:   { unique_zoning_codes, special_use_districts, height_range },
  date_range:       { start, end },
  eviction_summary: {
    total,
    by_type: Record<label, count>,         // e.g. { "Nuisance": 45, "Non-Payment": 38 }
    by_month: { month: "YYYY-MM", count }[], // last 24 months, zero-filled
    by_neighborhood: Record<name, count>
  }
}
```

---

## AI Generation

All generation is browser-side using `dangerouslyAllowBrowser: true`. API key is in `.env` (not committed).

| Function | Model | Purpose |
|---|---|---|
| `generateBriefingFromData()` | claude-sonnet-4-6 | Full 4-section narrative (450–600 words) |
| `generateSignals()` | claude-haiku-4-5 | 3–5 structured signals as JSON |
| `generateOutlook()` | claude-haiku-4-5 | Events/risks/engagement outlook as JSON |

### Signal prompt context
Signals are prompted to flag: unusual permit volume, project-type clustering, displacement risk from eviction data (Ellis Act and owner move-in as key indicators), affordability impact, and infrastructure strain.

### Outlook prompt context
Outlook is prompted to include: a ☀️ shadow-impact risk item (citing Supabase shadow-flagged projects, D3 only), and a 🏘️ displacement risk item when `eviction_summary.total > 0` (citing eviction count, top types, Ellis Act and owner move-in activity).

---

## Supabase Schema

**Database:** `tgokablobqwaswilidyp.supabase.co`

```sql
hearings (
  id            uuid PRIMARY KEY,
  hearing_date  date UNIQUE NOT NULL,
  pdf_url       text NOT NULL,
  processed_at  timestamptz
)

projects (
  id                  uuid PRIMARY KEY,
  hearing_id          uuid → hearings(id) CASCADE,
  case_number         text,
  address             text,
  district            text,
  project_description text,
  action              text,         -- 'Approved', 'Continued', 'Disapproved', 'Withdrawn'
  motion_number       text,
  shadow_flag         boolean,      -- true if Section 295 / shadow impact mentioned
  shadow_details      text
)

votes (
  id                uuid PRIMARY KEY,
  project_id        uuid → projects(id) CASCADE,
  commissioner_name text,
  vote              text            -- 'aye' | 'nay' | 'absent' | 'recused' | 'abstain'
)

commissioner_comments (
  id                uuid PRIMARY KEY,
  project_id        uuid → projects(id) CASCADE,
  commissioner_name text,
  comment_text      text
)
```

**Indexes:** `projects(hearing_id)`, `projects(case_number)`, `projects(address)`, `votes(project_id)`, `commissioner_comments(project_id)`, `hearings(hearing_date)`

---

## Ingestion Script

`scripts/ingestMinutes.ts` — run with `npx tsx scripts/ingestMinutes.ts`

1. Fetches the archive index at `https://sfplanning.org/cpc-hearing-archives`
2. Parses all minutes PDF links (`citypln-m-extnl.sfgov.org/*_cpc_min.pdf` and `*_cal_min.pdf`)
3. Sorts newest → oldest; skips already-processed dates (checks `hearings` table)
4. Downloads each PDF as base64, sends to Claude (native PDF support, `max_tokens: 8192`)
5. Upserts hearing row, inserts projects/votes/comments into Supabase
6. Rate-limits at 120s between requests (org limit: 30k tokens/min)
7. Exponential backoff on 429 rate-limit errors (60s → 120s → 240s)

**Status:** ~115 of 116 hearings successfully ingested (District 3 only). One hearing (2025-06-26) has a known malformed-JSON issue due to PDF complexity; it is in the `FORCE_REPROCESS` set and will be retried on the next run.

---

## Environment Variables

Stored in `web/.env` (gitignored):

```
VITE_ANTHROPIC_API_KEY=     # Anthropic API key (used browser-side via dangerouslyAllowBrowser)
VITE_SUPABASE_URL=          # Supabase project URL
VITE_SUPABASE_ANON_KEY=     # Supabase anon key (browser-safe, row-level security)
VITE_SUPABASE_SERVICE_KEY=  # Supabase service role key (ingestion script only, never browser)
```

Vercel production environment variables are set in the Vercel project dashboard (same keys, without `VITE_SUPABASE_SERVICE_KEY`).

---

## What's Working

- **11-district support** — full permit, pipeline, zoning, and eviction data for any SF supervisor district
- **District selector** — responsive grid on Home; re-generates all data and resets all filters on district change
- **Neighborhood filtering** — per-page `FilterBar` driven by `districts.ts`; re-generates AI content when neighborhood changes (Signals, Outlook, Briefing); re-slices permit data client-side (Charts)
- **Eviction data** — 2-year eviction notice history per district; type breakdown and 12-month trend chart on Charts page; Ellis Act / owner move-in context injected into Signals and Outlook prompts
- **AI generation** — Briefing (Sonnet), Signals (Haiku), Outlook (Haiku) all district-aware
- **Shadow-impact outlooks** — Supabase shadow-flagged projects fed into Outlook prompt (D3 only)
- **Commission hearings** — 115 D3 hearings indexed; address search, vote history, shadow badges, PDF links
- **Loading skeletons** — all pages show pulsing placeholder UI during data fetch / AI generation
- **Vercel deployment** — production build passes `tsc -b && vite build` clean; deployed at https://web-five-omega-87.vercel.app

---

## Known Issues

- **Commission non-D3 districts** — only District 3 hearing data is in Supabase. Selecting any other district on the Commission page returns 0 results. Requires re-running the ingestion script scoped to other districts (the script currently only ingests D3 Planning Commission minutes).
- **2025-06-26 hearing** — largest PDF in the archive; Claude returns malformed JSON mid-generation. In `FORCE_REPROCESS` set; needs chunked PDF approach or `max_tokens: 16384`.
- **Development pipeline not district-filtered server-side** — pipeline dataset `6jgi-cpb4` is fetched in full (limit 500) and filtered client-side by `pipelineNeighborhoods` name strings. This is best-effort; pipeline data for districts with unusual neighborhood naming may be incomplete.
- **Pipeline data not zip-filterable** — `pipelineNeighborhoods` uses name matching, not zip codes. Pipeline charts always reflect the full district even when a neighborhood filter is active.
- **Eviction chart always district-wide** — eviction trend and type breakdown don't respond to the neighborhood filter. A note appears when a neighborhood is selected. Could be improved by filtering `by_neighborhood` data.
- **Briefing text not re-generated on neighborhood filter** (by design on Outlook/Signals, but the Briefing page DOES re-generate; this is consistent). Shadow-impact prompt always uses D3 Supabase data regardless of selected district.
- **Browser-side API key** — Anthropic key exposed in browser bundle via `dangerouslyAllowBrowser`. Acceptable for demo; production hardening would route through a serverless function.

---

## Next Tasks (Suggested)

1. **Ingest Commission hearings for other districts** — run `ingestMinutes.ts` with district-scoped PDF sources for D1–D2, D4–D11 to make Commission page useful across all districts.
2. **Eviction neighborhood filter** — slice `eviction_summary.by_month` and `by_type` by `by_neighborhood` when a neighborhood filter is active, matching against `districtConfig.neighborhoods[n].name`.
3. **Pipeline zip coverage** — the Development Pipeline dataset (`6jgi-cpb4`) has a `zipcode` field; use it for server-side filtering instead of client-side name matching.
4. **Server-side API proxy** — move Anthropic key to a Vercel Edge Function to avoid browser exposure.
5. **Retry 2025-06-26 hearing** — investigate chunked PDF approach or raise `max_tokens` to 16384.
6. **Commission zip filter reliability** — planning commission addresses don't consistently include zip codes. Geocoding or address normalization during ingestion would make the filter reliable.
