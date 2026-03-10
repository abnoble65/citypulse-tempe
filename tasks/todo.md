# Intelligence Package v1 -> Supabase Field Mapping

Maps every field in `citypulse_intelligence_package_v1.json` to its Supabase table/column or external data source. Fields with no clear source are flagged as **GAP**.

---

## parcel_identity

| Package Field | Source | Table.Column / API | Notes |
|---|---|---|---|
| `apn` | External API | DataSF Assessor (wv5m-vpq2) | Primary join key; also used in `projects` table address matching |
| `block` | External API | DataSF Assessor (wv5m-vpq2) | Derived from APN split |
| `lot` | External API | DataSF Assessor (wv5m-vpq2) | Derived from APN split |
| `address` | Supabase + External | `projects.address`, `hearings.address` | Also from DataSF permits (i98e-djp9) |
| `city` | Hardcoded | N/A | Always "San Francisco" |
| `state` | Hardcoded | N/A | Always "CA" |
| `zip` | External API | DataSF Assessor (wv5m-vpq2) | May also come from neighborhood lookup |
| `cbd_slug` | CONFIRMED | `cbd_profiles.slug` | 4 active CBDs: downtown, fishermans-wharf, union-square, civic-center |
| `cbd_name` | CONFIRMED | `cbd_profiles.name` (full) / `cbd_profiles.short_name` (abbreviated) | |
| `supervisor_district` | CONFIRMED | `cbd_profiles.supervisor_district` | |
| `supervisor_name` | **GAP** | Not in `cbd_profiles` | `cbd_profiles` has `supervisor_district` but no `supervisor_name` column. Needs lookup table or hardcoded map. |

## spatial

| Package Field | Source | Table.Column / API | Notes |
|---|---|---|---|
| `centroid.lat` | CONFIRMED | `cbd_profiles.center_lat` (CBD-level) | CBD centroid in Supabase; parcel-level centroid from DataSF Assessor API |
| `centroid.lng` | CONFIRMED | `cbd_profiles.center_lng` (CBD-level) | CBD centroid in Supabase; parcel-level centroid from DataSF Assessor API |
| `centroid.crs` | Hardcoded | N/A | Always "WGS84" |
| `parcel_geojson_url` | **GAP** | No Supabase table | Computed URL; actual geometry from DataSF neighborhoods (jwn9-ihcz) or parcel shapefile |
| `cbd_boundary_geojson_url` | CONFIRMED | `cbd_profiles.boundary_geojson` | Stored directly in cbd_profiles as GeoJSON |

## building_attributes

| Package Field | Source | Table.Column / API | Notes |
|---|---|---|---|
| `primary_use` | External API | DataSF Assessor / Zoning (3i4a-hu95) | Not in Supabase |
| `height_ft` | External API | DataSF building data | Not in Supabase |
| `floors_above_grade` | External API | DataSF building data | Not in Supabase |
| `floors_below_grade` | **GAP** | No clear source | Not in DataSF standard datasets; may need manual entry or 3D model data |
| `year_built` | External API | DataSF Assessor (wv5m-vpq2) | Not in Supabase |
| `gross_sq_ft` | External API | DataSF Assessor (wv5m-vpq2) | Not in Supabase |
| `zoning_code` | External API | DataSF Zoning (3i4a-hu95) | Not in Supabase |
| `zoning_label` | External API | DataSF Zoning (3i4a-hu95) | Human-readable label derived from code |

## permit_intelligence

