# CityPulse — Claude Working Rules
# Place this file at the root of your CityPulse repo.
# Update it after every correction. Ruthlessly iterate until mistake rate drops.

---

## Project Identity

- **App**: CityPulse — civic intelligence platform for San Francisco
- **Live URL**: citypulse-bay.vercel.app
- **Stack**: Next.js (App Router) · Supabase (PostgreSQL) · Vercel · Anthropic Claude API · Mapbox GL
- **Current sprint**: Sprint 5 — Nextspace 3D integration
- **Active branch**: feature/sprint5-nextspace
- **Main branch**: always clean and deployable — never commit broken code to main

---

## Workflow Orchestration

### 1. Plan Mode Default
- Enter plan mode for ANY task with 3+ steps or architectural decisions
- If something breaks or goes sideways: STOP, switch to plan mode, re-plan — do not keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs before implementation — reduce ambiguity first
- After writing a plan, check it in before starting implementation

### 2. Subagent Strategy
- Use subagents to keep the main context window clean and focused
- Offload research, codebase exploration, and parallel analysis to subagents
- One task per subagent for focused execution
- For complex cross-file problems (e.g. Nextspace ontology mapping): assign one subagent per area

### 3. Self-Improvement Loop
- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write a rule that prevents the same mistake from happening again
- Review `tasks/lessons.md` at the start of every session
- Ruthlessly iterate until the mistake rate measurably drops

### 4. Verification Before Done
- Never mark a task complete without proving it works
- Diff behaviour between main and feature branch when relevant
- Ask: "Would a staff engineer approve this?"
- Run the regression checklist before calling anything done (see below)

### 5. Demand Elegance
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes — do not over-engineer
- Minimal impact: changes should only touch what is necessary

### 6. Autonomous Bug Fixing
- When given a bug report: fix it. Do not ask for hand-holding
- Point at logs, errors, or failing behaviour — then resolve
- Zero context switching required from the user

---

## Core Rules — Never Break These

### API and Security
- ALL AI calls route through `api/ai.ts` via the `callAI()` proxy — never client-side
- Never use `VITE_` prefix on API keys — server-side only via `ANTHROPIC_API_KEY`
- Model allowlist: `claude-sonnet-4-6` (briefings) and `claude-haiku-4-5-20251001` (chatbot)
- Max tokens ceiling: 2,048 — do not exceed
- Rate limit: 10 req/hr/IP via `api/ai.ts` proxy — do not bypass

### Database
- Supabase has **16 tables** — RLS enabled on all of them
- Public tables: read-only for anonymous users
- Feedback table: insert-only, no public read
- Never drop or alter existing tables without explicit instruction
- New Sprint 5 tables are additive only — they do not modify existing schema
- Sprint 5 table: `nextspace_context_queue` (id, apn, cbd_slug, package_json, status, created_at, delivered_at)

### Branch and Deployment
- Vercel auto-deploys `main` to citypulse-bay.vercel.app — main must always be clean
- All Sprint 5 work stays in `feature/sprint5-nextspace`
- Never merge to main without passing the full regression checklist below
- Never commit directly to main

### Code Changes
- Simplicity first — make every change as simple as possible
- Minimal impact — only touch files that need changing
- No temporary fixes — find the root cause, apply a permanent solution
- Sprint 5 Phase 1 tasks are **additive only** — no edits to existing files unless explicitly required
- If an existing file must be edited: run the regression checklist before AND after

---

## Regression Checklist
Run this before any merge to main. All 6 must pass.

- [ ] **Path 1 — Civic**: Home → D3 → Generate Briefing → Signals → Map → Site Selection
- [ ] **Path 2 — CBD**: /cbd → Downtown → Dashboard → Clean & Safe → Permits → 311 → Business → Board Packet
- [ ] **Path 3 — Language**: Switch to 中文 on Briefing · Switch to ES on CBD Dashboard
- [ ] **Path 4 — Supervisor**: Click D3 Danny Sauter profile — confirm full profile loads
- [ ] **AI Chatbot**: Send one message — confirm response returns without error
- [ ] **Mobile**: Confirm bottom nav, map bottom sheet, and chatbot overlay on a phone-sized window

