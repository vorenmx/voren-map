import { createObjectCsvWriter } from 'csv-writer';
import { log } from '../utils/logger.js';
import fs from 'fs';
import path from 'path';

const SOURCE = 'CSV';

const CSV_COLUMNS = [
  { id: 'name', title: 'Name' },
  { id: 'company_name', title: 'Company Name' },
  { id: 'shop_type', title: 'Shop Type' },
  { id: 'street', title: 'Street' },
  { id: 'street_number', title: 'Street Number' },
  { id: 'interior_number', title: 'Interior Number' },
  { id: 'neighborhood', title: 'Neighborhood' },
  { id: 'formatted_address', title: 'Full Address' },
  { id: 'zip', title: 'Zip' },
  { id: 'locality', title: 'Locality' },
  { id: 'municipality', title: 'Municipality' },
  { id: 'state', title: 'State' },
  { id: 'country', title: 'Country' },
  { id: 'phone', title: 'Phone' },
  { id: 'email', title: 'Email' },
  { id: 'website', title: 'Website' },
  { id: 'latitude', title: 'Latitude' },
  { id: 'longitude', title: 'Longitude' },
  { id: 'rating', title: 'Google Rating' },
  { id: 'review_count', title: 'Review Count' },
  { id: 'business_status', title: 'Business Status' },
  { id: 'business_hours', title: 'Business Hours' },
  { id: 'employee_range', title: 'Employee Range' },
  { id: 'scian_description', title: 'SCIAN Activity' },
  { id: 'google_maps_url', title: 'Google Maps URL' },
  { id: 'source', title: 'Data Source' },
  { id: 'denue_id', title: 'DENUE ID' },
  { id: 'google_place_id', title: 'Google Place ID' },
];

function prepareRows(records) {
  return records.map(r => ({
    ...r,
    country: 'Mexico',
    rating: r.rating ?? '',
    review_count: r.review_count || '',
    latitude: r.latitude ?? '',
    longitude: r.longitude ?? '',
  }));
}

async function writeCsv(records, filepath) {
  const rows = prepareRows(records);
  const writer = createObjectCsvWriter({
    path: filepath,
    header: CSV_COLUMNS,
    encoding: 'utf8',
  });
  await writer.writeRecords(rows);
  return rows;
}

function printStats(label, rows) {
  const stats = {
    total: rows.length,
    repair: rows.filter(r => r.shop_type === 'Repair').length,
    parts: rows.filter(r => r.shop_type === 'Parts').length,
    both: rows.filter(r => r.shop_type === 'Both').length,
    other: rows.filter(r => r.shop_type === 'Other').length,
    withPhone: rows.filter(r => r.phone).length,
    withEmail: rows.filter(r => r.email).length,
    withWebsite: rows.filter(r => r.website).length,
    withRating: rows.filter(r => r.rating).length,
  };

  log(SOURCE, `[${label}] ${stats.total} records | Repair=${stats.repair} Parts=${stats.parts} Both=${stats.both} Other=${stats.other}`);
  log(SOURCE, `[${label}] Phone=${stats.withPhone} Email=${stats.withEmail} Website=${stats.withWebsite} Rating=${stats.withRating}`);
  return stats;
}

export async function exportAllCsvs(denueRecords, googleRecords, mergedRecords, outputDir = './output') {
  const date = new Date().toISOString().slice(0, 10);
  const results = {};

  if (denueRecords && denueRecords.length > 0) {
    const fp = path.join(outputDir, `denue_mexico_${date}.csv`);
    const rows = await writeCsv(denueRecords, fp);
    log(SOURCE, `Exported ${rows.length} DENUE records to ${fp}`);
    printStats('DENUE', rows);
    results.denue = { filepath: fp, count: rows.length };
  }

  if (googleRecords && googleRecords.length > 0) {
    const fp = path.join(outputDir, `google_maps_mexico_${date}.csv`);
    const rows = await writeCsv(googleRecords, fp);
    log(SOURCE, `Exported ${rows.length} Google Maps records to ${fp}`);
    printStats('GOOGLE', rows);
    results.google = { filepath: fp, count: rows.length };
  }

  if (mergedRecords && mergedRecords.length > 0) {
    const fp = path.join(outputDir, `merged_mexico_${date}.csv`);
    const rows = await writeCsv(mergedRecords, fp);
    log(SOURCE, `Exported ${rows.length} merged records to ${fp}`);
    printStats('MERGED', rows);

    const bySource = {
      denue: rows.filter(r => r.source === 'denue').length,
      google: rows.filter(r => r.source === 'google').length,
      both: rows.filter(r => r.source === 'both').length,
    };
    log(SOURCE, `[MERGED] By source: DENUE only=${bySource.denue} Google only=${bySource.google} Matched(both)=${bySource.both}`);
    results.merged = { filepath: fp, count: rows.length };
  }

  return results;
}

export async function saveRawJson(records, label, outputDir = './output') {
  const fp = path.join(outputDir, `${label}_raw.json`);
  fs.writeFileSync(fp, JSON.stringify(records, null, 2), 'utf8');
  log(SOURCE, `Saved ${records.length} raw ${label} records to ${fp}`);
  return fp;
}

export function loadRawJson(label, outputDir = './output') {
  const fp = path.join(outputDir, `${label}_raw.json`);
  if (!fs.existsSync(fp)) return null;
  const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
  log(SOURCE, `Loaded ${data.length} raw ${label} records from ${fp}`);
  return data;
}