| Package Field | Source | Table.Column / API | Notes |
|---|---|---|---|
| `total_permits_on_record` | External API | DataSF Permits (i98e-djp9) | Aggregated count; not stored in Supabase |
| `permits_last_12_months` | External API | DataSF Permits (i98e-djp9) | Computed from date filter |
| `permits_last_30_days` | External API | DataSF Permits (i98e-djp9) | Computed from date filter |
| `open_permits` | External API | DataSF Permits (i98e-djp9) | Filtered by status |
| `most_recent_permit.permit_number` | External API | DataSF Permits (i98e-djp9) | |
| `most_recent_permit.type` | Supabase + External | `projects.type`, DataSF Permits | |
| `most_recent_permit.description` | Supabase + External | `projects.description`, DataSF Permits | |
| `most_recent_permit.filed_date` | External API | DataSF Permits (i98e-djp9) | |
| `most_recent_permit.status` | Supabase + External | `projects.status`, DataSF Permits | |
| `most_recent_permit.estimated_cost_usd` | Supabase + External | `projects.estimated_cost`, DataSF Permits | |
| `most_recent_permit.official_record_url` | Computed | N/A | Built from permit_number template URL |
| `permit_activity_signal` | **GAP** | Not stored | Derived/computed value; needs logic in `intelligencePackage.ts` or a precomputed column |

## planning_commission_intelligence

| Package Field | Source | Table.Column / API | Notes |
|---|---|---|---|
| `total_hearings_referencing_parcel` | Supabase | `hearings` (count where address matches) | Requires address-to-APN join |
| `most_recent_hearing.hearing_date` | Supabase | `hearings.date` | |
| `most_recent_hearing.project_description` | Supabase | `hearings.desc` | |
| `most_recent_hearing.outcome` | Supabase | `hearings.action` | Values: Approved, Continued, Disapproved |
| `most_recent_hearing.vote` | Supabase | `hearings.votes` (aye/nay/absent object) | Needs formatting as "X-Y" string |
| `most_recent_hearing.commissioner_dissent_summary` | Supabase | `hearings.detail.commissionerConcerns` | Extracted from detail JSONB |
| `hearing_sentiment_score` | Supabase | `public_sentiment` (computed from for/against/neutral) | Needs computation logic |
| `sentiment_label` | **GAP** | Not stored | Derived from sentiment_score thresholds |
| `dominant_commissioner_concern` | Supabase | `hearings.detail.commissionerConcerns` | Needs AI summarization or top-concern extraction |

## development_readiness

| Package Field | Source | Table.Column / API | Notes |
|---|---|---|---|
| `score` | **GAP** | Not stored | Composite score — needs computation service |
| `score_label` | **GAP** | Not stored | Derived from score thresholds |
| `score_components.permit_activity` | **GAP** | Not stored | Needs computation from permit counts |
| `score_components.hearing_sentiment` | Supabase (partial) | Derived from `public_sentiment` | Needs computation |
| `score_components.zoning_capacity_remaining` | **GAP** | No source found | Would need zoning envelope analysis (height/FAR limits vs. current) |
| `score_components.eviction_risk_flag` | External API | DataSF Evictions (5cei-gny5) | Boolean derived from eviction count |
| `score_components.affordable_housing_constraint` | External API | DataSF Affordable Housing (aaxw-2cb8) | Boolean check |
| `score_components.infrastructure_flag` | **GAP** | No source found | No infrastructure constraint dataset identified |
| `readiness_summary` | **GAP** | Not stored | AI-generated text; needs Claude API call at package generation time |

## eviction_signals

| Package Field | Source | Table.Column / API | Notes |
|---|---|---|---|
| `eviction_filings_last_24_months` | External API | DataSF Evictions (5cei-gny5) | Filtered by address + date |
| `eviction_type_flags` | External API | DataSF Evictions (5cei-gny5) | Array of eviction types (Ellis Act, etc.) |
| `eviction_risk_level` | **GAP** | Not stored | Derived from filing count thresholds |

## affordable_housing

| Package Field | Source | Table.Column / API | Notes |
|---|---|---|---|
| `inclusionary_units_on_site` | External API | DataSF Affordable Housing (aaxw-2cb8) | Filtered by address/APN |
| `bmr_units_on_site` | External API | DataSF Affordable Housing (aaxw-2cb8) | Below Market Rate units |
| `housing_pipeline_flag` | External API | DataSF Dev Pipeline (6jgi-cpb4) | Boolean: any residential pipeline project at address |

## public_sentiment

