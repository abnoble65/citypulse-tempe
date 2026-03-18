/**
 * SF Planning GIS — Ingest Tests
 * Sprint 6 — Week 2
 *
 * Run: npx vitest run --globals web/src/lib/entity/planningIngest.test.ts
 *
 * All tests use mocked fetch — no real API calls made.
 * Mock data reflects realistic ArcGIS responses for
 * 101 California St (APN: 0667-001, BLKLOT: 0667001).
 * Zoning: C-3-O (Downtown Commercial)
 * Height district: 600-S (~183m / 600ft)
 */

import {
  apnToBlklot,
  buildZoningUrl,
  buildHeightBulkUrl,
  fetchZoningAttributes,
  fetchHeightBulkAttributes,
  feetToMetres,
  extractSpecialDistricts,
  transformZoningAttributes,
  transformHeightBulkAttributes,
  ingestPlanning,
  ingestPlanningBatch,
  type ZoningAttributes,
  type HeightBulkAttributes,
} from "./planningIngest";
import { bindCC3DRecord } from "./entityBinder";
import type { CC3DRecord } from "./cc3dMapping";

// ─── MOCK CC3D RECORD ────────────────────────────────────────────────────────

/** Base CC3D record — zoning fields already populated by CC3D. */
const MOCK_CC3D: CC3DRecord = {
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

/** CC3D record with zoning fields null — simulates a gap CC3D left empty. */
const MOCK_CC3D_NO_ZONING: CC3DRecord = {
  ...MOCK_CC3D,
  zoning: null,
  gen_hght: null,
  height1: null,
};

// ─── MOCK ARCGIS RESPONSES ───────────────────────────────────────────────────

const MOCK_ZONING: ZoningAttributes[] = [
  {
    ZONING_SIM: "C-3-O",
    DISTRICTNAME: "Downtown Commercial, Office",
    SPECIAL_USE_DIST: null,
  },
];

const MOCK_ZONING_WITH_SPECIAL: ZoningAttributes[] = [
  {
    ZONING_SIM: "C-3-O",
    DISTRICTNAME: "Downtown Commercial, Office",
    SPECIAL_USE_DIST: "TRANS",
  },
  {
    ZONING_SIM: "C-3-O",
    DISTRICTNAME: "Downtown Commercial, Office",
    SPECIAL_USE_DIST: "SOMA",
  },
];

const MOCK_HEIGHT: HeightBulkAttributes[] = [
  {
    HEIGHT_DIST: "600-S",
    HEIGHT_NUM: 600,
    BULK_DIST: "S",
  },
];

// ─── ARCGIS MOCK FETCH HELPERS ────────────────────────────────────────────────

function mockArcGIS<T>(attributes: T[], status = 200): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({
      features: attributes.map((a) => ({ attributes: a })),
    }),
  }) as unknown as typeof fetch;
}

function mockArcGISError(message = "Layer not found"): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ error: { code: 400, message } }),
  }) as unknown as typeof fetch;
}

function mockArcGISNetworkError(): typeof fetch {
  return vi.fn().mockRejectedValue(new Error("Network failure")) as unknown as typeof fetch;
}

/**
 * Mock fetch that returns zoning on the first call
 * and height/bulk on the second call (parallel Promise.all).
 */
function mockBothLayers(
  zoning: ZoningAttributes[],
  height: HeightBulkAttributes[]
): typeof fetch {
  let callCount = 0;
  return vi.fn().mockImplementation(async () => {
    const data = callCount === 0 ? zoning : height;
    callCount++;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        features: data.map((a) => ({ attributes: a })),
      }),
    };
  }) as unknown as typeof fetch;
}

// ─── APN → BLKLOT ────────────────────────────────────────────────────────────

describe("apnToBlklot", () => {
  test("strips dash from standard APN", () => {
    expect(apnToBlklot("0667-001")).toBe("0667001");
  });

  test("passes through APN already without dash", () => {
    expect(apnToBlklot("0667001")).toBe("0667001");
  });

  test("zero-pads short APNs to 7 digits", () => {
    expect(apnToBlklot("667001")).toBe("0667001");
  });

  test("strips all non-numeric characters", () => {
    expect(apnToBlklot("0667-001A")).toBe("0667001");
  });
});

// ─── URL BUILDERS ─────────────────────────────────────────────────────────────

describe("buildZoningUrl", () => {
  test("targets layer 0", () => {
    expect(buildZoningUrl("0667001")).toContain("/0/query");
  });

  test("includes BLKLOT in where clause", () => {
    expect(buildZoningUrl("0667001")).toContain("0667001");
  });

  test("requests correct zoning output fields", () => {
    const url = buildZoningUrl("0667001");
    expect(url).toContain("ZONING_SIM");
    expect(url).toContain("SPECIAL_USE_DIST");
  });

  test("sets returnGeometry to false", () => {
    expect(buildZoningUrl("0667001")).toContain("returnGeometry=false");
  });

  test("requests JSON format", () => {
    expect(buildZoningUrl("0667001")).toContain("f=json");
  });
});

