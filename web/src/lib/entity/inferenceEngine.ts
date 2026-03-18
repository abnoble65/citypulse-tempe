/**
 * CityPulse AI Inference Engine
 * Sprint 6 — Week 3
 *
 * Computes derived intelligence signals from a fully (or partially)
 * populated BuildingEntity. Runs after all data ingest jobs complete.
 *
 * Signals computed:
 *   intelligence.signals.readiness_score         (0–100)
 *   intelligence.signals.readiness_label         (PRIME / HIGH / WATCH / LOW)
 *   intelligence.signals.redevelopment_potential (0–100)
 *   intelligence.signals.economic_activity_index (0–100)
 *   intelligence.signals.sustainability_score    (0–100)
 *   intelligence.environment.carbon_emissions    (AI-estimated metric tons CO₂e/yr)
 *
 * Each signal is computed independently. If the required inputs are null,
 * the signal is left null rather than returning a misleading value.
 */

import type { BuildingEntity } from "./buildingEntity";
import { mergeIntelligence } from "./entityBinder";

const SOURCE_LABEL = "CityPulse AI Inference Engine";

// ─── SCORING HELPERS ──────────────────────────────────────────────────────────

/** Clamp a value to [0, 100] and round to nearest integer. */
function score(val: number): number {
  return Math.round(Math.max(0, Math.min(100, val)));
}

// ─── READINESS SCORE ─────────────────────────────────────────────────────────
/**
 * Development readiness score (0–100).
 *
 * Inputs:
 *   - zoning_code          — certain zones score higher for development
 *   - zoning_height_limit  — more headroom above actual height = more potential
 *   - height_meters        — actual building height (CC3D)
 *   - total_permits        — recent permit activity signals active development
 *   - total_hearings       — planning commission attention signals activity
 *   - year_built           — older buildings score higher for redevelopment
 *
 * Weights (sum to 100):
 *   Height headroom     40
 *   Permit activity     25
 *   Hearing activity    15
 *   Building age        20
 */
export function computeReadinessScore(entity: BuildingEntity): number | null {
  const {
    zoning_height_limit,
    zoning_height_control,
    zoning_code,
  } = entity.regulation;
  const { height_meters } = entity.geometry;
  const { total_permits, total_hearings } = entity.intelligence.signals;
  const { year_built } = entity.intelligence.history;

  // Need at least one meaningful input
  if (
    zoning_height_limit === null &&
    total_permits === null &&
    year_built === null
  ) {
    return null;
  }

  let rawScore = 0;

  // ── Height headroom (40 pts) ───────────────────────────────────────────────
  if (zoning_height_limit !== null && height_meters !== null) {
    const headroom = zoning_height_limit - height_meters;
    // Full 40 pts if 50m+ headroom, scaled down linearly
    rawScore += score((headroom / 50) * 40);
  } else if (zoning_height_limit !== null && height_meters === null) {
    // Has a permissive zone but no height data — partial credit
    rawScore += 20;
  }

  // ── Permit activity (25 pts) ───────────────────────────────────────────────
  if (total_permits !== null) {
    // 10+ permits = full score, scales linearly below that
    rawScore += score((Math.min(total_permits, 10) / 10) * 25);
  }

  // ── Hearing activity (15 pts) ──────────────────────────────────────────────
  if (total_hearings !== null) {
    // 5+ hearings = full score
    rawScore += score((Math.min(total_hearings, 5) / 5) * 15);
  }

  // ── Building age (20 pts) ──────────────────────────────────────────────────
  if (year_built !== null) {
    const age = new Date().getFullYear() - year_built;
    // 50+ year old building = full score
    rawScore += score((Math.min(age, 50) / 50) * 20);
  }

  return score(rawScore);
}

export function computeReadinessLabel(
  readinessScore: number | null
): "PRIME" | "HIGH" | "WATCH" | "LOW" | null {
  if (readinessScore === null) return null;
  if (readinessScore >= 75) return "PRIME";
  if (readinessScore >= 50) return "HIGH";
  if (readinessScore >= 25) return "WATCH";
  return "LOW";
}

// ─── REDEVELOPMENT POTENTIAL ─────────────────────────────────────────────────
/**
 * Redevelopment potential score (0–100).
 *
 * Core idea: how much unused zoning envelope exists?
 *
 * ratio = (zoning_height_limit - actual_height) / zoning_height_limit
 * Score = ratio × 100, clamped to [0, 100].
 *
 * A building using 100% of its allowed height scores 0.
 * A single-story building in a high-rise zone scores near 100.
 */
export function computeRedevelopmentPotential(
  entity: BuildingEntity
): number | null {
  const { zoning_height_limit } = entity.regulation;
  const { height_meters } = entity.geometry;

  if (zoning_height_limit === null || height_meters === null) return null;
  if (zoning_height_limit <= 0) return null;

  const unused = zoning_height_limit - height_meters;
  const ratio = unused / zoning_height_limit;
  return score(ratio * 100);
}

// ─── ECONOMIC ACTIVITY INDEX ──────────────────────────────────────────────────
/**
 * Economic activity index (0–100).
 *
 * Derived from permit velocity and planning commission attention.
 *
 * Inputs:
 *   total_permits   — volume of permit activity
 *   total_hearings  — planning commission hearings
 *   last_renovated  — recency of construction activity
 */