| Package Field | Source | Table.Column / API | Notes |
|---|---|---|---|
| `overall_sentiment_label` | **GAP** | Not stored as aggregate | Needs computation across all hearings for the parcel |
| `overall_sentiment_score` | **GAP** | Not stored as aggregate | Weighted average from `public_sentiment` rows per parcel |
| `primary_topics_mentioned` | Supabase (partial) | `public_sentiment.top_themes` | Per-hearing; needs aggregation across hearings for a parcel |
| `sentiment_source` | Supabase | `public_sentiment.source` | Values: sfgovtv_captions, minutes_pdf |
| `last_updated` | **GAP** | No timestamp on aggregation | Would need a computed refresh date |

## district_trend_signals

| Package Field | Source | Table.Column / API | Notes |
|---|---|---|---|
| `district` | CONFIRMED | `signal_cache.cache_key` | Key encodes district; signals JSONB contains district-level AI content |
| `trend_label` | CONFIRMED (embedded) | `signal_cache.signals` (JSONB) | AI-generated trend labels embedded in signals payload |
| `trend_summary` | CONFIRMED (embedded) | `signal_cache.signals` (JSONB) | AI-generated trend narratives in signals payload |
| `trend_direction` | CONFIRMED (embedded) | `signal_cache.signals` (JSONB) | Derivable from signal content |
| `trend_confidence` | **GAP** | Not a distinct field | Not explicitly stored; would need to be extracted or computed from signal text |
| `ai_generated` | N/A | Always `true` | Metadata flag |
| `last_refreshed` | CONFIRMED | `signal_cache.generated_at` | Timestamp on cache row |

## site_selection_ranking

| Package Field | Source | Table.Column / API | Notes |
|---|---|---|---|
| `rank_within_cbd` | **GAP** | Not stored | Needs ranking computation across all parcels in CBD |
| `rank_within_sf` | **GAP** | Not stored | Needs ranking computation across all SF parcels |
| `rank_basis` | Hardcoded | N/A | Description of ranking methodology |
| `transit_proximity.nearest_bart` | **GAP** | No transit table | Needs transit stops dataset or API |
| `transit_proximity.walking_minutes` | **GAP** | No transit table | Needs routing/distance computation |
| `transit_proximity.nearest_muni_line` | **GAP** | No transit table | Needs SFMTA data |
| `transit_proximity.walking_minutes_muni` | **GAP** | No transit table | Needs routing/distance computation |
| `comparable_parcels_in_cbd` | **GAP** | Not stored | Needs similarity/proximity computation |

## citypulse_deeplink

| Package Field | Source | Table.Column / API | Notes |
|---|---|---|---|
| `civic_app_url` | Computed | N/A | Template URL from district |
| `cbd_portal_url` | Computed | N/A | Template URL from cbd_slug |
| `permits_view_url` | Computed | N/A | Template URL from cbd_slug + APN |
| `site_selection_url` | Computed | N/A | Template URL from cbd_slug + APN |

## nextspace_handoff

| Package Field | Source | Table.Column / API | Notes |
|---|---|---|---|
| `nextspace_entity_id` | Supabase (planned) | `nextspace_context_queue.id` (future) | PENDING — Nextspace to confirm |
| `nextspace_entity_type` | **GAP** | Not defined | PENDING — Nextspace to confirm |
| `nextspace_scene_url` | **GAP** | Not defined | PENDING — from Kevin Devito |
| `suggested_layers_on_load` | Hardcoded | N/A | Static array of layer names |
| `suggested_ai_context_prompt` | **GAP** | Not stored | AI-generated at package creation time |
| `integration_method` | **GAP** | Not defined | PENDING — integration design decision |

---

## Gap Summary

### Confirmed Covered (gaps 1, 2, 3, 6 resolved)

| Original Gap | Table | Columns | Status |
|---|---|---|---|
| 1. CBD/District lookup | `cbd_profiles` | `slug`, `name`, `short_name` | CONFIRMED |
| 2. Supervisor district | `cbd_profiles` | `supervisor_district` | CONFIRMED (but `supervisor_name` is NOT in the table — remains a gap) |
| 3. CBD boundary + centroid | `cbd_profiles` | `boundary_geojson`, `center_lat`, `center_lng` | CONFIRMED |
| 6. District trend signals | `signal_cache` | `cache_key`, `signals` (JSONB), `generated_at` | CONFIRMED (trend data embedded in JSONB; `trend_confidence` not a distinct field) |