describe("buildHeightBulkUrl", () => {
  test("targets layer 1", () => {
    expect(buildHeightBulkUrl("0667001")).toContain("/1/query");
  });

  test("requests correct height output fields", () => {
    const url = buildHeightBulkUrl("0667001");
    expect(url).toContain("HEIGHT_DIST");
    expect(url).toContain("HEIGHT_NUM");
  });
});

// ─── FETCH ────────────────────────────────────────────────────────────────────

describe("fetchZoningAttributes", () => {
  test("returns attribute objects from features array", async () => {
    const result = await fetchZoningAttributes(
      "0667001",
      mockArcGIS(MOCK_ZONING)
    );
    expect(result).toHaveLength(1);
    expect(result[0].ZONING_SIM).toBe("C-3-O");
  });

  test("returns empty array when no features found", async () => {
    const result = await fetchZoningAttributes("0667001", mockArcGIS([]));
    expect(result).toEqual([]);
  });

  test("returns empty array on ArcGIS error response", async () => {
    const result = await fetchZoningAttributes(
      "0667001",
      mockArcGISError()
    );
    expect(result).toEqual([]);
  });

  test("returns empty array on network error without throwing", async () => {
    const result = await fetchZoningAttributes(
      "0667001",
      mockArcGISNetworkError()
    );
    expect(result).toEqual([]);
  });

  test("returns empty array on non-200 response", async () => {
    const result = await fetchZoningAttributes(
      "0667001",
      mockArcGIS(MOCK_ZONING, 500)
    );
    expect(result).toEqual([]);
  });
});

describe("fetchHeightBulkAttributes", () => {
  test("returns height attributes from features", async () => {
    const result = await fetchHeightBulkAttributes(
      "0667001",
      mockArcGIS(MOCK_HEIGHT)
    );
    expect(result).toHaveLength(1);
    expect(result[0].HEIGHT_DIST).toBe("600-S");
    expect(result[0].HEIGHT_NUM).toBe(600);
  });

  test("returns empty array when no features found", async () => {
    const result = await fetchHeightBulkAttributes(
      "0667001",
      mockArcGIS([])
    );
    expect(result).toEqual([]);
  });
});

// ─── TRANSFORM HELPERS ────────────────────────────────────────────────────────

describe("feetToMetres", () => {
  test("converts 600 feet to ~182.9 metres", () => {
    expect(feetToMetres(600)).toBe(182.9);
  });

  test("converts 40 feet to ~12.2 metres", () => {
    expect(feetToMetres(40)).toBe(12.2);
  });

  test("returns null for undefined input", () => {
    expect(feetToMetres(undefined)).toBeNull();
  });

  test("returns null for NaN input", () => {
    expect(feetToMetres(NaN)).toBeNull();
  });
});

describe("extractSpecialDistricts", () => {
  test("returns null when no special districts present", () => {
    expect(extractSpecialDistricts(MOCK_ZONING)).toBeNull();
  });

  test("collects special district codes from multiple features", () => {
    const result = extractSpecialDistricts(MOCK_ZONING_WITH_SPECIAL);
    expect(result).toEqual(["TRANS", "SOMA"]);
  });

  test("filters out null and empty values", () => {
    const features: ZoningAttributes[] = [
      { SPECIAL_USE_DIST: "TRANS" },
      { SPECIAL_USE_DIST: null },
      { SPECIAL_USE_DIST: "" },
      { SPECIAL_USE_DIST: "None" },
    ];
    expect(extractSpecialDistricts(features)).toEqual(["TRANS"]);
  });

  test("returns null for empty feature array", () => {
    expect(extractSpecialDistricts([])).toBeNull();
  });
});

describe("transformZoningAttributes", () => {
  test("extracts zoning_code from ZONING_SIM", () => {
    const result = transformZoningAttributes(MOCK_ZONING);
    expect(result.zoning_code).toBe("C-3-O");
  });

  test("special_districts is null when not present", () => {
    const result = transformZoningAttributes(MOCK_ZONING);
    expect(result.special_districts).toBeNull();
  });

  test("collects special districts when present", () => {
    const result = transformZoningAttributes(MOCK_ZONING_WITH_SPECIAL);
    expect(result.special_districts).toEqual(["TRANS", "SOMA"]);
  });

  test("returns nulls for empty feature array", () => {
    const result = transformZoningAttributes([]);
    expect(result.zoning_code).toBeNull();
    expect(result.special_districts).toBeNull();
  });
});

