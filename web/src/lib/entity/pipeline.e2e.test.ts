/**
 * End-to-End Pipeline Test — 101 California St
 * Sprint 6 — Week 3
 *
 * Run: npx vitest run --globals web/src/lib/entity/pipeline.e2e.test.ts
 *
 * Simulates the complete CityPulse data pipeline for a single building:
 *
 *   1. bindCC3DRecord       — geometry + identity + regulation from CC3D
 *   2. ingestAssessor       — building use, year built, ownership, assessed value
 *   3. ingestPermits        — permit history, last renovated, occupancy type
 *   4. ingestPlanning       — zoning verification + gap fill
 *   5. ingestEnergy         — EUI + sustainability rating
 *   6. runInference         — AI-derived signals
 *
 * All external calls are mocked — no real API requests made.
 * Final entity is validated against the full 30-attribute schema.
 */

import { bindCC3DRecord, intelligenceCompleteness } from "./entityBinder";
import { ingestAssessor } from "./assessorIngest";
import { ingestPermits } from "./permitsIngest";
import { ingestPlanning } from "./planningIngest";
import { ingestEnergy } from "./energyIngest";
import { runInference } from "./inferenceEngine";
import type { CC3DRecord } from "./cc3dMapping";
import type { AssessorRecord } from "./assessorIngest";
import type { DBIPermitRecord } from "./permitsIngest";
import type { ZoningAttributes, HeightBulkAttributes } from "./planningIngest";
import type { EnergyBenchmarkRecord } from "./energyIngest";

// ─── MOCK SOURCE DATA ─────────────────────────────────────────────────────────

const CC3D_RECORD: CC3DRecord = {
  BuildingID: "CC3D-SF-0667001",
  APN: "0667-001",
  CAD_BRZNodename: "BRZ_0667001_A",
  parcel_id: "0667001",
  country: "US",
  state: "CA",
  city: "San Francisco",
  area: 2508,
  height: 183,
  topZ: 183,
  volume: 459465,
  flatHeight: 180,
  roofAngle: 0,
  zoning: "C-3-O",
  gen_hght: 250,
  height1: "600-S",
  source: "SF_2024_StereoCapture_v3.model",
  sourceInternalID: "SB-SF-2024-0667001",
  dataType: "SB",
};

const ASSESSOR_DATA: AssessorRecord = {
  apn: "0667001",
  use_def: "OFFICE",
  secondary_use_def: "RETAIL STORES",
  property_class_code: "A",
  year_property_built: "1982",
  assessed_improvement_val: "145000000",
  assessed_land_val: "40000000",
  ownership_type: "CO",
  tax_year: "2023",
};

const PERMIT_DATA: DBIPermitRecord[] = [
  {
    permit_number: "2023-1234567",
    permit_type_definition: "Additions Alterations Or Repairs",
    filed_date: "2023-03-15T00:00:00.000",
    issued_date: "2023-05-20T00:00:00.000",
    completed_date: "2023-11-10T00:00:00.000",
    status: "complete",
    description: "Interior tenant improvement — floors 22-28",
    proposed_use: "Office",
    existing_use: "Office",
    block: "0667",
    lot: "001",
  },
  {
    permit_number: "2019-0412345",
    permit_type_definition: "Additions Alterations Or Repairs",
    filed_date: "2019-04-01T00:00:00.000",
    issued_date: "2019-06-15T00:00:00.000",
    completed_date: "2019-12-20T00:00:00.000",
    status: "complete",
    description: "Interior tenant improvement — floors 12-18",
    proposed_use: "Office",
    existing_use: "Office",
    block: "0667",
    lot: "001",
  },
];

const ZONING_DATA: ZoningAttributes[] = [
  { ZONING_SIM: "C-3-O", DISTRICTNAME: "Downtown Commercial, Office", SPECIAL_USE_DIST: null },
];

const HEIGHT_DATA: HeightBulkAttributes[] = [
  { HEIGHT_DIST: "600-S", HEIGHT_NUM: 600, BULK_DIST: "S" },
];

const ENERGY_DATA: EnergyBenchmarkRecord = {
  parcel_number: "0667001",
  site_eui: "45.2",
  weather_normalized_site_eui: "44.8",
  energy_star_score: "82",
  compliance_status: "Compliant",
  benchmark_year: "2022",
  property_name: "101 California",
  floor_area: "890000",
};

