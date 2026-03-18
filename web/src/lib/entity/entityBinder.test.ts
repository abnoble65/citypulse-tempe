/**
 * Entity Binder Tests
 * Sprint 6 — Phase 2 Entity Binding
 *
 * Run: npx jest entityBinder.test.ts
 *
 * Uses 101 California St as the reference building.
 * Real APN: 0667-001 (SF Assessor record)
 * CC3D BuildingID is mocked — replace with live value once scene
 * credentials are confirmed with Kevin.
 */

import {
  bindCC3DRecord,
  bindCC3DRecords,
  mergeIntelligence,
  intelligenceCompleteness,
} from "./entityBinder";
import type { CC3DRecord } from "./cc3dMapping";

// ─── MOCK DATA ────────────────────────────────────────────────────────────────

/** Full mock CC3D record for 101 California St, San Francisco. */
const MOCK_101_CALIFORNIA: CC3DRecord = {
  // Identity
  BuildingID: "CC3D-SF-0667001",
  APN: "0667-001",
  CAD_BRZNodename: "BRZ_0667001_A",
  parcel_id: "0667001",
  country: "US",
  state: "CA",
  city: "San Francisco",

  // Geometry — values consistent with the 48-story tower
  area: 2508,          // footprint ~27,000 sq ft → ~2,508 m²
  height: 183,         // ~600 ft → 183 m
  topZ: 183,
  volume: 459465,      // area × height approximation
  flatHeight: 180,
  roofAngle: 0,        // flat roof

  // Regulation — Financial District C-3-O zoning
  zoning: "C-3-O",
  gen_hght: 250,       // general plan height limit (m)
  height1: "600-S",    // SF Planning Code height district

  // Provenance
  source: "SF_2024_StereoCapture_v3.model",
  sourceInternalID: "SB-SF-2024-0667001",
  dataType: "SB",
};

/** Minimal valid record — only required fields. */
const MOCK_MINIMAL: CC3DRecord = {
  BuildingID: "CC3D-TEST-001",
  APN: "1234-567",
  CAD_BRZNodename: null,
  parcel_id: null,
  country: null,
  state: null,
  city: null,
  area: null,
  height: null,
  topZ: null,
  volume: null,
  flatHeight: null,
  roofAngle: null,
  zoning: null,
  gen_hght: null,
  height1: null,
  source: null,
  sourceInternalID: null,
  dataType: null,
};

/** Invalid record — missing BuildingID. */
const MOCK_NO_ID: CC3DRecord = {
  ...MOCK_MINIMAL,
  BuildingID: "",
  APN: "9999-999",
};

/** Record missing APN — entity cannot link to city datasets. */
const MOCK_NO_APN: CC3DRecord = {
  ...MOCK_101_CALIFORNIA,
  APN: null,
};

// ─── TESTS ────────────────────────────────────────────────────────────────────

describe("bindCC3DRecord — 101 California St", () => {
  const { entity, warnings } = bindCC3DRecord(MOCK_101_CALIFORNIA);

  // Schema
  test("schema version is set", () => {
    expect(entity.schema_version).toBe("1.0");
  });

  // Identity layer
  test("identity.building_id maps from BuildingID", () => {
    expect(entity.identity.building_id).toBe("CC3D-SF-0667001");
  });
  test("identity.apn maps from APN", () => {
    expect(entity.identity.apn).toBe("0667-001");
  });
  test("identity.cad_brz_nodename maps from CAD_BRZNodename", () => {
    expect(entity.identity.cad_brz_nodename).toBe("BRZ_0667001_A");
  });
  test("identity.parcel_id maps from parcel_id", () => {
    expect(entity.identity.parcel_id).toBe("0667001");
  });
  test("identity.city is San Francisco", () => {
    expect(entity.identity.city).toBe("San Francisco");
  });
  test("identity.state is CA", () => {
    expect(entity.identity.state).toBe("CA");
  });
  test("identity.country is US", () => {
    expect(entity.identity.country).toBe("US");
  });

  // Geometry layer
  test("geometry.footprint_area maps from area", () => {
    expect(entity.geometry.footprint_area).toBe(2508);
  });
  test("geometry.height_meters maps from height", () => {
    expect(entity.geometry.height_meters).toBe(183);
  });
  test("geometry.roof_elevation maps from topZ", () => {
    expect(entity.geometry.roof_elevation).toBe(183);
  });
  test("geometry.volume_m3 maps from volume", () => {
    expect(entity.geometry.volume_m3).toBe(459465);
  });
  test("geometry.roof_base_height maps from flatHeight", () => {
    expect(entity.geometry.roof_base_height).toBe(180);
  });
  test("geometry.roof_pitch maps from roofAngle", () => {
    expect(entity.geometry.roof_pitch).toBe(0);
  });

  // Regulation layer
  test("regulation.zoning_code maps from zoning", () => {
    expect(entity.regulation.zoning_code).toBe("C-3-O");
  });
  test("regulation.zoning_height_limit maps from gen_hght", () => {
    expect(entity.regulation.zoning_height_limit).toBe(250);
  });
  test("regulation.zoning_height_control maps from height1", () => {
    expect(entity.regulation.zoning_height_control).toBe("600-S");
  });

  // Provenance layer
  test("provenance.model_source maps from source", () => {
    expect(entity.provenance.model_source).toBe("SF_2024_StereoCapture_v3.model");
  });
  test("provenance.model_internal_id maps from sourceInternalID", () => {
    expect(entity.provenance.model_internal_id).toBe("SB-SF-2024-0667001");
  });
  test("provenance.model_type maps from dataType", () => {
    expect(entity.provenance.model_type).toBe("SB");
  });
  test("provenance.geometry_updated_at is stamped as ISO date", () => {
    expect(entity.provenance.geometry_updated_at).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
    );
  });

  // Intelligence layer — all null at bind time (filled by ingest jobs)
  test("intelligence.land_use.building_use is null after bind", () => {
    expect(entity.intelligence.land_use.building_use).toBeNull();
  });
  test("intelligence.history.year_built is null after bind", () => {
    expect(entity.intelligence.history.year_built).toBeNull();
  });
  test("intelligence.signals.readiness_score is null after bind", () => {
    expect(entity.intelligence.signals.readiness_score).toBeNull();
  });
  test("intelligence.ownership.assessed_value is null after bind", () => {
    expect(entity.intelligence.ownership.assessed_value).toBeNull();
  });

  // No warnings for a clean record
  test("no warnings for a complete CC3D record", () => {
    expect(warnings).toHaveLength(0);
  });
});