describe("transformHeightBulkAttributes", () => {
  test("extracts height control label from HEIGHT_DIST", () => {
    const result = transformHeightBulkAttributes(MOCK_HEIGHT);
    expect(result.zoning_height_control).toBe("600-S");
  });

  test("converts HEIGHT_NUM from feet to metres", () => {
    const result = transformHeightBulkAttributes(MOCK_HEIGHT);
    expect(result.zoning_height_limit).toBe(182.9);
  });

  test("returns nulls for empty feature array", () => {
    const result = transformHeightBulkAttributes([]);
    expect(result.zoning_height_limit).toBeNull();
    expect(result.zoning_height_control).toBeNull();
  });
});

// ─── FULL INGEST — CC3D fields already populated ──────────────────────────────

describe("ingestPlanning — CC3D zoning fields already present", () => {
  test("does not overwrite existing CC3D zoning_code", async () => {
    const { entity: base } = bindCC3DRecord(MOCK_CC3D);
    const result = await ingestPlanning(
      base,
      mockBothLayers(MOCK_ZONING, MOCK_HEIGHT)
    );

    // CC3D had "C-3-O" — Planning GIS also says "C-3-O" — should be unchanged
    expect(result.entity.regulation.zoning_code).toBe("C-3-O");
    expect(result.success).toBe(true);
  });

  test("does not overwrite existing CC3D height control", async () => {
    const { entity: base } = bindCC3DRecord(MOCK_CC3D);
    const result = await ingestPlanning(
      base,
      mockBothLayers(MOCK_ZONING, MOCK_HEIGHT)
    );

    expect(result.entity.regulation.zoning_height_control).toBe("600-S");
  });

  test("SF Planning GIS is recorded in provenance", async () => {
    const { entity: base } = bindCC3DRecord(MOCK_CC3D);
    const result = await ingestPlanning(
      base,
      mockBothLayers(MOCK_ZONING, MOCK_HEIGHT)
    );

    expect(result.entity.provenance.intelligence_sources).toContain(
      "SF Planning GIS ArcGIS"
    );
  });
});

// ─── FULL INGEST — CC3D zoning fields null (gap fill) ────────────────────────

describe("ingestPlanning — filling CC3D gaps", () => {
  test("fills zoning_code when CC3D left it null", async () => {
    const { entity: base } = bindCC3DRecord(MOCK_CC3D_NO_ZONING);
    const result = await ingestPlanning(
      base,
      mockBothLayers(MOCK_ZONING, MOCK_HEIGHT)
    );

    expect(result.entity.regulation.zoning_code).toBe("C-3-O");
  });

  test("fills zoning_height_limit when CC3D left it null", async () => {
    const { entity: base } = bindCC3DRecord(MOCK_CC3D_NO_ZONING);
    const result = await ingestPlanning(
      base,
      mockBothLayers(MOCK_ZONING, MOCK_HEIGHT)
    );

    expect(result.entity.regulation.zoning_height_limit).toBe(182.9);
  });

  test("fills zoning_height_control when CC3D left it null", async () => {
    const { entity: base } = bindCC3DRecord(MOCK_CC3D_NO_ZONING);
    const result = await ingestPlanning(
      base,
      mockBothLayers(MOCK_ZONING, MOCK_HEIGHT)
    );

    expect(result.entity.regulation.zoning_height_control).toBe("600-S");
  });

  test("fills special_districts from Planning GIS", async () => {
    const { entity: base } = bindCC3DRecord(MOCK_CC3D_NO_ZONING);
    const result = await ingestPlanning(
      base,
      mockBothLayers(MOCK_ZONING_WITH_SPECIAL, MOCK_HEIGHT)
    );

    expect(result.entity.regulation.special_districts).toEqual(["TRANS", "SOMA"]);
  });

  test("geometry is unchanged after planning ingest", async () => {
    const { entity: base } = bindCC3DRecord(MOCK_CC3D_NO_ZONING);
    const result = await ingestPlanning(
      base,
      mockBothLayers(MOCK_ZONING, MOCK_HEIGHT)
    );

    expect(result.entity.geometry.height_meters).toBe(183);
    expect(result.entity.identity.apn).toBe("0667-001");
  });
});

// ─── FAILURE CASES ────────────────────────────────────────────────────────────

