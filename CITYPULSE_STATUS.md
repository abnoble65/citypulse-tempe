# CityPulse — Project Status

_Last updated: 2026-02-22_

---

## Overview

CityPulse is a React/TypeScript web app that delivers AI-generated urban intelligence briefings for San Francisco District 3. It pulls live permit and development pipeline data from DataSF, generates narrative analysis via Claude, and presents structured intelligence across six pages. A separate ingestion script populates a Supabase database with 115+ SF Planning Commission hearing records for historical project lookup.

---

## Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| UI framework | React + TypeScript | 19.2 / 5.9 |
| Build tool | Vite | 7.3 |
| Routing | React Router | 7.13 |
| Charts | Recharts | 3.7 |
| AI | Anthropic SDK (claude-sonnet-4-6) | 0.78 |
| Database | Supabase (PostgreSQL) | 2.97 |
| Data source | DataSF Socrata API | — |
| Dev tunnel | ngrok (free static domain) | 3.36 |

---

## App Architecture

```
citypulse/
├── web/                          # Vite + React app
│   ├── public/
│   │   └── CityPulse_Logo1_Fun.png
│   ├── src/
│   │   ├── main.tsx              # Router root
│   │   ├── index.css             # Global styles + spinner
│   │   ├── components/
│   │   │   ├── NavBar.tsx        # Sticky top nav, threads briefing state
│   │   │   └── NeighborhoodFilterBar.tsx  # Zip filter pills (Briefing/Charts/Commission)
│   │   ├── pages/
│   │   │   ├── Home.tsx          # Launch screen + neighborhood preview
│   │   │   ├── Briefing.tsx      # AI briefing narrative
│   │   │   ├── Charts.tsx        # Permit data visualisations
│   │   │   ├── Signals.tsx       # Signal + Zoning Context sections
│   │   │   ├── Outlook.tsx       # Outlook section + new-briefing CTA
│   │   │   └── Commission.tsx    # Supabase hearing search + recent hearings
│   │   └── services/
│   │       ├── DataSF.ts         # Raw Socrata API fetches (permits, pipeline, zoning)
│   │       ├── aggregator.ts     # Aggregates DataSF data → DistrictData struct
│   │       ├── briefing.ts       # Calls Claude to generate narrative
│   │       └── supabase.ts       # Supabase client (anon key, browser-safe)
│   ├── scripts/
│   │   ├── ingestMinutes.ts      # One-off ingestion: fetches + processes all hearing PDFs
│   │   └── setupDatabase.sql     # Initial Supabase schema
│   ├── vite.config.ts            # Dev server config + ngrok allowedHosts
│   └── .env                      # API keys (gitignored)
└── CITYPULSE_STATUS.md           # This file
```

### Data Flow

```
Home → generateBriefing()
         ├── aggregateDistrictData()   [DataSF: permits, pipeline, zoning]
         └── Claude API               [generates 4-section narrative]
       → router state { briefingText, aggregatedData }
         → Briefing / Charts / Signals / Outlook pages
         → NeighborhoodFilterBar (local state per page) re-slices aggregatedData.permit_summary.by_zip

Commission → Supabase                 [hearings, projects, votes, comments]
```

---

## Pages

### `/` — Home
Visual launch screen. Displays four neighborhood preview cards (non-interactive). "Generate District 3 Briefing" button is always enabled — fetches data for all of District 3 and navigates to `/briefing` with results in router state.

### `/briefing` — The Briefing
Displays the `THE BRIEFING` section of the Claude-generated narrative. Shows the CityPulse logo and a `NeighborhoodFilterBar`. Selecting a neighborhood updates the badge label (the text itself covers all of District 3 and is not re-generated). Nav button proceeds to Charts.

### `/charts` — Charts
Three side-by-side Recharts visualisations of building permit data:
- **Permit Status Breakdown** — donut chart by status (filed/issued/complete/expired…)
- **Permit Count by Type** — horizontal bar chart, top 8 types
- **Est. Value by Type ($M)** — horizontal bar chart, top 8 types by $ value

`NeighborhoodFilterBar` re-renders all three charts using the zip-bucketed data in `permit_summary.by_zip`. When a filtered zip has fewer than 20 permits, a muted note appears below the grid.

### `/signals` — Signals & Zoning
Displays the `THE SIGNAL` and `THE ZONING CONTEXT` sections of the Claude narrative in two stacked cards. No filter bar (text is district-wide). Nav buttons to Charts and Outlook.

### `/outlook` — The Outlook
Displays the `THE OUTLOOK` section. Includes a "Want fresh intelligence?" card with a link back to Home to regenerate.

