/**
 * services/aggregator.ts — CityPulse web
 *
 * Fetches all three DataSF datasets in parallel and returns a single
 * structured summary object for the requested supervisor district.
 */

import {
  fetchBuildingPermits,
  fetchDevelopmentPipeline,
  fetchZoningDistricts,
  type BuildingPermit,
  type DevelopmentProject,
  type ZoningDistrict,
} from './DataSF';
import type { DistrictConfig } from '../districts';

export interface NotablePermit {
  permit_number: string;
  address: string;
  description: string;
  estimated_cost_usd: number;
  status: string;
}

export interface ZipPermitSummary {
  total: number;
  by_type: Record<string, number>;
  by_status: Record<string, number>;
  cost_by_type: Record<string, number>;
  total_estimated_cost_usd: number;
}

export interface PermitSummary extends ZipPermitSummary {
  notable_permits: NotablePermit[];
  by_zip: Record<string, ZipPermitSummary>;
}

export interface PipelineSummary {
  total: number;
  net_pipeline_units: number;
  by_status: Record<string, number>;
  total_affordable_units: number;
}

export interface ZoningProfile {
  unique_zoning_codes: string[];
  special_use_districts: string[];
  height_range: string | null;
}

export interface DateRange {
  start: string;
  end: string;
}

export interface DistrictData {
  permit_summary: PermitSummary;
  pipeline_summary: PipelineSummary;
  zoning_profile: ZoningProfile;
  date_range: DateRange;
}

function countBy<T>(items: T[], key: (item: T) => string): Record<string, number> {
  const result: Record<string, number> = {};
  for (const item of items) {
    const k = key(item);
    result[k] = (result[k] ?? 0) + 1;
  }
  return result;
}

function parseCost(value: string | undefined): number {
  const n = parseFloat(value ?? '');
  return isNaN(n) ? 0 : n;
}

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function buildZipSummary(permits: BuildingPermit[]): ZipPermitSummary {
  const by_type = countBy(permits, (p) => p.permit_type_definition ?? p.permit_type);
  const by_status = countBy(permits, (p) => p.status);
  const cost_by_type: Record<string, number> = {};
  let total_estimated_cost_usd = 0;
  for (const p of permits) {
    const cost = parseCost(p.revised_cost ?? p.estimated_cost);
    const type = p.permit_type_definition ?? p.permit_type;
    cost_by_type[type] = (cost_by_type[type] ?? 0) + cost;
    total_estimated_cost_usd += cost;
  }
  return { total: permits.length, by_type, by_status, cost_by_type, total_estimated_cost_usd };
}

function buildPermitSummary(permits: BuildingPermit[]): PermitSummary {
  const base = buildZipSummary(permits);

  const notable_permits: NotablePermit[] = permits
    .filter((p) => parseCost(p.revised_cost ?? p.estimated_cost) > 1_000_000)
    .map((p) => ({
      permit_number: p.permit_number,
      address: [p.street_number, p.street_name, p.street_suffix].filter(Boolean).join(' '),
      description: p.description,
      estimated_cost_usd: parseCost(p.revised_cost ?? p.estimated_cost),
      status: p.status,
    }));

  // Bucket permits by zip code for client-side filtering
  const byZipMap: Record<string, BuildingPermit[]> = {};
  for (const p of permits) {
    const zip = p.zipcode?.trim();
    if (!zip) continue;
    (byZipMap[zip] ??= []).push(p);
  }
  const by_zip: Record<string, ZipPermitSummary> = {};
  for (const [zip, zipPermits] of Object.entries(byZipMap)) {
    by_zip[zip] = buildZipSummary(zipPermits);
  }

  return { ...base, notable_permits, by_zip };
}

function buildPipelineSummary(projects: DevelopmentProject[]): PipelineSummary {
  const net_pipeline_units = projects.reduce(
    (sum, p) => sum + (Number(p.new_pipeline_units) || 0),
    0,
  );

  const by_status = countBy(projects, (p) => p.current_status);

  const total_affordable_units = projects.reduce(
    (sum, p) => sum + (Number(p.pipeline_affordable_units) || 0),
    0,
  );

  return { total: projects.length, net_pipeline_units, by_status, total_affordable_units };
}

function buildZoningProfile(zones: ZoningDistrict[]): ZoningProfile {
  const unique_zoning_codes = [...new Set(zones.map((z) => z.zoning_sim))].sort();

  const special_use_districts = [
    ...new Set(
      zones
        .filter((z) => z.gen?.toLowerCase().includes('special'))
        .map((z) => z.districtna),
    ),
  ].sort();

  const height_range: string | null = null;

  return { unique_zoning_codes, special_use_districts, height_range };
}

function buildDateRange(
  permits: BuildingPermit[],
  projects: DevelopmentProject[],
  _zones: ZoningDistrict[],
): DateRange {
  const candidates: Date[] = [
    ...permits.map((p) => p.filed_date),
    ...permits.map((p) => p.status_date),
    ...projects.map((p) => p.current_status_date),
  ]
    .filter((s): s is string => !!s)
    .map((s) => new Date(s))
    .filter((d) => !isNaN(d.getTime()));

  if (candidates.length === 0) {
    return { start: '', end: '' };
  }

  const ms = candidates.map((d) => d.getTime());
  return {
    start: isoDate(new Date(Math.min(...ms))),
    end: isoDate(new Date(Math.max(...ms))),
  };
}

const EMPTY_PIPELINE_SUMMARY: PipelineSummary = {
  total: 0,
  net_pipeline_units: 0,
  by_status: {},
  total_affordable_units: 0,
};

const EMPTY_ZONING_PROFILE: ZoningProfile = {
  unique_zoning_codes: [],
  special_use_districts: [],
  height_range: null,
};

export async function aggregateDistrictData(district: DistrictConfig): Promise<DistrictData> {
  const [permits, allProjects, allZones] = await Promise.all([
    fetchBuildingPermits(district.number),
    fetchDevelopmentPipeline(),
    fetchZoningDistricts(),
  ]);
  console.log(`[aggregator] DataSF results — permits: ${permits.length}, pipeline: ${allProjects.length}, zoning: ${allZones.length}`);

  const projects = allProjects.filter((p) => {
    const hood = (p.nhood41 ?? '').toLowerCase();
    return district.pipelineNeighborhoods.some((n) => hood.includes(n));
  });

  const zones = allZones.filter((z) => z.districtna?.trim() && z.zoning_sim?.trim());

  if (projects.length === 0) {
    console.warn('[aggregator] No pipeline projects returned from DataSF — using empty fallback.');
  }
  const pipeline_summary =
    projects.length > 0 ? buildPipelineSummary(projects) : EMPTY_PIPELINE_SUMMARY;

  const zoningProfile = buildZoningProfile(zones);
  if (zoningProfile.unique_zoning_codes.length === 0) {
    console.warn('[aggregator] No zoning districts returned from DataSF — using empty fallback.');
  }
  const zoning_profile =
    zoningProfile.unique_zoning_codes.length > 0 ? zoningProfile : EMPTY_ZONING_PROFILE;

  return {
    permit_summary: buildPermitSummary(permits),
    pipeline_summary,
    zoning_profile,
    date_range: buildDateRange(permits, projects, []),
  };
}
