import fs from 'fs';
import path from 'path';
import { deduplicateAndMerge } from './src/processing/deduplication.js';
import { exportAllCsvs } from './src/exporters/csv.js';
import { log } from './src/utils/logger.js';

const SOURCE = 'MERGE';

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  values.push(current);
  return values;
}

function readCsvToRecords(filepath) {
  if (!fs.existsSync(filepath)) return [];
  const content = fs.readFileSync(filepath, 'utf8');
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const records = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const record = {};
    headers.forEach((h, idx) => {
      record[h] = values[idx] || '';
    });
    records.push(record);
  }
  return records;
}

function csvToDenueFormat(row) {
  return {
    source: 'denue',
    denue_id: row['DENUE ID'] || '',
    name: row['Name'] || '',
    company_name: row['Company Name'] || '',
    street: row['Street'] || '',
    street_number: row['Street Number'] || '',
    interior_number: row['Interior Number'] || '',
    neighborhood: row['Neighborhood'] || '',
    zip: row['Zip'] || '',
    locality: row['Locality'] || '',
    municipality: row['Municipality'] || '',
    state: row['State'] || '',
    phone: row['Phone'] || '',
    email: row['Email'] || '',
    website: row['Website'] || '',
    latitude: parseFloat(row['Latitude']) || null,
    longitude: parseFloat(row['Longitude']) || null,
    employee_range: row['Employee Range'] || '',
    scian_description: row['SCIAN Activity'] || '',
    location_full: '',
    establishment_type: '',
  };
}

function csvToGoogleFormat(row) {
  return {
    source: 'google',
    google_place_id: row['Google Place ID'] || '',
    name: row['Name'] || '',
    formatted_address: row['Full Address'] || '',
    latitude: parseFloat(row['Latitude']) || null,
    longitude: parseFloat(row['Longitude']) || null,
    phone: row['Phone'] || '',
    website: row['Website'] || '',
    google_maps_url: row['Google Maps URL'] || '',
    rating: parseFloat(row['Google Rating']) || null,
    review_count: parseInt(row['Review Count']) || 0,
    business_status: row['Business Status'] || '',
    business_hours: row['Business Hours'] || '',
    types: '',
  };
}

async function main() {
  const outputDir = './output';
  const files = fs.readdirSync(outputDir).filter(f => f.endsWith('.csv')).sort();

  log(SOURCE, 'Looking for existing CSV files in output/...');
  files.forEach(f => log(SOURCE, `  Found: ${f}`));

  const denueFile = files.find(f => f.includes('denue_'));
  const googleFile = files.find(f => f.includes('google_maps_'));

  // If we already have separate files, use them
  // Otherwise look for the old single-file format
  let denueCsvPath = denueFile ? path.join(outputDir, denueFile) : null;
  let googleCsvPath = googleFile ? path.join(outputDir, googleFile) : null;

  // Fallback: look for old-format files (motorcycle_shops_mexico_DATE.csv)
  if (!denueCsvPath || !googleCsvPath) {
    const oldFiles = files.filter(f => f.startsWith('motorcycle_shops_mexico_'));
    if (oldFiles.length >= 2) {
      // Two old files: first is DENUE (ran first), second is Google (ran second)
      if (!denueCsvPath) denueCsvPath = path.join(outputDir, oldFiles[0]);
      if (!googleCsvPath) googleCsvPath = path.join(outputDir, oldFiles[1]);
    } else if (oldFiles.length === 1) {
      // Single file — check what's inside
      const sampleRecords = readCsvToRecords(path.join(outputDir, oldFiles[0]));
      const hasDenue = sampleRecords.some(r => r['DENUE ID']);
      const hasGoogle = sampleRecords.some(r => r['Google Place ID']);
      if (hasDenue && !hasGoogle) denueCsvPath = denueCsvPath || path.join(outputDir, oldFiles[0]);
      else if (hasGoogle && !hasDenue) googleCsvPath = googleCsvPath || path.join(outputDir, oldFiles[0]);
    }
  }

  log(SOURCE, `DENUE source: ${denueCsvPath || 'NOT FOUND'}`);
  log(SOURCE, `Google source: ${googleCsvPath || 'NOT FOUND'}`);

  let denueRecords = [];
  let googleRecords = [];

  if (denueCsvPath) {
    const rows = readCsvToRecords(denueCsvPath);
    denueRecords = rows.map(csvToDenueFormat);
    log(SOURCE, `Loaded ${denueRecords.length} DENUE records`);
  }

  if (googleCsvPath) {
    const rows = readCsvToRecords(googleCsvPath);
    googleRecords = rows.map(csvToGoogleFormat);
    log(SOURCE, `Loaded ${googleRecords.length} Google Maps records`);
  }

  if (denueRecords.length === 0 && googleRecords.length === 0) {
    console.error('No data found to merge. Run --denue-only and --google-only first.');
    process.exit(1);
  }

  log(SOURCE, '--- Deduplicating & Merging ---');
  const mergedRecords = deduplicateAndMerge(denueRecords, googleRecords);

  log(SOURCE, '--- Exporting 3 CSV files ---');
  const results = await exportAllCsvs(denueRecords, googleRecords, mergedRecords);

  log(SOURCE, '=== DONE ===');
  if (results.denue) log(SOURCE, `1. ${results.denue.filepath} (${results.denue.count} records)`);
  if (results.google) log(SOURCE, `2. ${results.google.filepath} (${results.google.count} records)`);
  if (results.merged) log(SOURCE, `3. ${results.merged.filepath} (${results.merged.count} records)`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