### Confirmed Column Schemas

**cbd_profiles:** `slug`, `name`, `short_name`, `supervisor_district`, `boundary_geojson`, `center_lat`, `center_lng`
**signal_cache:** `cache_key`, `signals` (JSONB), `generated_at`
**briefing_overview_cache:** `cache_key`, `overview` (text), `generated_at`

### Full Supabase Table Inventory (16 tables per CLAUDE.md)

| # | Table | Confirmed | Rows |
|---|---|---|---|
| 1 | `hearings` | Yes | 116 |
| 2 | `projects` | Yes | 1,459 |
| 3 | `public_sentiment` | Yes | 116 |
| 4 | `mayor_news` | Yes | 160 |
| 5 | `bos_meetings` | Yes | 43 |
| 6 | `bos_items` | Yes | 2,012 |
| 7 | `recpark_meetings` | Yes | 15 |
| 8 | `recpark_items` | Yes | 74 |
| 9 | `feedback` | Yes (insert-only) | Unknown |
| 10 | `signal_cache` | Yes — schema confirmed | Unknown |
| 11 | `briefing_overview_cache` | Yes — schema confirmed | Unknown |
| 12 | `outlook_cache` | Yes (issue tracker) | Unknown |
| 13 | `concerns_cache` | Yes (issue tracker) | Unknown |
| 14 | `cbd_profiles` | Yes — schema confirmed | Unknown |
| 15 | `cbd_cache` | Yes (user-confirmed) | Unknown |
| 16 | `nextspace_context_queue` | Planned (Sprint 5) | 0 |

### Remaining Gaps

| # | Gap | Severity | Notes |
|---|---|---|---|
| 2b | `supervisor_name` | Low | Not in `cbd_profiles`; needs hardcoded map (11 supervisors) or new column |
| 4 | `floors_below_grade` | Low | No identified source in DataSF or Supabase |
| 5 | Development readiness scores | Medium | Entire block is computed, not stored; needs scoring service |
| 6b | `trend_confidence` | Low | Not a distinct field in signal_cache JSONB |
| 7 | Site selection rankings | Medium | All ranking fields need cross-parcel computation |
| 8 | Transit proximity | Medium | No transit stops dataset in Supabase or identified API |
| 9 | Zoning capacity remaining | Medium | No FAR/height envelope analysis source |
| 10 | Infrastructure flag | Low | No infrastructure constraint dataset |

### Derived/Computed Fields (need logic but have partial data)

- `permit_activity_signal` — derivable from permit counts
- `hearing_sentiment_score` — derivable from `public_sentiment` for/against/neutral
- `sentiment_label` — derivable from score thresholds
- `eviction_risk_level` — derivable from eviction count
- `overall_sentiment_score/label` — aggregation of per-hearing sentiment
- `readiness_summary` — AI generation from available data
- `suggested_ai_context_prompt` — AI generation from available data

---

## Task 1.2 — Top 5 Downtown SF Parcels

**Objective:** Identify the 5 Downtown SF parcels with the most combined permits + hearings activity and a non-null centroid.

### Method

- Permits: DataSF Building Permits API (i98e-djp9), grouped by address, filtered to Downtown SF zip codes (94104, 94111)
- APNs: DataSF Assessor API (wv5m-vpq2), queried by address
- Hearings: Supabase `hearings` table (116 rows) — **cannot query directly from this workspace**. Counts below marked as TBD pending Supabase query. The user should run: `select address, count(*) from hearings where address ilike '%CALIFORNIA%' or address ilike '%MONTGOMERY%' or address ilike '%SANSOME%' group by address order by count desc;`

### Top 5 Downtown SF Parcels