// ─── MOCK FETCH FACTORIES ─────────────────────────────────────────────────────

function socrataFetch<T>(record: T | null): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => (record ? [record] : []),
  }) as unknown as typeof fetch;
}

function socrataFetchMany<T>(records: T[]): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => records,
  }) as unknown as typeof fetch;
}

function arcgisFetch(zoning: ZoningAttributes[], height: HeightBulkAttributes[]): typeof fetch {
  let call = 0;
  return vi.fn().mockImplementation(async () => {
    const data = call === 0 ? zoning : height;
    call++;
    return {
      ok: true,
      status: 200,
      json: async () => ({ features: data.map((a) => ({ attributes: a })) }),
    };
  }) as unknown as typeof fetch;
}

// ─── PIPELINE RUNNER ──────────────────────────────────────────────────────────

async function runFullPipeline() {
  // Step 1 — CC3D bind
  const { entity: e1, warnings } = bindCC3DRecord(CC3D_RECORD);

  // Step 2 — Assessor
  const { entity: e2 } = await ingestAssessor(e1, socrataFetch(ASSESSOR_DATA));

  // Step 3 — Permits
  const { entity: e3 } = await ingestPermits(e2, socrataFetchMany(PERMIT_DATA));

  // Step 4 — Planning GIS
  const { entity: e4 } = await ingestPlanning(
    e3,
    arcgisFetch(ZONING_DATA, HEIGHT_DATA)
  );

  // Step 5 — Energy benchmarking
  const { entity: e5 } = await ingestEnergy(e4, socrataFetch(ENERGY_DATA));

  // Step 6 — AI inference
  const { entity: final, computed } = runInference(e5);

  return { final, computed, bindWarnings: warnings };
}

// ─── TESTS ────────────────────────────────────────────────────────────────────

describe("Pipeline — Step 1: CC3D bind", () => {
  test("produces no warnings for a complete CC3D record", async () => {
    const { bindWarnings } = await runFullPipeline();
    expect(bindWarnings).toHaveLength(0);
  });
});

describe("Pipeline — Step 2: Assessor", () => {
  test("building_use is populated", async () => {
    const { final } = await runFullPipeline();
    expect(final.intelligence.land_use.building_use).toBe("Office");
  });

  test("year_built is populated", async () => {
    const { final } = await runFullPipeline();
    expect(final.intelligence.history.year_built).toBe(1982);
  });

  test("assessed_value is populated", async () => {
    const { final } = await runFullPipeline();
    expect(final.intelligence.ownership.assessed_value).toBe(185_000_000);
  });

  test("ownership_type is Corporate", async () => {
    const { final } = await runFullPipeline();
    expect(final.intelligence.ownership.ownership_type).toBe("Corporate");
  });
});

describe("Pipeline — Step 3: Permits", () => {
  test("permit_history has two records", async () => {
    const { final } = await runFullPipeline();
    expect(final.intelligence.history.permit_history).toHaveLength(2);
  });

  test("last_renovated is 2023", async () => {
    const { final } = await runFullPipeline();
    expect(final.intelligence.history.last_renovated).toBe(2023);
  });

  test("occupancy_type is populated", async () => {
    const { final } = await runFullPipeline();
    expect(final.intelligence.land_use.occupancy_type).toBe("Office");
  });

  test("assessor data survives permits merge", async () => {
    const { final } = await runFullPipeline();
    expect(final.intelligence.land_use.building_use).toBe("Office");
    expect(final.intelligence.history.year_built).toBe(1982);
  });
});

describe("Pipeline — Step 4: Planning GIS", () => {
  test("zoning_code is C-3-O", async () => {
    const { final } = await runFullPipeline();
    expect(final.regulation.zoning_code).toBe("C-3-O");
  });

  test("planning source is in provenance", async () => {
    const { final } = await runFullPipeline();
    expect(final.provenance.intelligence_sources).toContain("SF Planning GIS ArcGIS");
  });

  test("all prior data survives planning merge", async () => {
    const { final } = await runFullPipeline();
    expect(final.intelligence.land_use.building_use).toBe("Office");
    expect(final.intelligence.history.permit_history).toHaveLength(2);
    expect(final.intelligence.ownership.assessed_value).toBe(185_000_000);
  });
});

