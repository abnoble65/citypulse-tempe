/**
 * SF Assessor Ingest — Tests
 * Sprint 6 — Week 2
 *
 * Run: npx vitest run --globals web/src/lib/entity/assessorIngest.test.ts
 *
 * All tests use a mocked fetch — no real API calls are made.
 * Mock data reflects a realistic DataSF Assessor API response
 * for 101 California St (APN: 0667001).
 */

import {
  buildAssessorUrl,
  fetchAssessorRecord,
  transformAssessorRecord,
  ingestAssessor,
  ingestAssessorBatch,
  type AssessorRecord,
} from "./assessorIngest";
import { bindCC3DRecord } from "./entityBinder";
import type { CC3DRecord } from "./cc3dMapping";

// ─── MOCK CC3D RECORD (101 California St) ────────────────────────────────────

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

// ─── MOCK ASSESSOR API RESPONSE ──────────────────────────────────────────────
// Realistic DataSF response for 101 California St.

const MOCK_ASSESSOR_RECORD: AssessorRecord = {
  apn: "0667001",
  blk_lot: "0667001",
  use_code: "C",
  use_def: "OFFICE",
  secondary_use_code: "D",
  secondary_use_def: "RETAIL STORES",
  property_class_code: "A",
  year_property_built: "1982",
  assessed_improvement_val: "145000000",
  assessed_land_val: "40000000",
  ownership_type: "CO",
  tax_year: "2023",
};

// ─── FETCH MOCK HELPERS ───────────────────────────────────────────────────────

function mockFetch(record: AssessorRecord | null, status = 200): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => (record ? [record] : []),
  }) as unknown as typeof fetch;
}

function mockFetchEmpty(): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => [],
  }) as unknown as typeof fetch;
}

function mockFetchError(): typeof fetch {
  return vi.fn().mockRejectedValue(new Error("Network failure")) as unknown as typeof fetch;
}

// ─── URL BUILDER ─────────────────────────────────────────────────────────────

describe("buildAssessorUrl", () => {
  test("strips dashes from APN before querying", () => {
    const url = buildAssessorUrl("0667-001");
    expect(url).toContain("0667001");
    expect(url).not.toContain("0667-001");
  });

  test("includes Socrata dataset ID", () => {
    const url = buildAssessorUrl("0667001");
    expect(url).toContain("wv5m-vpq2");
  });

  test("requests only 1 result ordered by tax_year DESC", () => {
    const url = buildAssessorUrl("0667001");
    expect(url).toContain("%24limit=1");
    expect(url).toContain("tax_year+DESC");
  });

  test("includes $where filter on apn field", () => {
    const url = buildAssessorUrl("0667001");
    expect(url).toContain("%24where");
    expect(url).toContain("apn");
  });
});

// ─── FETCH ────────────────────────────────────────────────────────────────────

describe("fetchAssessorRecord", () => {
  test("returns the first record from a successful response", async () => {
    const record = await fetchAssessorRecord(
      "0667001",
      mockFetch(MOCK_ASSESSOR_RECORD)
    );
    expect(record).not.toBeNull();
    expect(record?.apn).toBe("0667001");
  });

  test("returns null when API returns empty array", async () => {
    const record = await fetchAssessorRecord("9999999", mockFetchEmpty());
    expect(record).toBeNull();
  });

  test("returns null on non-200 response", async () => {
    const record = await fetchAssessorRecord(
      "0667001",
      mockFetch(null, 500)
    );
    expect(record).toBeNull();
  });

  test("returns null on network error without throwing", async () => {
    const record = await fetchAssessorRecord("0667001", mockFetchError());
    expect(record).toBeNull();
  });
});

// ─── TRANSFORM ────────────────────────────────────────────────────────────────

