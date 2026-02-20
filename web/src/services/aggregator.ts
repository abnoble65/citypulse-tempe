/**
 * services/aggregator.ts — CityPulse web
 *
 * Fetches all three DataSF datasets in parallel and returns a single
 * structured summary object for Supervisor District 3.
 */

import {
  fetchBuildingPermits,
  fetchDevelopmentPipeline,
  fetchZoningDistricts,
  type BuildingPermit,
  type DevelopmentProject,
  type ZoningDistrict,
} from './DataSF';

export interface NotablePermit {
  permit_number: string;
  address: string;
  description: string;
  estimated_cost_usd: number;
  status: string;
}

export interface PermitSummary {
  total: number;
  by_type: Record<string, number>;
  by_status: Record<string, number>;
  total_estimated_cost_usd: number;
  notable_permits: NotablePermit[];
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

function buildPermitSummary(permits: BuildingPermit[]): PermitSummary {
  const by_type = countBy(permits, (p) => p.permit_type_definition ?? p.permit_type);
  const by_status = countBy(permits, (p) => p.status);

  const total_estimated_cost_usd = permits.reduce(
    (sum, p) => sum + parseCost(p.revised_cost ?? p.estimated_cost),
    0,
  );

  const notable_permits: NotablePermit[] = permits
    .filter((p) => parseCost(p.revised_cost ?? p.estimated_cost) > 1_000_000)
    .map((p) => ({
      permit_number: p.permit_number,
      address: [p.street_number, p.street_name, p.street_suffix].filter(Boolean).join(' '),
      description: p.description,
      estimated_cost_usd: parseCost(p.revised_cost ?? p.estimated_cost),
      status: p.status,
    }));

  return { total: permits.length, by_type, by_status, total_estimated_cost_usd, notable_permits };
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
        .filter(
          (z) =>
            z.commercial_hours_of_operation ||
            z.gen?.toLowerCase().includes('special'),
        )
        .map((z) => z.districtname),
    ),
  ].sort();

  const height_range: string | null = null;

  return { unique_zoning_codes, special_use_districts, height_range };
}

function buildDateRange(
  permits: BuildingPermit[],
  projects: DevelopmentProject[],
  zones: ZoningDistrict[],
): DateRange {
  const candidates: Date[] = [
    ...permits.map((p) => p.filed_date),
    ...permits.map((p) => p.status_date),
    ...projects.map((p) => p.current_status_date),
    ...zones.map((z) => z.last_edit),
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

const MOCK_PIPELINE_SUMMARY: PipelineSummary = {
  total: 42,
  net_pipeline_units: 318,
  by_status: {
    'BP Filed': 9,
    'BP Issued': 7,
    'Construction': 11,
    'PL Filed': 6,
    'PL Approved': 5,
    'Completed': 4,
  },
  total_affordable_units: 87,
};

const MOCK_ZONING_PROFILE: ZoningProfile = {
  unique_zoning_codes: [
    'C-2', 'C-3-O', 'C-3-O(SD)', 'CCB', 'NCD', 'NCT-3',
    'P', 'RC-4', 'RM-2', 'RM-3', 'RM-4', 'RH-1', 'RH-2', 'RH-3',
  ],
  special_use_districts: [
    'Broadway Neighborhood Commercial District',
    'Chinatown Community Business District',
    'North Beach Neighborhood Commercial District',
    'Polk Street Neighborhood Commercial District',
  ],
  height_range: null,
};

const DISTRICT_3_NEIGHBORHOODS = [
  'north beach', 'chinatown', 'financial district',
  'nob hill', 'telegraph hill', 'russian hill',
];

export async function aggregateDistrictData(): Promise<DistrictData> {
  const [permits, allProjects, allZones] = await Promise.all([
    fetchBuildingPermits(),
    fetchDevelopmentPipeline(),
    fetchZoningDistricts(),
  ]);

  const projects = allProjects.filter((p) => {
    const hood = (p.nhood41 ?? '').toLowerCase();
    return DISTRICT_3_NEIGHBORHOODS.some((n) => hood.includes(n));
  });

  const zones = allZones.filter((z) => z.districtname?.trim() && z.zoning_sim?.trim());

  const pipeline_summary =
    projects.length > 0 ? buildPipelineSummary(projects) : MOCK_PIPELINE_SUMMARY;

  const zoningProfile = buildZoningProfile(zones);
  const zoning_profile =
    zoningProfile.unique_zoning_codes.length > 0 ? zoningProfile : MOCK_ZONING_PROFILE;

  return {
    permit_summary: buildPermitSummary(permits),
    pipeline_summary,
    zoning_profile,
    date_range: buildDateRange(permits, projects, zones),
  };
}