describe("Pipeline — Step 5: Energy", () => {
  test("energy_use_intensity is populated", async () => {
    const { final } = await runFullPipeline();
    expect(final.intelligence.environment.energy_use_intensity).toBe(44.8);
  });

  test("sustainability_rating is A (ENERGY STAR score 82)", async () => {
    const { final } = await runFullPipeline();
    expect(final.intelligence.environment.sustainability_rating).toBe("A");
  });

  test("energy source is in provenance", async () => {
    const { final } = await runFullPipeline();
    expect(final.provenance.intelligence_sources).toContain("SF Energy Benchmarking DataSF");
  });
});

describe("Pipeline — Step 6: AI Inference", () => {
  test("readiness_score is computed and in range 0–100", async () => {
    const { final } = await runFullPipeline();
    const s = final.intelligence.signals.readiness_score;
    expect(s).not.toBeNull();
    expect(s!).toBeGreaterThanOrEqual(0);
    expect(s!).toBeLessThanOrEqual(100);
  });

  test("readiness_label is set", async () => {
    const { final } = await runFullPipeline();
    expect(["PRIME", "HIGH", "WATCH", "LOW"]).toContain(
      final.intelligence.signals.readiness_label
    );
  });

  test("redevelopment_potential is computed", async () => {
    const { final } = await runFullPipeline();
    expect(final.intelligence.signals.redevelopment_potential).not.toBeNull();
  });

  test("sustainability_score is computed", async () => {
    const { final } = await runFullPipeline();
    expect(final.intelligence.signals.sustainability_score).not.toBeNull();
  });

  test("carbon_emissions are estimated", async () => {
    const { final } = await runFullPipeline();
    expect(final.intelligence.environment.carbon_emissions).not.toBeNull();
    expect(final.intelligence.environment.carbon_emissions!).toBeGreaterThan(0);
  });

  test("inference source is in provenance", async () => {
    const { final } = await runFullPipeline();
    expect(final.provenance.intelligence_sources).toContain(
      "CityPulse AI Inference Engine"
    );
  });
});

describe("Pipeline — Full entity validation", () => {
  test("all five data sources are in provenance", async () => {
    const { final } = await runFullPipeline();
    const sources = final.provenance.intelligence_sources;
    expect(sources).toContain("SF Assessor DataSF");
    expect(sources).toContain("DBI Building Permits DataSF");
    expect(sources).toContain("SF Planning GIS ArcGIS");
    expect(sources).toContain("SF Energy Benchmarking DataSF");
    expect(sources).toContain("CityPulse AI Inference Engine");
  });

  test("no duplicate sources in provenance", async () => {
    const { final } = await runFullPipeline();
    const sources = final.provenance.intelligence_sources;
    expect(sources.length).toBe(new Set(sources).size);
  });

  test("geometry is unchanged throughout the full pipeline", async () => {
    const { final } = await runFullPipeline();
    expect(final.geometry.height_meters).toBe(183);
    expect(final.geometry.footprint_area).toBe(2508);
    expect(final.geometry.roof_pitch).toBe(0);
  });

  test("identity is unchanged throughout the full pipeline", async () => {
    const { final } = await runFullPipeline();
    expect(final.identity.building_id).toBe("CC3D-SF-0667001");
    expect(final.identity.apn).toBe("0667-001");
    expect(final.identity.city).toBe("San Francisco");
  });

  test("schema_version is still 1.0 after full pipeline", async () => {
    const { final } = await runFullPipeline();
    expect(final.schema_version).toBe("1.0");
  });

  test("intelligence completeness score is above 70% after full pipeline", async () => {
    const { final } = await runFullPipeline();
    const completeness = intelligenceCompleteness(final);
    expect(completeness).toBeGreaterThan(70);
  });

  test("intelligence completeness score is a valid percentage", async () => {
    const { final } = await runFullPipeline();
    const completeness = intelligenceCompleteness(final);
    expect(completeness).toBeGreaterThanOrEqual(0);
    expect(completeness).toBeLessThanOrEqual(100);
  });
});

// ─── INFERENCE UNIT TESTS ─────────────────────────────────────────────────────