// ─── VALIDATION WARNINGS ─────────────────────────────────────────────────────

describe("bindCC3DRecord — validation warnings", () => {
  test("warns when APN is missing", () => {
    const { warnings } = bindCC3DRecord(MOCK_NO_APN);
    expect(warnings.some((w) => w.includes("APN"))).toBe(true);
  });

  test("warns when height is null", () => {
    const { warnings } = bindCC3DRecord(MOCK_MINIMAL);
    expect(warnings.some((w) => w.includes("height"))).toBe(true);
  });

  test("warns when zoning is null", () => {
    const { warnings } = bindCC3DRecord(MOCK_MINIMAL);
    expect(warnings.some((w) => w.includes("zoning"))).toBe(true);
  });

  test("warns CRITICAL when BuildingID is missing", () => {
    const { warnings } = bindCC3DRecord(MOCK_NO_ID);
    expect(warnings.some((w) => w.includes("CRITICAL"))).toBe(true);
  });
});

// ─── BATCH BINDER ────────────────────────────────────────────────────────────

describe("bindCC3DRecords — batch", () => {
  const batch = [MOCK_101_CALIFORNIA, MOCK_MINIMAL, MOCK_NO_ID];
  const { entities, skipped, warningCount } = bindCC3DRecords(batch);

  test("binds records with valid BuildingID", () => {
    expect(entities).toHaveLength(2);
  });

  test("skips records missing BuildingID", () => {
    expect(skipped).toHaveLength(1);
    expect(skipped[0].reason).toBe("Missing BuildingID");
  });

  test("accumulates warnings across batch", () => {
    expect(warningCount).toBeGreaterThan(0);
  });
});

// ─── INTELLIGENCE MERGE ──────────────────────────────────────────────────────

describe("mergeIntelligence — SF Assessor ingest", () => {
  const { entity: base } = bindCC3DRecord(MOCK_101_CALIFORNIA);

  // Simulate what the SF Assessor ingest job would deliver
  const assessorPayload: Partial<typeof base.intelligence> = {
    land_use: {
      building_use: "Office",
      secondary_use: "Retail",
      occupancy_type: "B",
      building_class: "A",
    },
    history: {
      year_built: 1982,
      last_renovated: 2019,
      permit_history: [
        {
          permit_number: "2019-0412345",
          permit_type: "Alterations",
          filed_date: "2019-04-01",
          issued_date: "2019-06-15",
          status: "Finalled",
          description: "Interior tenant improvement — floors 12-18",
        },
      ],
    },
    ownership: {
      ownership_type: "Corporate",
      assessed_value: 185_000_000,
      market_value: null,
      vacancy_status: null,
    },
    environment: {
      energy_use_intensity: null,
      carbon_emissions: null,
      flood_risk: null,
      heat_island_index: null,
      solar_potential: null,
      sustainability_rating: null,
    },
    signals: base.intelligence.signals,
  };

  const merged = mergeIntelligence(base, assessorPayload, "SF Assessor DataSF");

  test("building_use is populated after merge", () => {
    expect(merged.intelligence.land_use.building_use).toBe("Office");
  });
  test("year_built is populated after merge", () => {
    expect(merged.intelligence.history.year_built).toBe(1982);
  });
  test("permit_history has one record", () => {
    expect(merged.intelligence.history.permit_history).toHaveLength(1);
  });
  test("assessed_value is populated after merge", () => {
    expect(merged.intelligence.ownership.assessed_value).toBe(185_000_000);
  });
  test("data source is recorded in provenance", () => {
    expect(merged.provenance.intelligence_sources).toContain("SF Assessor DataSF");
  });
  test("intelligence_updated_at is stamped", () => {
    expect(merged.provenance.intelligence_updated_at).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
    );
  });
  test("geometry fields are unchanged after intelligence merge", () => {
    expect(merged.geometry.height_meters).toBe(183);
    expect(merged.identity.apn).toBe("0667-001");
  });
});

