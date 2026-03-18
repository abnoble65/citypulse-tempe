/**
 * DBI Building Permits — Ingest Tests
 * Sprint 6 — Week 2
 *
 * Run: npx vitest run --globals web/src/lib/entity/permitsIngest.test.ts
 *
 * All tests use mocked fetch — no real API calls made.
 * Mock data reflects realistic DBI permit records for
 * 101 California St (APN: 0667-001, block: 0667, lot: 001).
 */

import {
  parseBlockLot,
  buildPermitsUrl,
  fetchPermitRecords,
  toPermitRecord,
  deriveLastRenovated,
  deriveOccupancyType,
  transformPermitRecords,
  ingestPermits,
  ingestPermitsBatch,
  type DBIPermitRecord,
} from "./permitsIngest";
import { bindCC3DRecord } from "./entityBinder";
import type { CC3DRecord } from "./cc3dMapping";

// ─── MOCK CC3D RECORD ────────────────────────────────────────────────────────

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

// ─── MOCK DBI PERMIT RECORDS ─────────────────────────────────────────────────

const PERMIT_2023: DBIPermitRecord = {
  permit_number: "2023-1234567",
  permit_type_definition: "Additions Alterations Or Repairs",
  filed_date: "2023-03-15T00:00:00.000",
  issued_date: "2023-05-20T00:00:00.000",
  completed_date: "2023-11-10T00:00:00.000",
  status: "complete",
  description: "Interior tenant improvement — floors 22-28",
  proposed_use: "Office",
  existing_use: "Office",
  estimated_cost: "1200000",
  block: "0667",
  lot: "001",
};

const PERMIT_2019: DBIPermitRecord = {
  permit_number: "2019-0412345",
  permit_type_definition: "Additions Alterations Or Repairs",
  filed_date: "2019-04-01T00:00:00.000",
  issued_date: "2019-06-15T00:00:00.000",
  completed_date: "2019-12-20T00:00:00.000",
  status: "complete",
  description: "Interior tenant improvement — floors 12-18",
  proposed_use: "Office",
  existing_use: "Office",
  estimated_cost: "850000",
  block: "0667",
  lot: "001",
};

const PERMIT_FILED_ONLY: DBIPermitRecord = {
  permit_number: "2024-0099999",
  permit_type_definition: "New Construction",
  filed_date: "2024-01-10T00:00:00.000",
  issued_date: undefined,
  completed_date: undefined,
  status: "filed",
  description: "Rooftop mechanical replacement",
  proposed_use: "Office",
  existing_use: undefined,
  estimated_cost: "500000",
  block: "0667",
  lot: "001",
};

const MOCK_PERMITS = [PERMIT_2023, PERMIT_2019, PERMIT_FILED_ONLY];

// ─── FETCH MOCK HELPERS ───────────────────────────────────────────────────────

function mockFetch(records: DBIPermitRecord[], status = 200): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => records,
  }) as unknown as typeof fetch;
}

function mockFetchError(): typeof fetch {
  return vi.fn().mockRejectedValue(new Error("Network failure")) as unknown as typeof fetch;
}

// ─── BLOCK/LOT PARSER ────────────────────────────────────────────────────────

describe("parseBlockLot", () => {
  test("parses standard APN with dash", () => {
    const result = parseBlockLot("0667-001");
    expect(result).toEqual({ block: "0667", lot: "001" });
  });

  test("parses APN without dash", () => {
    const result = parseBlockLot("0667001");
    expect(result).toEqual({ block: "0667", lot: "001" });
  });

  test("strips non-numeric characters before parsing", () => {
    const result = parseBlockLot("0667-001A");
    expect(result).toEqual({ block: "0667", lot: "001" });
  });

  test("returns null when APN is too short to parse", () => {
    const result = parseBlockLot("123");
    expect(result).toBeNull();
  });

  test("returns null for empty string", () => {
    const result = parseBlockLot("");
    expect(result).toBeNull();
  });
});

// ─── URL BUILDER ─────────────────────────────────────────────────────────────

