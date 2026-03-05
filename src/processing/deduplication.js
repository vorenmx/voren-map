import stringSimilarity from 'string-similarity';
import { log } from '../utils/logger.js';

const PROXIMITY_THRESHOLD_KM = 0.1; // 100 meters
const NAME_SIMILARITY_THRESHOLD = 0.55;
const SOURCE = 'DEDUP';

function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = x => (x * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normalizeName(name) {
  return (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isMatch(denueRecord, googleRecord) {
  if (!denueRecord.latitude || !googleRecord.latitude) return false;
  if (!denueRecord.longitude || !googleRecord.longitude) return false;

  const dist = haversineKm(
    denueRecord.latitude, denueRecord.longitude,
    googleRecord.latitude, googleRecord.longitude,
  );
  if (dist > PROXIMITY_THRESHOLD_KM) return false;

  const nameSim = stringSimilarity.compareTwoStrings(
    normalizeName(denueRecord.name),
    normalizeName(googleRecord.name),
  );
  return nameSim >= NAME_SIMILARITY_THRESHOLD;
}

function mergeRecords(denueRecord, googleRecord) {
  return {
    source: 'both',
    denue_id: denueRecord.denue_id,
    google_place_id: googleRecord.google_place_id,
    name: googleRecord.name || denueRecord.name,
    company_name: denueRecord.company_name || '',
    street: denueRecord.street || '',
    street_number: denueRecord.street_number || '',
    interior_number: denueRecord.interior_number || '',
    neighborhood: denueRecord.neighborhood || '',
    formatted_address: googleRecord.formatted_address || '',
    zip: denueRecord.zip || '',
    locality: denueRecord.locality || '',
    municipality: denueRecord.municipality || '',
    state: denueRecord.state || '',
    phone: googleRecord.phone || denueRecord.phone || '',
    email: denueRecord.email || '',
    website: googleRecord.website || denueRecord.website || '',
    google_maps_url: googleRecord.google_maps_url || '',
    latitude: googleRecord.latitude || denueRecord.latitude,
    longitude: googleRecord.longitude || denueRecord.longitude,
    rating: googleRecord.rating,
    review_count: googleRecord.review_count || 0,
    business_status: googleRecord.business_status || '',
    business_hours: googleRecord.business_hours || '',
    employee_range: denueRecord.employee_range || '',
    scian_description: denueRecord.scian_description || '',
    types: googleRecord.types || '',
    shop_type: inferShopType(denueRecord, googleRecord),
  };
}

function denueToUnified(r) {
  return {
    source: 'denue',
    denue_id: r.denue_id,
    google_place_id: '',
    name: r.name,
    company_name: r.company_name || '',
    street: r.street || '',
    street_number: r.street_number || '',
    interior_number: r.interior_number || '',
    neighborhood: r.neighborhood || '',
    formatted_address: '',
    zip: r.zip || '',
    locality: r.locality || '',
    municipality: r.municipality || '',
    state: r.state || '',
    phone: r.phone || '',
    email: r.email || '',
    website: r.website || '',
    google_maps_url: '',
    latitude: r.latitude,
    longitude: r.longitude,
    rating: null,
    review_count: 0,
    business_status: '',
    business_hours: '',
    employee_range: r.employee_range || '',
    scian_description: r.scian_description || '',
    types: '',
    shop_type: inferShopType(r, null),
  };
}

function googleToUnified(r) {
  return {
    source: 'google',
    denue_id: '',
    google_place_id: r.google_place_id,
    name: r.name,
    company_name: '',
    street: '',
    street_number: '',
    interior_number: '',
    neighborhood: '',
    formatted_address: r.formatted_address || '',
    zip: '',
    locality: '',
    municipality: '',
    state: '',
    phone: r.phone || '',
    email: '',
    website: r.website || '',
    google_maps_url: r.google_maps_url || '',
    latitude: r.latitude,
    longitude: r.longitude,
    rating: r.rating,
    review_count: r.review_count || 0,
    business_status: r.business_status || '',
    business_hours: r.business_hours || '',
    employee_range: '',
    scian_description: '',
    types: r.types || '',
    shop_type: inferShopType(null, r),
  };
}

function inferShopType(denueRecord, googleRecord) {
  const text = [
    denueRecord?.scian_description,
    denueRecord?.name,
    googleRecord?.name,
    googleRecord?.types,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const isRepair =
    text.includes('reparaci') ||
    text.includes('taller') ||
    text.includes('servicio') ||
    text.includes('mecanico') ||
    text.includes('mecánico') ||
    text.includes('repair');

  const isParts =
    text.includes('refaccion') ||
    text.includes('repuesto') ||
    text.includes('parte') ||
    text.includes('accesorio') ||
    text.includes('parts') ||
    text.includes('comercio');

  if (isRepair && isParts) return 'Both';
  if (isRepair) return 'Repair';
  if (isParts) return 'Parts';
  return 'Other';
}

export function deduplicateAndMerge(denueRecords, googleRecords) {
  log(SOURCE, `Merging ${denueRecords.length} DENUE + ${googleRecords.length} Google Maps records...`);

  const merged = [];
  const matchedGoogleIndices = new Set();

  for (const dRecord of denueRecords) {
    let matched = false;

    for (let gi = 0; gi < googleRecords.length; gi++) {
      if (matchedGoogleIndices.has(gi)) continue;

      if (isMatch(dRecord, googleRecords[gi])) {
        merged.push(mergeRecords(dRecord, googleRecords[gi]));
        matchedGoogleIndices.add(gi);
        matched = true;
        break;
      }
    }

    if (!matched) {
      merged.push(denueToUnified(dRecord));
    }
  }

  for (let gi = 0; gi < googleRecords.length; gi++) {
    if (!matchedGoogleIndices.has(gi)) {
      merged.push(googleToUnified(googleRecords[gi]));
    }
  }

  const bothCount = merged.filter(r => r.source === 'both').length;
  const denueOnly = merged.filter(r => r.source === 'denue').length;
  const googleOnly = merged.filter(r => r.source === 'google').length;

  log(SOURCE, `Result: ${merged.length} total records`);
  log(SOURCE, `  Matched (both sources): ${bothCount}`);
  log(SOURCE, `  DENUE only: ${denueOnly}`);
  log(SOURCE, `  Google Maps only: ${googleOnly}`);

  return merged;
}
