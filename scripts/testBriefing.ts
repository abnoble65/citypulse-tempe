/**
 * scripts/testBriefing.ts
 *
 * Smoke-test for the AI briefing layer.
 * Calls generateBriefing and logs the full narrative response.
 *
 * Run from the project root:
 *   npx tsx scripts/testBriefing.ts
 */

import { generateBriefing } from '../services/briefing';

async function main(): Promise<void> {
  console.log('Generating District 3 briefing...\n');
  const briefing = await generateBriefing();
  console.log(briefing);
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