describe("buildPermitsUrl", () => {
  test("includes correct dataset ID", () => {
    const url = buildPermitsUrl("0667-001");
    expect(url).toContain("i98e-djp9");
  });

  test("filters on block and lot separately", () => {
    const url = buildPermitsUrl("0667-001");
    expect(url).toContain("block");
    expect(url).toContain("lot");
    expect(url).toContain("0667");
    expect(url).toContain("001");
  });

  test("orders results by filed_date DESC", () => {
    const url = buildPermitsUrl("0667-001");
    expect(url).toContain("filed_date+DESC");
  });

  test("limits results to MAX_PERMITS", () => {
    const url = buildPermitsUrl("0667-001");
    expect(url).toContain("%24limit=50");
  });

  test("throws for an unparseable APN", () => {
    expect(() => buildPermitsUrl("bad")).toThrow();
  });
});

// ─── FETCH ────────────────────────────────────────────────────────────────────

describe("fetchPermitRecords", () => {
  test("returns permit records on success", async () => {
    const records = await fetchPermitRecords("0667-001", mockFetch(MOCK_PERMITS));
    expect(records).toHaveLength(3);
  });

  test("returns empty array when API returns no records", async () => {
    const records = await fetchPermitRecords("0667-001", mockFetch([]));
    expect(records).toEqual([]);
  });

  test("returns empty array on non-200 response", async () => {
    const records = await fetchPermitRecords("0667-001", mockFetch([], 500));
    expect(records).toEqual([]);
  });

  test("returns empty array on network error without throwing", async () => {
    const records = await fetchPermitRecords("0667-001", mockFetchError());
    expect(records).toEqual([]);
  });

  test("returns empty array for unparseable APN", async () => {
    const records = await fetchPermitRecords("bad", mockFetch(MOCK_PERMITS));
    expect(records).toEqual([]);
  });
});

// ─── TRANSFORM HELPERS ────────────────────────────────────────────────────────

describe("toPermitRecord", () => {
  test("maps all fields from a complete DBI record", () => {
    const result = toPermitRecord(PERMIT_2023);
    expect(result.permit_number).toBe("2023-1234567");
    expect(result.permit_type).toBe("Additions Alterations Or Repairs");
    expect(result.filed_date).toBe("2023-03-15T00:00:00.000");
    expect(result.issued_date).toBe("2023-05-20T00:00:00.000");
    expect(result.status).toBe("complete");
    expect(result.description).toBe("Interior tenant improvement — floors 22-28");
  });

  test("uses UNKNOWN when permit_number is absent", () => {
    const result = toPermitRecord({ ...PERMIT_2023, permit_number: undefined });
    expect(result.permit_number).toBe("UNKNOWN");
  });

  test("issued_date is null when absent", () => {
    const result = toPermitRecord(PERMIT_FILED_ONLY);
    expect(result.issued_date).toBeNull();
  });
});

describe("deriveLastRenovated", () => {
  test("returns year from most recent completed permit", () => {
    const year = deriveLastRenovated([PERMIT_2023, PERMIT_2019]);
    expect(year).toBe(2023);
  });

  test("ignores permits with non-completed status", () => {
    const year = deriveLastRenovated([PERMIT_FILED_ONLY]);
    expect(year).toBeNull();
  });

  test("falls back to issued_date when completed_date is absent", () => {
    const record: DBIPermitRecord = {
      ...PERMIT_2019,
      completed_date: undefined,
      issued_date: "2019-06-15T00:00:00.000",
      status: "complete",
    };
    const year = deriveLastRenovated([record]);
    expect(year).toBe(2019);
  });

  test("returns null for empty permit list", () => {
    expect(deriveLastRenovated([])).toBeNull();
  });

  test("returns null when no completed permits exist", () => {
    expect(deriveLastRenovated([PERMIT_FILED_ONLY])).toBeNull();
  });

  test("picks the latest year when multiple completed permits exist", () => {
    const year = deriveLastRenovated(MOCK_PERMITS);
    expect(year).toBe(2023);
  });
});