### `/commission` — Commission Hearings
Two sections:
1. **Address Search** — Supabase full-text substring search on `projects.address`. Returns grouped `HistoryCard` components showing full hearing timeline, votes (colour-coded pills), commissioner comments, shadow impact badge, and PDF links.
2. **Recent Hearings** — Last 10 hearings with project counts, action summaries, and top 3 significant projects highlighted.

`NeighborhoodFilterBar` is active; selecting a zip appends a `.ilike('address', '%ZIP%')` clause to the search query and updates the input placeholder.

---

## Components

### `NavBar`
Sticky `#154360` bar at top of all post-Home pages. Logo left, nav pills right. Uses React Router `navigate()` to pass `{ briefingText, aggregatedData }` state when switching pages, preserving data across the session.

### `NeighborhoodFilterBar`
Rendered immediately below `NavBar` on Briefing, Charts, and Commission. Exports `DISTRICT_3_NEIGHBORHOODS` constant (used by Home and Briefing).

---

## Neighborhood → Zip Code Mapping

| Neighborhood | Zip Code | Icon |
|---|---|---|
| North Beach / Telegraph Hill | 94133 | ⛵ |
| Financial District / Jackson Square | 94111 | 🏦 |
| Chinatown / Nob Hill | 94108 | 🏮 |
| Russian Hill | 94109 | 🌉 |

Filter bar also includes **All District 3** (no zip filter, full aggregate).

---

## DataSF Datasets

| Dataset | Socrata ID | Filter |
|---------|-----------|--------|
| Building Permits | `i98e-djp9` | `supervisor_district = '3'`, limit 1000, ordered by `filed_date DESC` |
| Development Pipeline | `k55i-dnjd` | No server-side filter; client filters by `nhood41` matching District 3 neighborhood names, limit 500 |
| Zoning Districts | `ibu8-4ccn` | No filter; client removes rows with blank `districtname`/`zoning_sim`, limit 200 |

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

**Status:** ~115 of 116 hearings successfully ingested. One hearing (2025-06-26) has a known malformed-JSON issue due to PDF complexity; it is in the `FORCE_REPROCESS` set and will be retried on the next run.

---

## Environment Variables

Stored in `web/.env` (gitignored):

```
VITE_ANTHROPIC_API_KEY=     # Anthropic API key (used browser-side via dangerouslyAllowBrowser)
VITE_SUPABASE_URL=          # Supabase project URL
VITE_SUPABASE_ANON_KEY=     # Supabase anon key (browser-safe, row-level security)
VITE_SUPABASE_SERVICE_KEY=  # Supabase service role key (ingestion script only, never browser)
```

---

## What's Working

- Live DataSF permit/pipeline/zoning fetch on demand
- Claude AI briefing generation (4 sections: Briefing, Signal, Zoning Context, Outlook)
- Per-zip permit data bucketing (`by_zip`) for real client-side chart filtering
- `NeighborhoodFilterBar` on Briefing, Charts, and Commission
- Commission Supabase address search with full history cards (votes, comments, shadow badge)
- 115 Planning Commission hearings (2014–2025) indexed in Supabase
- ngrok public tunnel: `https://tomeka-unleached-fluctuatingly.ngrok-free.dev`
- Full TypeScript build with no errors

---

## Known Issues / In Progress

- **2025-06-26 hearing** — largest PDF in the archive; Claude returns malformed JSON mid-generation. Needs investigation (possibly chunk the PDF or increase max_tokens further).
- **Commission zip filter** — relies on zip codes appearing in the address field of planning commission records, which is not guaranteed. Filter works as best-effort; may return no results for some zips.
- **Development pipeline filter** — uses neighbourhood name matching (not zip codes), so pipeline data in Charts is not zip-filterable; it always reflects all of District 3.
- **Briefing text is district-wide** — filter bar on Briefing page is contextual label only; text does not change when a neighbourhood is selected.

---

## Next Tasks (Suggested)

1. **Multi-zip briefing prompt** — Update `generateBriefing()` / `SYSTEM_PROMPT` to accept the selected zip code and instruct Claude to weight its analysis toward that neighbourhood when one is chosen.
2. **Pipeline data by zip** — Add zip code to the DataSF Development Pipeline fetch (dataset `k55i-dnjd` has a `zipcode` field) so pipeline charts can also filter by neighbourhood.
3. **Commission zip lookup** — Store zip codes alongside addresses in Supabase during ingestion (geocode or parse from address text) to make the Commission zip filter reliable.
4. **Retry 2025-06-26** — Investigate chunked PDF approach or raise `max_tokens` to 16384 for that single hearing.
5. **Deploy to production** — Replace ngrok with a permanent hosting solution (Vercel/Netlify for the front end, Supabase already hosted).
6. **Expand beyond District 3** — The neighbourhood selector UI and zip mapping pattern is ready to scale to other SF supervisor districts.