// ─── SECOND MERGE — permits ingest ───────────────────────────────────────────

describe("mergeIntelligence — stacking two ingest sources", () => {
  const { entity: base } = bindCC3DRecord(MOCK_101_CALIFORNIA);

  const after_assessor = mergeIntelligence(
    base,
    { land_use: { building_use: "Office", secondary_use: null, occupancy_type: null, building_class: "A" } },
    "SF Assessor DataSF"
  );

  const after_signals = mergeIntelligence(
    after_assessor,
    {
      signals: {
        readiness_score: 87,
        readiness_label: "PRIME",
        permit_activity_signal: "HIGH",
        total_permits: 14,
        total_hearings: 3,
        redevelopment_potential: null,
        economic_activity_index: null,
        sustainability_score: null,
      },
    },
    "CityPulse Signal Engine"
  );

  test("both sources are in provenance after two merges", () => {
    expect(after_signals.provenance.intelligence_sources).toContain("SF Assessor DataSF");
    expect(after_signals.provenance.intelligence_sources).toContain("CityPulse Signal Engine");
  });
  test("first merge data is preserved after second merge", () => {
    expect(after_signals.intelligence.land_use.building_use).toBe("Office");
  });
  test("second merge data is present", () => {
    expect(after_signals.intelligence.signals.readiness_score).toBe(87);
    expect(after_signals.intelligence.signals.readiness_label).toBe("PRIME");
  });
  test("no duplicate sources in provenance", () => {
    const sources = after_signals.provenance.intelligence_sources;
    expect(sources.length).toBe(new Set(sources).size);
  });
});

// ─── COMPLETENESS SCORE ──────────────────────────────────────────────────────

describe("intelligenceCompleteness", () => {
  test("score is 0 after CC3D bind only (no city data yet)", () => {
    const { entity } = bindCC3DRecord(MOCK_101_CALIFORNIA);
    expect(intelligenceCompleteness(entity)).toBe(0);
  });

  test("score increases after assessor merge", () => {
    const { entity: base } = bindCC3DRecord(MOCK_101_CALIFORNIA);
    const merged = mergeIntelligence(
      base,
      {
        land_use: { building_use: "Office", secondary_use: "Retail", occupancy_type: "B", building_class: "A" },
        history: { year_built: 1982, last_renovated: 2019, permit_history: [] },
        ownership: { ownership_type: "Corporate", assessed_value: 185_000_000, market_value: null, vacancy_status: null },
        signals: {
          readiness_score: 87,
          readiness_label: "PRIME",
          permit_activity_signal: "HIGH",
          total_permits: 14,
          total_hearings: 3,
          redevelopment_potential: null,
          economic_activity_index: null,
          sustainability_score: null,
        },
      },
      "SF Assessor DataSF"
    );
    const score = intelligenceCompleteness(merged);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  test("score is 100 when all tracked fields are populated", () => {
    const { entity: base } = bindCC3DRecord(MOCK_101_CALIFORNIA);
    const merged = mergeIntelligence(
      base,
      {
        land_use: { building_use: "Office", secondary_use: "Retail", occupancy_type: "B", building_class: "A" },
        history: {
          year_built: 1982,
          last_renovated: 2019,
          permit_history: [{ permit_number: "2019-001", permit_type: "Alt", filed_date: null, issued_date: null, status: "Finalled", description: null }],
        },
        ownership: { ownership_type: "Corporate", assessed_value: 185_000_000, market_value: 220_000_000, vacancy_status: "Occupied" },
        environment: {
          energy_use_intensity: 42.3,
          carbon_emissions: 890,
          flood_risk: "Zone X",
          heat_island_index: 2.1,
          solar_potential: 145000,
          sustainability_rating: "A",
        },
        signals: {
          readiness_score: 87,
          readiness_label: "PRIME",
          permit_activity_signal: "HIGH",
          total_permits: 14,
          total_hearings: 3,
          redevelopment_potential: 72,
          economic_activity_index: 68,
          sustainability_score: 81,
        },
      },
      "Full Test Payload"
    );
    expect(intelligenceCompleteness(merged)).toBe(100);
  });
});