export function computeEconomicActivityIndex(
  entity: BuildingEntity
): number | null {
  const { total_permits, total_hearings } = entity.intelligence.signals;
  const { last_renovated } = entity.intelligence.history;

  if (total_permits === null && total_hearings === null) return null;

  let raw = 0;

  // Permit volume (50 pts)
  if (total_permits !== null) {
    raw += score((Math.min(total_permits, 20) / 20) * 50);
  }

  // Hearing activity (30 pts)
  if (total_hearings !== null) {
    raw += score((Math.min(total_hearings, 10) / 10) * 30);
  }

  // Recency of renovation (20 pts)
  if (last_renovated !== null) {
    const yearsAgo = new Date().getFullYear() - last_renovated;
    // Renovated within 5 years = full 20 pts, scales down over 20 years
    raw += score(Math.max(0, (1 - yearsAgo / 20)) * 20);
  }

  return score(raw);
}

// ─── SUSTAINABILITY SCORE ─────────────────────────────────────────────────────
/**
 * Composite sustainability score (0–100).
 *
 * Inputs:
 *   energy_use_intensity  — lower is better; benchmarked against SF average
 *   sustainability_rating — letter grade from ENERGY STAR
 *   roof_pitch            — flat roofs (0°) score well for solar
 *   footprint_area        — larger flat roofs = more solar potential
 *
 * SF commercial average EUI ≈ 70 kBtu/sqft/yr (used as baseline).
 */
const SF_AVERAGE_EUI = 70;

export function computeSustainabilityScore(
  entity: BuildingEntity
): number | null {
  const { energy_use_intensity, sustainability_rating } = entity.intelligence.environment;
  const { roof_pitch, footprint_area } = entity.geometry;

  if (energy_use_intensity === null && sustainability_rating === null) return null;

  let raw = 0;

  // EUI score (50 pts) — lower EUI = higher score
  if (energy_use_intensity !== null) {
    const ratio = SF_AVERAGE_EUI / energy_use_intensity;
    raw += score(Math.min(ratio, 2) * 25); // capped at 50
  }

  // Rating score (30 pts)
  if (sustainability_rating !== null) {
    const ratingScore: Record<string, number> = { A: 30, B: 22, C: 12, D: 0 };
    raw += ratingScore[sustainability_rating] ?? 0;
  }

  // Roof suitability for solar (20 pts)
  if (roof_pitch !== null && footprint_area !== null) {
    // Flat or low-pitch roofs with large footprint score best
    const pitchPenalty = Math.min(roof_pitch / 45, 1); // 0 penalty at 0°, full at 45°+
    const areaBenefit = Math.min(footprint_area / 2000, 1); // full benefit at 2000m²+
    raw += score((1 - pitchPenalty) * areaBenefit * 20);
  }

  return score(raw);
}

// ─── CARBON EMISSIONS ESTIMATE ────────────────────────────────────────────────
/**
 * Estimate annual carbon emissions (metric tons CO₂e/yr).
 *
 * Formula:
 *   EUI (kBtu/sqft/yr) × floor_area (sqft) × grid_emission_factor → metric tons CO₂e
 *
 * SF grid emission factor ≈ 0.000233 metric tons CO₂e / kBtu
 * (PG&E mix, relatively clean due to hydro + renewables)
 *
 * floor_area is estimated from CC3D footprint × stories.
 * Stories is approximated as height_meters / 4 (average floor-to-floor).
 */
const SF_GRID_EMISSION_FACTOR = 0.000233; // metric tons CO₂e per kBtu
const AVG_FLOOR_HEIGHT_M = 4;
const M2_TO_SQFT = 10.7639;

export function computeCarbonEmissions(entity: BuildingEntity): number | null {
  const { energy_use_intensity } = entity.intelligence.environment;
  const { footprint_area, height_meters } = entity.geometry;

  if (energy_use_intensity === null || footprint_area === null || height_meters === null) {
    return null;
  }

  const estimatedStories = Math.max(1, Math.round(height_meters / AVG_FLOOR_HEIGHT_M));
  const floorAreaM2 = footprint_area * estimatedStories;
  const floorAreaSqft = floorAreaM2 * M2_TO_SQFT;
  const totalKBtu = energy_use_intensity * floorAreaSqft;
  const emissions = totalKBtu * SF_GRID_EMISSION_FACTOR;

  return Math.round(emissions);
}

// ─── MAIN INFERENCE FUNCTION ──────────────────────────────────────────────────

export interface InferenceResult {
  entity: BuildingEntity;
  computed: {
    readiness_score: number | null;
    readiness_label: "PRIME" | "HIGH" | "WATCH" | "LOW" | null;
    redevelopment_potential: number | null;
    economic_activity_index: number | null;
    sustainability_score: number | null;
    carbon_emissions: number | null;
  };
}

/**
 * Run all inference computations on a BuildingEntity and merge
 * the results back into the entity.
 *
 * Safe to run on a partially populated entity — any signal
 * whose required inputs are missing is left null.
 */
export function runInference(entity: BuildingEntity): InferenceResult {
  const readiness_score = computeReadinessScore(entity);
  const readiness_label = computeReadinessLabel(readiness_score);
  const redevelopment_potential = computeRedevelopmentPotential(entity);
  const economic_activity_index = computeEconomicActivityIndex(entity);
  const sustainability_score = computeSustainabilityScore(entity);
  const carbon_emissions = computeCarbonEmissions(entity);

  const payload: Partial<BuildingEntity["intelligence"]> = {
    signals: {
      ...entity.intelligence.signals,
      readiness_score,
      readiness_label,
      redevelopment_potential,
      economic_activity_index,
      sustainability_score,
    },
    environment: {
      ...entity.intelligence.environment,
      carbon_emissions,
    },
  };

  const updated = mergeIntelligence(entity, payload, SOURCE_LABEL);

  return {
    entity: updated,
    computed: {
      readiness_score,
      readiness_label,
      redevelopment_potential,
      economic_activity_index,
      sustainability_score,
      carbon_emissions,
    },
  };
}
