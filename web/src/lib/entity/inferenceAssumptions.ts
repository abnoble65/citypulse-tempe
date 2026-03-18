/**
 * CityPulse Inference Engine — Assumption Constants
 * Sprint 6 — Week 3
 *
 * Single source of truth for every assumption used in the inference engine.
 *
 * Rules:
 *   1. Every numeric constant used in inferenceEngine.ts must live here.
 *   2. Every assumption has a source, a review date, and a limitation note.
 *   3. When an assumption changes, update this file AND inferenceEngine.ts together.
 *   4. This file is imported by inferenceEngine.ts — if it breaks, inference breaks.
 *
 * Customer transparency:
 *   These constants are the basis of the INFERENCE_ASSUMPTIONS_DOC.md disclosure.
 *   Any change here must be reflected in that doc before the next deployment.
 */

// ─── READINESS SCORE ─────────────────────────────────────────────────────────

export const READINESS = {
  /**
   * Maximum headroom (metres above actual height) that earns full points.
   * Above this threshold, additional headroom provides no extra score benefit.
   *
   * Source: Internal calibration against SF Financial District parcels.
   * Review: Quarterly — adjust if scoring feels miscalibrated on new markets.
   * Limitation: Does not account for setback requirements, shadow ordinances,
   *   or discretionary review likelihood, which may prevent full envelope use.
   */
  MAX_HEADROOM_M: 50,

  /**
   * Score weight assigned to height headroom (out of 100).
   * Reflects the view that unused envelope is the strongest single signal
   * of development opportunity in dense urban markets.
   */
  WEIGHT_HEADROOM: 40,

  /**
   * Score weight assigned to permit activity (out of 100).
   * Active permitting indicates owner investment and site viability.
   */
  WEIGHT_PERMITS: 25,

  /**
   * Score weight assigned to planning commission hearing activity (out of 100).
   * Hearings signal active development interest or community scrutiny.
   */
  WEIGHT_HEARINGS: 15,

  /**
   * Score weight assigned to building age (out of 100).
   * Older buildings in high-value zones are more likely candidates
   * for redevelopment or substantial renovation.
   */
  WEIGHT_AGE: 20,

  /**
   * Permit count at which the permit activity component earns its full weight.
   * Buildings with more permits than this are treated equally at the ceiling.
   *
   * Source: Empirical observation of SF commercial permit volumes 2018–2023.
   * Limitation: Does not distinguish permit type (cosmetic vs structural).
   */
  MAX_PERMITS_FOR_FULL_SCORE: 10,

  /**
   * Hearing count at which the hearing component earns its full weight.
   *
   * Source: Internal calibration.
   * Limitation: Does not distinguish hearing outcome (approved vs denied).
   */
  MAX_HEARINGS_FOR_FULL_SCORE: 5,

  /**
   * Building age (years) at which the age component earns its full weight.
   * Buildings older than this all receive maximum age points.
   *
   * Source: General commercial real estate redevelopment cycles.
   * Limitation: Does not account for landmark status or historic designation,
   *   which may make redevelopment legally restricted regardless of age.
   */
  MAX_AGE_FOR_FULL_SCORE: 50,

  /**
   * Partial headroom credit awarded when zoning_height_limit is known
   * but actual building height (from CC3D) is null.
   * Represents "we know the zone is permissive but can't measure the gap."
   */
  PARTIAL_HEADROOM_CREDIT: 20,

  /** Label thresholds. */
  LABEL_PRIME_MIN: 75,
  LABEL_HIGH_MIN: 50,
  LABEL_WATCH_MIN: 25,
} as const;

// ─── SUSTAINABILITY SCORE ─────────────────────────────────────────────────────