import {
  computeReadinessScore,
  computeReadinessLabel,
  computeRedevelopmentPotential,
  computeEconomicActivityIndex,
  computeSustainabilityScore,
  computeCarbonEmissions,
} from "./inferenceEngine";
import { emptyBuildingEntity } from "./buildingEntity";
import { mergeIntelligence } from "./entityBinder";

function entityWith(overrides: {
  geometry?: Partial<ReturnType<typeof emptyBuildingEntity>["geometry"]>;
  regulation?: Partial<ReturnType<typeof emptyBuildingEntity>["regulation"]>;
  signals?: Partial<ReturnType<typeof emptyBuildingEntity>["intelligence"]["signals"]>;
  history?: Partial<ReturnType<typeof emptyBuildingEntity>["intelligence"]["history"]>;
  environment?: Partial<ReturnType<typeof emptyBuildingEntity>["intelligence"]["environment"]>;
}) {
  const base = emptyBuildingEntity("TEST-001", "0667-001");
  return {
    ...base,
    geometry: { ...base.geometry, ...overrides.geometry },
    regulation: { ...base.regulation, ...overrides.regulation },
    intelligence: {
      ...base.intelligence,
      signals: { ...base.intelligence.signals, ...overrides.signals },
      history: { ...base.intelligence.history, ...overrides.history },
      environment: { ...base.intelligence.environment, ...overrides.environment },
    },
  };
}

describe("computeReadinessScore", () => {
  test("returns null when all inputs are missing", () => {
    const entity = emptyBuildingEntity("TEST", null);
    expect(computeReadinessScore(entity)).toBeNull();
  });

  test("scores higher with more headroom above actual height", () => {
    const low = entityWith({ regulation: { zoning_height_limit: 200 }, geometry: { height_meters: 190 } });
    const high = entityWith({ regulation: { zoning_height_limit: 200 }, geometry: { height_meters: 20 } });
    expect(computeReadinessScore(high)!).toBeGreaterThan(computeReadinessScore(low)!);
  });

  test("scores higher with more permits", () => {
    const few = entityWith({ signals: { total_permits: 1, total_hearings: 0 }, history: { year_built: 1960, last_renovated: null, permit_history: null } });
    const many = entityWith({ signals: { total_permits: 10, total_hearings: 0 }, history: { year_built: 1960, last_renovated: null, permit_history: null } });
    expect(computeReadinessScore(many)!).toBeGreaterThan(computeReadinessScore(few)!);
  });

  test("result is always in range 0–100", () => {
    const entity = entityWith({
      regulation: { zoning_height_limit: 250 },
      geometry: { height_meters: 10 },
      signals: { total_permits: 20, total_hearings: 10 },
      history: { year_built: 1900, last_renovated: null, permit_history: null },
    });
    const s = computeReadinessScore(entity)!;
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(100);
  });
});

describe("computeReadinessLabel", () => {
  test("PRIME for score >= 75", () => {
    expect(computeReadinessLabel(75)).toBe("PRIME");
    expect(computeReadinessLabel(100)).toBe("PRIME");
  });
  test("HIGH for score 50–74", () => {
    expect(computeReadinessLabel(50)).toBe("HIGH");
    expect(computeReadinessLabel(74)).toBe("HIGH");
  });
  test("WATCH for score 25–49", () => {
    expect(computeReadinessLabel(25)).toBe("WATCH");
    expect(computeReadinessLabel(49)).toBe("WATCH");
  });
  test("LOW for score < 25", () => {
    expect(computeReadinessLabel(0)).toBe("LOW");
    expect(computeReadinessLabel(24)).toBe("LOW");
  });
  test("null for null input", () => {
    expect(computeReadinessLabel(null)).toBeNull();
  });
});

describe("computeRedevelopmentPotential", () => {
  test("returns null when height data is missing", () => {
    const entity = entityWith({ regulation: { zoning_height_limit: 200 } });
    expect(computeRedevelopmentPotential(entity)).toBeNull();
  });

  test("returns 0 when building is at height limit", () => {
    const entity = entityWith({
      regulation: { zoning_height_limit: 183 },
      geometry: { height_meters: 183 },
    });
    expect(computeRedevelopmentPotential(entity)).toBe(0);
  });

  test("returns high score for underbuilt parcel", () => {
    const entity = entityWith({
      regulation: { zoning_height_limit: 200 },
      geometry: { height_meters: 10 },
    });
    expect(computeRedevelopmentPotential(entity)!).toBeGreaterThan(80);
  });

  test("result is always in range 0–100", () => {
    const entity = entityWith({
      regulation: { zoning_height_limit: 250 },
      geometry: { height_meters: 183 },
    });
    const s = computeRedevelopmentPotential(entity)!;
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(100);
  });
});