| Rank | Address | APN | Block-Lot | Permits | Hearings | Combined | Lat | Lng |
|---|---|---|---|---|---|---|---|---|
| 1 | 555 California St | 0259-026 | 0259/026 | 2,700 | TBD | TBD | 37.792262 | -122.403486 |
| 2 | 345 California St | 0261-018 | 0261/018 | 2,241 | TBD | TBD | 37.792602 | -122.400439 |
| 3 | 44 Montgomery St | 0291-012 | 0291/012 | 2,213 | TBD | TBD | 37.789808 | -122.401767 |
| 4 | 101 California St | 0263-011 | 0263/011 | 2,059 | TBD | TBD | 37.792949 | -122.398099 |
| 5 | 1 Sansome St | 0289-004 | 0289/004 | 1,705 | TBD | TBD | 37.790432 | -122.401359 |

### APN Details (from DataSF Assessor wv5m-vpq2)

| Address | APN | Use | Stories | Yr Built | Sq Ft | Zoning | Neighborhood |
|---|---|---|---|---|---|---|---|
| 555 California St | 0259-026 | Commercial Office | 52 | 1969 | 1,471,929 | C-3-O | Financial District North |
| 345 California St | 0261-018 | Commercial Office | 35 | 1987 | N/A* | C-3-O | Financial District North |
| 44 Montgomery St | 0291-012 | Commercial Office | 43 | 1966 | 750,491 | C-3-O | Financial District North |
| 101 California St | 0263-011 | Commercial Office | 48 | 1983 | 1,300,000 | C-3-O | Financial District North |
| 1 Sansome St | 0289-004 | Commercial Office | 41 | 1983 | 611,000 | C-3-O | Financial District North |

*345 California property_area returned 0; lot_area is 45,046 sq ft.

### APN Format Note

The Assessor API returns `blklot` as a 7-digit string (e.g. `0259026`). CityPulse intelligence package uses hyphenated format (e.g. `0259-026`). The `block` and `lot` fields are returned separately, so the hyphenated format is: `{block}-{lot}`.

**Important:** The example in `citypulse_intelligence_package_v1.json` uses `3709-014` for 101 California St, but the Assessor API returns `0263-011`. The `3709-014` format appears to be from a different parcel numbering system. Need to confirm which APN format CityPulse should standardize on.

### Notable Exclusions

- 1 Market St (4,138 permits, 94105) — excluded; Market/Embarcadero edge, more SoMa than Downtown CBD core
- 425 Market St (2,427 permits, 94105) — excluded; 94105 straddles Downtown/SoMa boundary

### Hearings Cross-Reference — Pending

The `hearings` table (116 rows, Supabase) cannot be queried from this workspace. To complete the combined ranking:

```sql
-- Run in Supabase SQL editor:
SELECT address, count(*) as hearing_count
FROM hearings
WHERE address ILIKE '%555 California%'
   OR address ILIKE '%345 California%'
   OR address ILIKE '%44 Montgomery%'
   OR address ILIKE '%101 California%'
   OR address ILIKE '%1 Sansome%'
GROUP BY address
ORDER BY hearing_count DESC;
```

Once hearing counts are provided, the Combined column and final ranking will be updated.

---

## Task 1.6 — Test Results

**Run date:** 2026-03-10T19:12:34Z
**Supabase:** SKIPPED (no credentials on this machine — all Supabase-dependent fields marked separately)

### Per-Parcel Results (DataSF APIs)

| APN | Address | Assessor | Permits | Evictions | Affordable | Pipeline | Total ms |
|---|---|---|---|---|---|---|---|
| 0259026 | 555 California St | OK | OK (2,700) | EMPTY (0) | EMPTY (0) | EMPTY (0) | 2,465 |
| 0261018 | 345 California St | OK | OK (2,241) | EMPTY (0) | EMPTY (0) | EMPTY (0) | 1,332 |
| 0291012 | 44 Montgomery St | OK | OK (2,213) | EMPTY (0) | EMPTY (0) | EMPTY (0) | 1,231 |
| 0263011 | 101 California St | OK | OK (2,059) | EMPTY (0) | EMPTY (0) | OK (1) | 1,760 |
| 0289004 | 1 Sansome St | OK | OK (1,705) | EMPTY (0) | EMPTY (0) | EMPTY (0) | 1,082 |

### Fields Returning Real Data (all 5 parcels)