describe("deriveOccupancyType", () => {
  test("returns proposed_use from first permit", () => {
    const type = deriveOccupancyType(MOCK_PERMITS);
    expect(type).toBe("Office");
  });

  test("falls back to existing_use when proposed_use is absent", () => {
    const record: DBIPermitRecord = {
      ...PERMIT_2023,
      proposed_use: undefined,
      existing_use: "Retail",
    };
    const type = deriveOccupancyType([record]);
    expect(type).toBe("Retail");
  });

  test("returns null when no use fields exist on any record", () => {
    const record: DBIPermitRecord = {
      ...PERMIT_2023,
      proposed_use: undefined,
      existing_use: undefined,
    };
    expect(deriveOccupancyType([record])).toBeNull();
  });

  test("returns null for empty permit list", () => {
    expect(deriveOccupancyType([])).toBeNull();
  });
});

// ─── FULL TRANSFORM ──────────────────────────────────────────────────────────

describe("transformPermitRecords", () => {
  const payload = transformPermitRecords(MOCK_PERMITS);

  test("permit_history contains all records", () => {
    expect(payload.history?.permit_history).toHaveLength(3);
  });

  test("last_renovated is derived from most recent completed permit", () => {
    expect(payload.history?.last_renovated).toBe(2023);
  });

  test("occupancy_type is derived from most recent permit's proposed_use", () => {
    expect(payload.land_use?.occupancy_type).toBe("Office");
  });

  test("building_use is undefined — permits job does not own this field", () => {
    expect(payload.land_use?.building_use).toBeUndefined();
  });

  test("year_built is undefined — permits job does not own this field", () => {
    expect(payload.history?.year_built).toBeUndefined();
  });

  test("returns empty permit_history for empty input", () => {
    const empty = transformPermitRecords([]);
    expect(empty.history?.permit_history).toHaveLength(0);
    expect(empty.history?.last_renovated).toBeNull();
    expect(empty.land_use?.occupancy_type).toBeNull();
  });
});

// ─── FULL INGEST ─────────────────────────────────────────────────────────────

describe("ingestPermits — 101 California St full flow", () => {
  test("success: entity has permit_history after ingest", async () => {
    const { entity: base } = bindCC3DRecord(MOCK_CC3D);
    const result = await ingestPermits(base, mockFetch(MOCK_PERMITS));

    expect(result.success).toBe(true);
    expect(result.entity.intelligence.history.permit_history).toHaveLength(3);
  });

  test("success: last_renovated is populated", async () => {
    const { entity: base } = bindCC3DRecord(MOCK_CC3D);
    const result = await ingestPermits(base, mockFetch(MOCK_PERMITS));

    expect(result.entity.intelligence.history.last_renovated).toBe(2023);
  });

  test("success: occupancy_type is populated", async () => {
    const { entity: base } = bindCC3DRecord(MOCK_CC3D);
    const result = await ingestPermits(base, mockFetch(MOCK_PERMITS));

    expect(result.entity.intelligence.land_use.occupancy_type).toBe("Office");
  });

  test("success: DBI source recorded in provenance", async () => {
    const { entity: base } = bindCC3DRecord(MOCK_CC3D);
    const result = await ingestPermits(base, mockFetch(MOCK_PERMITS));

    expect(result.entity.provenance.intelligence_sources).toContain(
      "DBI Building Permits DataSF"
    );
  });

  test("success: geometry is unchanged after ingest", async () => {
    const { entity: base } = bindCC3DRecord(MOCK_CC3D);
    const result = await ingestPermits(base, mockFetch(MOCK_PERMITS));

    expect(result.entity.geometry.height_meters).toBe(183);
    expect(result.entity.identity.apn).toBe("0667-001");
  });

  test("success with zero permits — valid state for buildings with no DBI history", async () => {
    const { entity: base } = bindCC3DRecord(MOCK_CC3D);
    const result = await ingestPermits(base, mockFetch([]));

    expect(result.success).toBe(true);
    expect(result.entity.intelligence.history.permit_history).toHaveLength(0);
    expect(result.entity.intelligence.history.last_renovated).toBeNull();
  });

  test("raw permit records are returned", async () => {
    const { entity: base } = bindCC3DRecord(MOCK_CC3D);
    const result = await ingestPermits(base, mockFetch(MOCK_PERMITS));

    expect(result.raw).toHaveLength(3);
  });
});

