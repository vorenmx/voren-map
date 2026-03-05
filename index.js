import 'dotenv/config';
import { extractDenueData } from './src/extractors/denue.js';
import { extractGoogleMapsData } from './src/extractors/googleMaps.js';
import { deduplicateAndMerge } from './src/processing/deduplication.js';
import { exportAllCsvs, saveRawJson, loadRawJson } from './src/exporters/csv.js';
import { log } from './src/utils/logger.js';

const SOURCE = 'MAIN';

async function main() {
  const args = process.argv.slice(2);
  const denueOnly = args.includes('--denue-only');
  const googleOnly = args.includes('--google-only');
  const mergeOnly = args.includes('--merge');

  const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;
  const denueToken = process.env.INEGI_DENUE_TOKEN;

  if (!denueOnly && !mergeOnly && !googleApiKey) {
    console.error('Missing GOOGLE_MAPS_API_KEY in .env file');
    process.exit(1);
  }
  if (!googleOnly && !mergeOnly && !denueToken) {
    console.error('Missing INEGI_DENUE_TOKEN in .env file');
    process.exit(1);
  }

  const startTime = Date.now();
  log(SOURCE, '=== Motorcycle Shop Data Extraction - Mexico ===');

  let denueRecords = [];
  let googleRecords = [];

  if (mergeOnly) {
    log(SOURCE, 'Mode: Merge from saved data');
    log(SOURCE, '--- Loading saved raw data ---');
    denueRecords = loadRawJson('denue') || [];
    googleRecords = loadRawJson('google') || [];

    if (denueRecords.length === 0 && googleRecords.length === 0) {
      console.error('No saved data found. Run --denue-only and/or --google-only first.');
      process.exit(1);
    }
  } else {
    log(SOURCE, `Mode: ${denueOnly ? 'DENUE only' : googleOnly ? 'Google Maps only' : 'Both sources'}`);

    if (!googleOnly) {
      log(SOURCE, '--- Phase 1: INEGI DENUE Extraction ---');
      denueRecords = await extractDenueData(denueToken);
      await saveRawJson(denueRecords, 'denue');
    }

    if (!denueOnly) {
      log(SOURCE, '--- Phase 2: Google Maps Extraction ---');
      googleRecords = await extractGoogleMapsData(googleApiKey);
      await saveRawJson(googleRecords, 'google');
    }
  }

  log(SOURCE, '--- Deduplication & Merge ---');
  const mergedRecords = deduplicateAndMerge(denueRecords, googleRecords);

  log(SOURCE, '--- CSV Export (3 files) ---');
  const results = await exportAllCsvs(denueRecords, googleRecords, mergedRecords);

  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  log(SOURCE, '=== DONE ===');
  log(SOURCE, `Total time: ${elapsed} minutes`);
  if (results.denue) log(SOURCE, `DENUE file: ${results.denue.filepath} (${results.denue.count} records)`);
  if (results.google) log(SOURCE, `Google file: ${results.google.filepath} (${results.google.count} records)`);
  if (results.merged) log(SOURCE, `Merged file: ${results.merged.filepath} (${results.merged.count} records)`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