describe("transformAssessorRecord — 101 California St", () => {
  const payload = transformAssessorRecord(MOCK_ASSESSOR_RECORD);

  test("building_use is title-cased from use_def", () => {
    expect(payload.land_use?.building_use).toBe("Office");
  });

  test("secondary_use is title-cased from secondary_use_def", () => {
    expect(payload.land_use?.secondary_use).toBe("Retail Stores");
  });

  test("building_class maps from property_class_code", () => {
    expect(payload.land_use?.building_class).toBe("A");
  });

  test("occupancy_type is null — comes from DBI not assessor", () => {
    expect(payload.land_use?.occupancy_type).toBeNull();
  });

  test("year_built is parsed as a number", () => {
    expect(payload.history?.year_built).toBe(1982);
  });

  test("last_renovated is null — comes from DBI permits", () => {
    expect(payload.history?.last_renovated).toBeNull();
  });

  test("assessed_value is sum of improvement + land values", () => {
    // 145_000_000 + 40_000_000 = 185_000_000
    expect(payload.ownership?.assessed_value).toBe(185_000_000);
  });

  test("ownership_type CO maps to Corporate", () => {
    expect(payload.ownership?.ownership_type).toBe("Corporate");
  });

  test("market_value is null — comes from sales records", () => {
    expect(payload.ownership?.market_value).toBeNull();
  });
});

describe("transformAssessorRecord — edge cases", () => {
  test("falls back to use_code when use_def is absent", () => {
    const record: AssessorRecord = { ...MOCK_ASSESSOR_RECORD, use_def: undefined, use_code: "C" };
    const payload = transformAssessorRecord(record);
    expect(payload.land_use?.building_use).toBe("Use Code C");
  });

  test("building_use is null when both use_def and use_code are absent", () => {
    const record: AssessorRecord = { ...MOCK_ASSESSOR_RECORD, use_def: undefined, use_code: undefined };
    const payload = transformAssessorRecord(record);
    expect(payload.land_use?.building_use).toBeNull();
  });

  test("assessed_value is null when both value fields are absent", () => {
    const record: AssessorRecord = {
      ...MOCK_ASSESSOR_RECORD,
      assessed_improvement_val: undefined,
      assessed_land_val: undefined,
    };
    const payload = transformAssessorRecord(record);
    expect(payload.ownership?.assessed_value).toBeNull();
  });

  test("year_built is null when year_property_built is absent", () => {
    const record: AssessorRecord = { ...MOCK_ASSESSOR_RECORD, year_property_built: undefined };
    const payload = transformAssessorRecord(record);
    expect(payload.history?.year_built).toBeNull();
  });

  test("unknown ownership code is passed through as-is", () => {
    const record: AssessorRecord = { ...MOCK_ASSESSOR_RECORD, ownership_type: "XX" };
    const payload = transformAssessorRecord(record);
    expect(payload.ownership?.ownership_type).toBe("XX");
  });

  test("ownership_type is null when absent", () => {
    const record: AssessorRecord = { ...MOCK_ASSESSOR_RECORD, ownership_type: undefined };
    const payload = transformAssessorRecord(record);
    expect(payload.ownership?.ownership_type).toBeNull();
  });
});

// ─── FULL INGEST ──────────────────────────────────────────────────────────────