describe("computeEconomicActivityIndex", () => {
  test("returns null when all inputs are missing", () => {
    expect(computeEconomicActivityIndex(emptyBuildingEntity("T", null))).toBeNull();
  });

  test("scores increase with more permits and hearings", () => {
    const low = entityWith({ signals: { total_permits: 1, total_hearings: 0 } });
    const high = entityWith({ signals: { total_permits: 20, total_hearings: 10 } });
    expect(computeEconomicActivityIndex(high)!).toBeGreaterThan(
      computeEconomicActivityIndex(low)!
    );
  });

  test("recent renovation boosts the score", () => {
    const old = entityWith({ signals: { total_permits: 5, total_hearings: 2 }, history: { year_built: null, last_renovated: 2000, permit_history: null } });
    const recent = entityWith({ signals: { total_permits: 5, total_hearings: 2 }, history: { year_built: null, last_renovated: new Date().getFullYear() - 1, permit_history: null } });
    expect(computeEconomicActivityIndex(recent)!).toBeGreaterThan(
      computeEconomicActivityIndex(old)!
    );
  });
});

describe("computeSustainabilityScore", () => {
  test("returns null when both EUI and rating are missing", () => {
    expect(computeSustainabilityScore(emptyBuildingEntity("T", null))).toBeNull();
  });

  test("lower EUI produces higher score", () => {
    const inefficient = entityWith({ environment: { energy_use_intensity: 120, sustainability_rating: null, carbon_emissions: null, flood_risk: null, heat_island_index: null, solar_potential: null } });
    const efficient = entityWith({ environment: { energy_use_intensity: 30, sustainability_rating: null, carbon_emissions: null, flood_risk: null, heat_island_index: null, solar_potential: null } });
    expect(computeSustainabilityScore(efficient)!).toBeGreaterThan(
      computeSustainabilityScore(inefficient)!
    );
  });

  test("rating A produces higher score than rating D", () => {
    const ratingA = entityWith({ environment: { energy_use_intensity: null, sustainability_rating: "A", carbon_emissions: null, flood_risk: null, heat_island_index: null, solar_potential: null } });
    const ratingD = entityWith({ environment: { energy_use_intensity: null, sustainability_rating: "D", carbon_emissions: null, flood_risk: null, heat_island_index: null, solar_potential: null } });
    expect(computeSustainabilityScore(ratingA)!).toBeGreaterThan(
      computeSustainabilityScore(ratingD)!
    );
  });
});

describe("computeCarbonEmissions", () => {
  test("returns null when EUI is missing", () => {
    const entity = entityWith({ geometry: { footprint_area: 2508, height_meters: 183 } });
    expect(computeCarbonEmissions(entity)).toBeNull();
  });

  test("returns a positive number for valid inputs", () => {
    const entity = entityWith({
      geometry: { footprint_area: 2508, height_meters: 183 },
      environment: { energy_use_intensity: 44.8, sustainability_rating: null, carbon_emissions: null, flood_risk: null, heat_island_index: null, solar_potential: null },
    });
    expect(computeCarbonEmissions(entity)!).toBeGreaterThan(0);
  });

  test("larger building produces more emissions than smaller building", () => {
    const small = entityWith({
      geometry: { footprint_area: 500, height_meters: 10 },
      environment: { energy_use_intensity: 44.8, sustainability_rating: null, carbon_emissions: null, flood_risk: null, heat_island_index: null, solar_potential: null },
    });
    const large = entityWith({
      geometry: { footprint_area: 2508, height_meters: 183 },
      environment: { energy_use_intensity: 44.8, sustainability_rating: null, carbon_emissions: null, flood_risk: null, heat_island_index: null, solar_potential: null },
    });
    expect(computeCarbonEmissions(large)!).toBeGreaterThan(
      computeCarbonEmissions(small)!
    );
  });
});