describe("ingestPermits — failure cases", () => {
  test("skips entity with no APN", async () => {
    const { entity: base } = bindCC3DRecord({ ...MOCK_CC3D, APN: null });
    const result = await ingestPermits(base, mockFetch(MOCK_PERMITS));

    expect(result.success).toBe(false);
    expect(result.message).toContain("no APN");
  });

  test("fails gracefully on network error", async () => {
    const { entity: base } = bindCC3DRecord(MOCK_CC3D);
    const result = await ingestPermits(base, mockFetchError());

    // Network errors return empty permits — still a successful merge
    expect(result.success).toBe(true);
    expect(result.entity.intelligence.history.permit_history).toHaveLength(0);
  });

  test("original entity is returned unchanged on APN skip", async () => {
    const { entity: base } = bindCC3DRecord({ ...MOCK_CC3D, APN: null });
    const result = await ingestPermits(base, mockFetch(MOCK_PERMITS));

    expect(result.entity.identity.building_id).toBe("CC3D-SF-0667001");
    expect(result.entity.intelligence.history.permit_history).toBeNull();
  });
});

// ─── STACKING WITH ASSESSOR ───────────────────────────────────────────────────
// Confirms permits merge doesn't clobber assessor data already in the entity.

describe("ingestPermits — stacking with prior assessor merge", () => {
  test("assessor fields survive after permits are merged", async () => {
    const { entity: base } = bindCC3DRecord(MOCK_CC3D);

    // Simulate assessor already merged
    const { mergeIntelligence } = await import("./entityBinder");
    const afterAssessor = mergeIntelligence(
      base,
      {
        land_use: {
          building_use: "Office",
          secondary_use: "Retail Stores",
          building_class: "A",
          occupancy_type: null,
        },
        history: { year_built: 1982, last_renovated: null, permit_history: null },
        ownership: { ownership_type: "Corporate", assessed_value: 185_000_000, market_value: null, vacancy_status: null },
      },
      "SF Assessor DataSF"
    );

    // Now merge permits on top
    const result = await ingestPermits(afterAssessor, mockFetch(MOCK_PERMITS));

    expect(result.entity.intelligence.land_use.building_use).toBe("Office");
    expect(result.entity.intelligence.land_use.secondary_use).toBe("Retail Stores");
    expect(result.entity.intelligence.history.year_built).toBe(1982);
    expect(result.entity.intelligence.ownership.assessed_value).toBe(185_000_000);
    expect(result.entity.intelligence.history.permit_history).toHaveLength(3);
    expect(result.entity.intelligence.history.last_renovated).toBe(2023);
    expect(result.entity.provenance.intelligence_sources).toContain("SF Assessor DataSF");
    expect(result.entity.provenance.intelligence_sources).toContain("DBI Building Permits DataSF");
  });
});

// ─── BATCH ────────────────────────────────────────────────────────────────────

describe("ingestPermitsBatch", () => {
  const MOCK_CC3D_NO_APN: CC3DRecord = {
    ...MOCK_CC3D,
    BuildingID: "CC3D-SF-NO-APN",
    APN: null,
  };

  test("processes entities with valid APN", async () => {
    const { entity: e1 } = bindCC3DRecord(MOCK_CC3D);
    const { entity: e2 } = bindCC3DRecord(MOCK_CC3D_NO_APN);

    const result = await ingestPermitsBatch(
      [e1, e2],
      mockFetch(MOCK_PERMITS),
      0
    );

    expect(result.succeeded).toHaveLength(1);
    expect(result.failed).toHaveLength(1);
  });

  test("failed entries contain building_id and reason", async () => {
    const { entity: e } = bindCC3DRecord(MOCK_CC3D_NO_APN);
    const result = await ingestPermitsBatch([e], mockFetch(MOCK_PERMITS), 0);

    expect(result.failed[0].building_id).toBe("CC3D-SF-NO-APN");
    expect(result.failed[0].reason).toBeTruthy();
  });

  test("succeeded entities have permit_history populated", async () => {
    const { entity: e } = bindCC3DRecord(MOCK_CC3D);
    const result = await ingestPermitsBatch([e], mockFetch(MOCK_PERMITS), 0);

    expect(
      result.succeeded[0].intelligence.history.permit_history
    ).toHaveLength(3);
  });
});