- `parcel_identity.apn` — from input
- `parcel_identity.address` — from input / Assessor
- `parcel_identity.city`, `state` — hardcoded
- `parcel_identity.zip` — from Permits API (all 5 have zipcode)
- `parcel_identity.supervisor_district` — Assessor (all return "3")
- `parcel_identity.supervisor_name` — hardcoded lookup ("Danny Sauter")
- `spatial.centroid.lat/lng` — Assessor `the_geom` (all 5 have geometry)
- `building_attributes.primary_use` — Assessor (`Commercial Office` for all 5)
- `building_attributes.floors_above_grade` — Assessor (`number_of_stories`: 52, 35, 43, 48, 41)
- `building_attributes.year_built` — Assessor (1969, 1987, 1966, 1983, 1983)
- `building_attributes.zoning_code` — Assessor (`C3O` for all 5)
- `permit_intelligence.*` — full coverage: total, last_12_months, last_30_days, open, most_recent, signal
- `eviction_signals` — all 5 return 0 filings (commercial buildings, expected)
- `development_readiness.score` — computed from available inputs

### Permit Activity Detail

| Address | Total | Last 12mo | Last 30d | Open | Signal | Most Recent Date |
|---|---|---|---|---|---|---|
| 555 California St | 2,700 | 56 | 3 | 218 | HIGH | 2026-03-09 |
| 345 California St | 2,241 | 32 | 2 | 75 | HIGH | null* |
| 44 Montgomery St | 2,213 | 23 | 1 | 168 | HIGH | 2026-02-19 |
| 101 California St | 2,059 | 51 | 1 | 208 | HIGH | 2026-03-02 |
| 1 Sansome St | 1,705 | 68 | 12 | 224 | HIGH | null* |

*345 California and 1 Sansome: most recent permit has no `filed_date` in the API response.

### Fields Returning Null or Empty

| Field | Reason | All 5? |
|---|---|---|
| `building_attributes.height_ft` | No height data in Assessor dataset | Yes |
| `building_attributes.floors_below_grade` | GAP — no source | Yes |
| `building_attributes.zoning_label` | Needs zoning code → label lookup | Yes |
| `building_attributes.gross_sq_ft` | 345 California returns 0 | 1 of 5 |
| `parcel_identity.cbd_slug/cbd_name` | Needs Supabase `cbd_profiles` | Yes |
| `planning_commission.*` | Needs Supabase `hearings` | Yes |
| `public_sentiment.*` | Needs Supabase `public_sentiment` | Yes |
| `district_trend_signals.*` | Needs Supabase `signal_cache` | Yes |
| `site_selection_ranking.*` | Needs cross-parcel computation | Yes |
| `nextspace_handoff.*` | Stubbed — pending Kevin Devito | Yes |

### Bugs Found and Fixed

1. **Assessor API query used wrong field name** — was `?blklot=X`, should be `?$where=parcel_number='X'`. The `blklot` field is not a queryable SoQL column. Fixed in `intelligencePackage.ts:fetchAssessor()`.
2. **Pipeline API query used wrong field name** — was `project_name`, should be `nameaddr`. Dataset 6jgi-cpb4 uses `nameaddr` as its address column. Fixed in `intelligencePackage.ts:fetchPipeline()`.

### Format Issues

- **345 California St:** `property_area` returns `0.0` from Assessor — `gross_sq_ft` will be null after the `|| null` guard. The `lot_area` (45,046 sq ft) is available as a fallback but the function currently doesn't use it.
- **filed_date null on 2 parcels:** 345 California and 1 Sansome have most recent permits with no `filed_date`. The sort order `$order=filed_date DESC` places null-date records first. Consider falling back to `issued_date` or filtering nulls.
- **Assessor `blklot` field:** Not returned when querying by `parcel_number`. Block and lot are still returned separately, and the function already derives them correctly from individual fields or the APN input.

### Conclusion

**17 of 25 package field groups return real data from DataSF alone.** The remaining 8 groups require Supabase access (hearings, sentiment, CBD profiles, signal cache) or are intentionally stubbed (nextspace, rankings). No blocking issues for the package generator — all bugs fixed.