export const SUSTAINABILITY = {
  /**
   * SF commercial baseline EUI (kBtu/sqft/yr) used to benchmark
   * individual building performance.
   *
   * Source: SF Department of Environment — 2022 Existing Buildings
   *   Benchmarking Report, median site EUI for commercial office buildings.
   * URL: https://www.sfenvironment.org/existing-buildings-ordinance-performance-report
   * Review: Annually when SF publishes updated benchmarking data.
   * Limitation: Single citywide average — does not account for building type
   *   (hospital, data centre, retail) which can have legitimately higher EUI.
   *   A data centre scoring "D" does not mean it is poorly managed.
   */
  SF_AVERAGE_EUI_KBTU_SQFT_YR: 70,

  /**
   * Maximum EUI ratio multiplier before the EUI component is capped.
   * Prevents extremely efficient buildings from dominating the score.
   * e.g. ratio of 2.0 means EUI is half the citywide average → full EUI points.
   */
  MAX_EUI_RATIO: 2,

  /** Score weight for EUI component (out of 100). */
  WEIGHT_EUI: 50,

  /** Score weight for ENERGY STAR rating component (out of 100). */
  WEIGHT_RATING: 30,

  /** Score weight for rooftop solar suitability (out of 100). */
  WEIGHT_SOLAR: 20,

  /**
   * ENERGY STAR score thresholds for letter grade derivation.
   * Source: US EPA ENERGY STAR program definitions.
   * URL: https://www.energystar.gov/buildings/benchmark
   * Limitation: ENERGY STAR scores are self-reported by building owners
   *   and may not have been independently verified unless certified.
   */
  ENERGY_STAR_GRADE_A_MIN: 75,
  ENERGY_STAR_GRADE_B_MIN: 50,
  ENERGY_STAR_GRADE_C_MIN: 25,

  /** Points assigned per letter grade in sustainability scoring. */
  RATING_POINTS: { A: 30, B: 22, C: 12, D: 0 } as Record<string, number>,

  /**
   * Roof pitch threshold (degrees) above which solar suitability is zero.
   * Source: NREL PVWatts guidelines — roofs steeper than 45° are excluded
   *   from standard rooftop solar estimates.
   */
  MAX_SOLAR_ROOF_PITCH_DEG: 45,

  /**
   * Footprint area (m²) at which solar suitability earns its full weight.
   * Source: NREL minimum viable rooftop solar installation threshold.
   * Limitation: Ignores rooftop obstructions (HVAC, elevator shafts, etc.)
   *   which can reduce usable solar area by 20–40%.
   */
  FULL_SOLAR_FOOTPRINT_M2: 2000,
} as const;

// ─── CARBON EMISSIONS ─────────────────────────────────────────────────────────

export const CARBON = {
  /**
   * SF grid emission factor (metric tons CO₂e per kBtu of site energy).
   *
   * Source: PG&E 2022 Power Content Label, converted to metric tons CO₂e/kBtu.
   *   PG&E reported 0.019 lbs CO₂e/kWh → 0.000233 metric tons CO₂e/kBtu.
   * URL: https://www.pge.com/pge_global/common/pdfs/your-account/your-bill/
   *        understanding-your-bill/bill-inserts/2022/1022-PCL-ENG.pdf
   * Review: Annually — PG&E publishes updated figures each October.
   * Limitation: Uses a single annual average grid factor. Actual emissions vary
   *   by time of day (higher at peak, lower at night with renewables).
   *   Does not account for on-site generation (solar, backup generators).
   *   Scope 1 emissions (gas heating, vehicle fleets) are excluded entirely.
   */
  SF_GRID_EMISSION_FACTOR_MTCO2E_PER_KBTU: 0.000233,

  /**
   * Assumed average floor-to-floor height (metres) used to estimate
   * total floor area from CC3D building height and footprint.
   *
   * Source: SF Planning Department — typical commercial floor-to-floor
   *   height for post-1970 office construction is 3.9–4.2m.
   *   Residential is typically 3.0–3.3m.
   * Limitation: A single average is used regardless of building type.
   *   Atrium floors, mechanical floors, and podium levels are not modelled.
   *   Actual floor area may differ from CC3D-derived estimate by ±15%.
   */
  AVG_FLOOR_HEIGHT_M: 4,

  /**
   * Unit conversion: square metres to square feet.
   * Used to convert CC3D footprint (m²) to sqft for EUI multiplication.
   * Source: Standard conversion factor (1 m² = 10.7639 sqft).
   */
  M2_TO_SQFT: 10.7639,
} as const;

// ─── ECONOMIC ACTIVITY INDEX ──────────────────────────────────────────────────

export const ECONOMIC = {
  /** Score weight for permit volume (out of 100). */
  WEIGHT_PERMITS: 50,

  /** Score weight for hearing activity (out of 100). */
  WEIGHT_HEARINGS: 30,

  /** Score weight for recency of renovation (out of 100). */
  WEIGHT_RECENCY: 20,

  /**
   * Permit count ceiling for full permit weight.
   * Source: Internal calibration against SF commercial permit data.
   */
  MAX_PERMITS_FOR_FULL_SCORE: 20,

  /**
   * Hearing count ceiling for full hearing weight.
   */
  MAX_HEARINGS_FOR_FULL_SCORE: 10,

  /**
   * Years since renovation beyond which recency contributes zero points.
   * A renovation older than this is considered economically stale.
   * Source: General commercial real estate repositioning cycles.
   */
  RECENCY_DECAY_YEARS: 20,
} as const;

// ─── REDEVELOPMENT POTENTIAL ──────────────────────────────────────────────────

export const REDEVELOPMENT = {
  /**
   * Redevelopment potential is expressed as the fraction of the zoning
   * height envelope that is currently unused.
   *
   * Score = (zoning_height_limit - actual_height) / zoning_height_limit × 100
   *
   * Limitation: Pure geometric ratio. Does not account for:
   *   - Shadow ordinances (Prop K in SF) which may block height additions
   *   - Landmark or historic preservation status
   *   - Below-grade conditions (soil, BART tunnels) affecting foundations
   *   - Ownership structure (condo regimes, ground leases)
   *   - Current market demand for additional density in that zone
   */
  FORMULA: "unused_envelope_fraction",
} as const;