describe("ingestPlanning — failure cases", () => {
  test("skips entity with no APN", async () => {
    const { entity: base } = bindCC3DRecord({ ...MOCK_CC3D, APN: null });
    const result = await ingestPlanning(
      base,
      mockBothLayers(MOCK_ZONING, MOCK_HEIGHT)
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("no APN");
  });

  test("succeeds with nulls when ArcGIS returns no features", async () => {
    const { entity: base } = bindCC3DRecord(MOCK_CC3D_NO_ZONING);
    const result = await ingestPlanning(base, mockBothLayers([], []));

    expect(result.success).toBe(true);
    expect(result.entity.regulation.zoning_code).toBeNull();
  });

  test("succeeds gracefully on network error", async () => {
    const { entity: base } = bindCC3DRecord(MOCK_CC3D_NO_ZONING);
    const result = await ingestPlanning(base, mockArcGISNetworkError());

    expect(result.success).toBe(true);
    expect(result.entity.regulation.zoning_code).toBeNull();
  });

  test("original entity is returned unchanged on APN skip", async () => {
    const { entity: base } = bindCC3DRecord({ ...MOCK_CC3D, APN: null });
    const result = await ingestPlanning(
      base,
      mockBothLayers(MOCK_ZONING, MOCK_HEIGHT)
    );

    expect(result.entity.identity.building_id).toBe("CC3D-SF-0667001");
    expect(result.entity.regulation.zoning_code).toBe("C-3-O"); // CC3D value intact
  });
});

// ─── STACKING WITH ASSESSOR + PERMITS ────────────────────────────────────────

describe("ingestPlanning — stacking with prior ingest jobs", () => {
  test("assessor and permit data survive after planning merge", async () => {
    const { entity: base } = bindCC3DRecord(MOCK_CC3D_NO_ZONING);

    const { mergeIntelligence } = await import("./entityBinder");

    // Simulate assessor already merged
    const afterAssessor = mergeIntelligence(
      base,
      {
        land_use: {
          building_use: "Office",
          secondary_use: "Retail Stores",
          building_class: "A",
          occupancy_type: null,
        },
        history: {
          year_built: 1982,
          last_renovated: 2023,
          permit_history: [
            {
              permit_number: "2023-001",
              permit_type: "Alterations",
              filed_date: "2023-03-15",
              issued_date: "2023-05-20",
              status: "complete",
              description: "Tenant improvement",
            },
          ],
        },
        ownership: {
          ownership_type: "Corporate",
          assessed_value: 185_000_000,
          market_value: null,
          vacancy_status: null,
        },
      },
      "SF Assessor DataSF"
    );

    // Now merge planning on top
    const result = await ingestPlanning(
      afterAssessor,
      mockBothLayers(MOCK_ZONING, MOCK_HEIGHT)
    );

    // Intelligence fields from assessor must be intact
    expect(result.entity.intelligence.land_use.building_use).toBe("Office");
    expect(result.entity.intelligence.history.year_built).toBe(1982);
    expect(result.entity.intelligence.ownership.assessed_value).toBe(185_000_000);
    expect(result.entity.intelligence.history.permit_history).toHaveLength(1);

    // Regulation fields from Planning GIS must be present
    expect(result.entity.regulation.zoning_code).toBe("C-3-O");
    expect(result.entity.regulation.zoning_height_control).toBe("600-S");

    // Both sources in provenance
    expect(result.entity.provenance.intelligence_sources).toContain("SF Assessor DataSF");
    expect(result.entity.provenance.intelligence_sources).toContain("SF Planning GIS ArcGIS");
  });
});

// ─── BATCH ────────────────────────────────────────────────────────────────────

describe("ingestPlanningBatch", () => {
  const MOCK_CC3D_NO_APN: CC3DRecord = {
    ...MOCK_CC3D,
    BuildingID: "CC3D-SF-NO-APN",
    APN: null,
  };

  test("processes entities with valid APN", async () => {
    const { entity: e1 } = bindCC3DRecord(MOCK_CC3D);
    const { entity: e2 } = bindCC3DRecord(MOCK_CC3D_NO_APN);

    const result = await ingestPlanningBatch(
      [e1, e2],
      mockBothLayers(MOCK_ZONING, MOCK_HEIGHT),
      0
    );

    expect(result.succeeded).toHaveLength(1);
    expect(result.failed).toHaveLength(1);
  });

  test("failed entries contain building_id and reason", async () => {
    const { entity: e } = bindCC3DRecord(MOCK_CC3D_NO_APN);
    const result = await ingestPlanningBatch(
      [e],
      mockBothLayers(MOCK_ZONING, MOCK_HEIGHT),
      0
    );

    expect(result.failed[0].building_id).toBe("CC3D-SF-NO-APN");
    expect(result.failed[0].reason).toBeTruthy();
  });

  test("succeeded entities have regulation populated", async () => {
    const { entity: e } = bindCC3DRecord(MOCK_CC3D_NO_ZONING);
    const result = await ingestPlanningBatch(
      [e],
      mockBothLayers(MOCK_ZONING, MOCK_HEIGHT),
      0
    );

    expect(result.succeeded[0].regulation.zoning_code).toBe("C-3-O");
  });
});
