/**
 * scripts/testDataSF.ts
 *
 * Smoke-test for the three DataSF service functions.
 * Logs the first result and total record count from each.
 *
 * Run from the project root:
 *   npx tsx scripts/testDataSF.ts
 */

import {
  fetchBuildingPermits,
  fetchDevelopmentPipeline,
  fetchZoningDistricts,
} from '../services/DataSF';

async function main(): Promise<void> {
  console.log('\n── Building Permits ─────────────────────────────────────');
  const permits = await fetchBuildingPermits(10);
  console.log(`Total records: ${permits.length}`);
  console.log('First result:', JSON.stringify(permits[0], null, 2));

  console.log('\n── Development Pipeline ─────────────────────────────────');
  const pipeline = await fetchDevelopmentPipeline(10);
  console.log(`Total records: ${pipeline.length}`);
  console.log('First result:', JSON.stringify(pipeline[0], null, 2));

  console.log('\n── Zoning Districts ─────────────────────────────────────');
  const zoning = await fetchZoningDistricts(10);
  console.log(`Total records: ${zoning.length}`);
  console.log('First result:', JSON.stringify(zoning[0], null, 2));
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