describe("ingestAssessor — 101 California St full flow", () => {
  test("success: entity has building_use after ingest", async () => {
    const { entity: base } = bindCC3DRecord(MOCK_CC3D);
    const result = await ingestAssessor(base, mockFetch(MOCK_ASSESSOR_RECORD));

    expect(result.success).toBe(true);
    expect(result.entity.intelligence.land_use.building_use).toBe("Office");
  });

  test("success: entity has year_built after ingest", async () => {
    const { entity: base } = bindCC3DRecord(MOCK_CC3D);
    const result = await ingestAssessor(base, mockFetch(MOCK_ASSESSOR_RECORD));

    expect(result.entity.intelligence.history.year_built).toBe(1982);
  });

  test("success: entity has assessed_value after ingest", async () => {
    const { entity: base } = bindCC3DRecord(MOCK_CC3D);
    const result = await ingestAssessor(base, mockFetch(MOCK_ASSESSOR_RECORD));

    expect(result.entity.intelligence.ownership.assessed_value).toBe(185_000_000);
  });

  test("success: raw record is returned", async () => {
    const { entity: base } = bindCC3DRecord(MOCK_CC3D);
    const result = await ingestAssessor(base, mockFetch(MOCK_ASSESSOR_RECORD));

    expect(result.raw).not.toBeNull();
    expect(result.raw?.tax_year).toBe("2023");
  });

  test("success: SF Assessor is recorded in provenance", async () => {
    const { entity: base } = bindCC3DRecord(MOCK_CC3D);
    const result = await ingestAssessor(base, mockFetch(MOCK_ASSESSOR_RECORD));

    expect(result.entity.provenance.intelligence_sources).toContain(
      "SF Assessor DataSF"
    );
  });

  test("success: geometry is unchanged after ingest", async () => {
    const { entity: base } = bindCC3DRecord(MOCK_CC3D);
    const result = await ingestAssessor(base, mockFetch(MOCK_ASSESSOR_RECORD));

    expect(result.entity.geometry.height_meters).toBe(183);
    expect(result.entity.identity.apn).toBe("0667-001");
  });
});

describe("ingestAssessor — failure cases", () => {
  test("skips entity with no APN", async () => {
    const { entity: base } = bindCC3DRecord({ ...MOCK_CC3D, APN: null });
    const result = await ingestAssessor(base, mockFetch(MOCK_ASSESSOR_RECORD));

    expect(result.success).toBe(false);
    expect(result.message).toContain("no APN");
  });

  test("fails gracefully when assessor record not found", async () => {
    const { entity: base } = bindCC3DRecord(MOCK_CC3D);
    const result = await ingestAssessor(base, mockFetchEmpty());

    expect(result.success).toBe(false);
    expect(result.entity.intelligence.land_use.building_use).toBeNull();
  });

  test("fails gracefully on network error", async () => {
    const { entity: base } = bindCC3DRecord(MOCK_CC3D);
    const result = await ingestAssessor(base, mockFetchError());

    expect(result.success).toBe(false);
    expect(result.entity).toBeDefined();
  });

  test("returns original entity unchanged on failure", async () => {
    const { entity: base } = bindCC3DRecord(MOCK_CC3D);
    const result = await ingestAssessor(base, mockFetchEmpty());

    // Entity is returned but intelligence is still null
    expect(result.entity.identity.building_id).toBe("CC3D-SF-0667001");
    expect(result.entity.intelligence.land_use.building_use).toBeNull();
  });
});

// ─── BATCH INGEST ─────────────────────────────────────────────────────────────

describe("ingestAssessorBatch", () => {
  const MOCK_CC3D_NO_APN: CC3DRecord = { ...MOCK_CC3D, BuildingID: "CC3D-SF-NO-APN", APN: null };

  test("succeeds for entities with APN", async () => {
    const { entity: e1 } = bindCC3DRecord(MOCK_CC3D);
    const { entity: e2 } = bindCC3DRecord(MOCK_CC3D_NO_APN);

    const result = await ingestAssessorBatch(
      [e1, e2],
      mockFetch(MOCK_ASSESSOR_RECORD),
      0 // no delay in tests
    );

    expect(result.succeeded).toHaveLength(1);
    expect(result.failed).toHaveLength(1);
  });

  test("failed entries include building_id and reason", async () => {
    const { entity: e } = bindCC3DRecord(MOCK_CC3D_NO_APN);
    const result = await ingestAssessorBatch([e], mockFetch(null), 0);

    expect(result.failed[0].building_id).toBe("CC3D-SF-NO-APN");
    expect(result.failed[0].reason).toBeTruthy();
  });

  test("succeeded entities have intelligence populated", async () => {
    const { entity: e } = bindCC3DRecord(MOCK_CC3D);
    const result = await ingestAssessorBatch(
      [e],
      mockFetch(MOCK_ASSESSOR_RECORD),
      0
    );

    expect(
      result.succeeded[0].intelligence.land_use.building_use
    ).toBe("Office");
  });
});