---

## Sprint 5 — Nextspace Integration Context

### What Sprint 5 Does
Connects CityPulse civic data to the Nextspace San Francisco 3D platform.
A user clicks a building or parcel in CityPulse and flies directly to it in Nextspace
with a pre-loaded CityPulse Intelligence Package.

### Key Data Points
- Intelligence Package format: `citypulse_intelligence_package_v1.json`
- Primary join key between CityPulse and Nextspace: **APN (Assessor Parcel Number)**
- APN format used in CityPulse: hyphenated (e.g. `3709-014`) — confirm consistency with DataSF sources before building generator
- Centroid coordinates: WGS84 lat/lng — confirm CRS preference with Kevin Devito before integration
- 4 active CBDs: `downtown`, `fishermans-wharf`, `union-square`, `civic-center`
- Primary demo target: **Downtown SF** — 5 best parcels to be identified from Supabase

### New Files for Sprint 5 (additive only)
- `src/services/intelligencePackage.ts` — generates the JSON package from an APN
- `src/services/nextspaceQueue.ts` — pushes packages to `nextspace_context_queue`
- `src/components/DigitalTwinPanel.tsx` — slide-out preview panel triggered by Digital Twin button
- `/api/intelligence/[apn].ts` — API route exposing the package generator

### Blocked Items (waiting for Kevin Devito)
- `NEXTSPACE_BASE_URL` — the deep-link URL format to fly to a parcel in Nextspace SF
- Nextspace entity type and ID format (APN-based or internal CC3D ID?)
- Preferred integration method (deep-link · iframe · REST API · Supabase context store)
- Ontology field mapping — which JSON package fields to rename or add
- CRS confirmation (WGS84, EPSG:4326, or CA State Plane EPSG:2227?)
- Authentication method for the deep-link

### ESRI Decision (resolve before Phase 3)
- ESRI ArcGIS JS SDK = 2D parcel and permit overlays inside CityPulse
- Nextspace = 3D destination the user flies to
- These serve different moments in the user journey — confirm this split with Kevin before writing integration code

---

## Data Sources and APIs

| Source | Data | Notes |
|---|---|---|
| DataSF Socrata API | Permits, evictions, affordable housing, business listings | Live API calls — Array.isArray() hardened |
| SF 311 API | Service requests by category, location, resolution time | Live API calls |
| SF Planning Commission | Hearing minutes, project records | Weekly PDF scrape via ingestMinutes.ts |
| SFGovTV | Public meeting sentiment | Stored in public_sentiment table |
| Anthropic Claude API | All AI briefing, chatbot, board packet | Server-side only via api/ai.ts |
| Mapbox GL | Interactive maps (civic + CBD) | Sprint 2 implementation |

---

## Task Management

For every Sprint 5 session:

1. **Plan First** — write plan to `tasks/todo.md` with checkable items
2. **Verify Plan** — check it in before starting implementation
3. **Track Progress** — mark items complete as you go
4. **Explain Changes** — high-level summary at each step
5. **Document Results** — add review section to `tasks/todo.md` when done
6. **Capture Lessons** — update `tasks/lessons.md` after any correction

---

## Active Contacts

| Person | Role | Status | Notes |
|---|---|---|---|
| Kevin Devito | CC3D / Nextspace | 🟢 Active | Sprint 5 trigger met — awaiting deep-link schema response |
| Rodney Fong | SF Chamber of Commerce | 🟡 Scheduled | CBD portal demo scheduled |
| Robbie Silver | Downtown SF Partnership | ⚪ Pending | After Rodney Fong demo |

---

## Lessons Learned
*Update this section after every correction. Add the date.*

- **2026-03-09**: Always confirm APN format consistency across DataSF sources before building any generator function — permits, evictions, and housing data may use different hyphenation formats.
- **2026-03-09**: The Digital Twin button already exists in the codebase from Sprint 3. Always search for existing implementations before building new ones.
- **2026-03-09**: Vercel has a 10-second timeout on functions — too short for PDF/Board Packet processing. Keep heavy processing out of standard API routes. Separate worker needed for Sprint 5+ PDF tasks.
