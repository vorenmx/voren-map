/**
 * REUSABLE PROCESS: makes sure every `visited_stores` lead has a matching map
 * pin. Run this any time a lead was created without going through the normal
 * scrape pipeline (manual entry, informe import, CRM-only creation, etc.) and
 * therefore has no `shops/{id}` doc or no coordinates.
 *
 * For each target lead:
 *   1. Try Google Places Text Search (same API used by the scraper) with the
 *      lead's name + address to find the real business -> full shop record
 *      (place_id, verified address, phone, rating, hours…).
 *   2. If no confident name match, fall back to the Geocoding API using just
 *      the address text to at least get coordinates -> a lower-confidence pin
 *      flagged `needs_review: true`.
 *   3. If neither works, the lead is logged to needs-review.csv untouched —
 *      nothing is written for it (never guess coordinates).
 *   4. Before writing, runs the SAME duplicate check used in production
 *      (functions/dedupe.js findDuplicates) against the live `shops`
 *      collection. A detected duplicate is skipped and logged instead of
 *      written, so this tool can never create a collision.
 *   5. Writes `shops/{id}` using the SAME doc id as the `visited_stores/{id}`
 *      lead (the convention this codebase relies on everywhere), and
 *      back-fills blank latitude/longitude/phone on the lead doc.
 *
 * DRY-RUN by default. Pass --apply to write. Pass --id=<visitedStoreDocId> to
 * target a single lead instead of scanning all of them.
 *
 * Requires:
 *   - ADC: gcloud auth application-default login (as an @voren.com.mx user)
 *   - GOOGLE_MAPS_API_KEY in the repo root .env, with "Places API (New)" and
 *     "Geocoding API" enabled on that key's GCP project.
 *
 * Usage:
 *   node geocode-and-pin.mjs                 # dry-run, all leads missing a pin
 *   node geocode-and-pin.mjs --apply          # write
 *   node geocode-and-pin.mjs --id=abc123      # single lead, dry-run
 */
import fs from 'node:fs';
import path from 'node:path';
import admin from 'firebase-admin';
import { compareTwoStrings } from 'string-similarity';
import { findDuplicates } from '../../functions/dedupe.js';

const APPLY = process.argv.includes('--apply');
const ONLY_ID = process.argv.find((a) => a.startsWith('--id='))?.split('=')[1] || null;
const OUT_DIR = path.join(process.cwd(), 'out');
const PLACES_DELAY_MS = 250;

function loadEnvKey() {
  const envPath = path.join(process.cwd(), '..', '..', '.env');
  if (!fs.existsSync(envPath)) return process.env.GOOGLE_MAPS_API_KEY || null;
  const text = fs.readFileSync(envPath, 'utf8');
  const m = text.match(/^GOOGLE_MAPS_API_KEY\s*=\s*(.+)$/m);
  return (m && m[1].trim()) || process.env.GOOGLE_MAPS_API_KEY || null;
}
const API_KEY = loadEnvKey();

admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: 'voren-map' });
const db = admin.firestore();
const { GeoPoint } = admin.firestore;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Same alcaldía list used elsewhere in this repo's informe tooling.
const ALCALDIAS = [
  'alvaro obregon', 'azcapotzalco', 'benito juarez', 'coyoacan', 'cuajimalpa',
  'cuauhtemoc', 'gustavo a madero', 'iztacalco', 'iztapalapa', 'magdalena contreras',
  'miguel hidalgo', 'milpa alta', 'tlahuac', 'tlalpan', 'venustiano carranza', 'xochimilco',
];
const MUNI_DISPLAY = {
  'alvaro obregon': 'Álvaro Obregón', azcapotzalco: 'Azcapotzalco', 'benito juarez': 'Benito Juárez',
  coyoacan: 'Coyoacán', cuajimalpa: 'Cuajimalpa', cuauhtemoc: 'Cuauhtémoc',
  'gustavo a madero': 'Gustavo A. Madero', iztacalco: 'Iztacalco', iztapalapa: 'Iztapalapa',
  'magdalena contreras': 'La Magdalena Contreras', 'miguel hidalgo': 'Miguel Hidalgo',
  'milpa alta': 'Milpa Alta', tlahuac: 'Tláhuac', tlalpan: 'Tlalpan',
  'venustiano carranza': 'Venustiano Carranza', xochimilco: 'Xochimilco',
};
// Real alcaldía is usually near the END of a Mexican address (before the
// postal code / city), so prefer the LAST occurring match. Avoids picking a
// street named after an alcaldía (e.g. "Av. Benito Juarez" in Iztapalapa).
function municipalityFromAddress(direccion) {
  const n = norm(direccion);
  let best = null, bestIdx = -1;
  for (const a of ALCALDIAS) {
    const idx = n.lastIndexOf(a);
    if (idx > bestIdx) { bestIdx = idx; best = a; }
  }
  return best ? MUNI_DISPLAY[best] : null;
}

function inferShopType(name) {
  const t = norm(name);
  const esTaller = /(reparaci|taller|servicio|mecanic|repair|motoserv|moto\s*servicio)/.test(t);
  const esRefa = /(refaccion|refaccionar|repuesto|\bpartes?\b|accesorio|\bparts\b)/.test(t);
  if (esTaller && esRefa) return 'Both';
  if (esRefa) return 'Parts';
  if (esTaller) return 'Repair';
  return 'Other';
}

// ── Google Places Text Search (same endpoint the scraper uses) ────────────
const PLACES_FIELD_MASK = [
  'places.id', 'places.displayName', 'places.formattedAddress', 'places.location',
  'places.nationalPhoneNumber', 'places.internationalPhoneNumber', 'places.websiteUri',
  'places.googleMapsUri', 'places.rating', 'places.userRatingCount', 'places.businessStatus',
  'places.regularOpeningHours',
].join(',');

async function placesTextSearch(query) {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': PLACES_FIELD_MASK,
    },
    body: JSON.stringify({ textQuery: query, languageCode: 'es', maxResultCount: 5 }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Places HTTP ${res.status}`);
  return data.places || [];
}

// ── Google Geocoding API (address text -> coordinates only) ───────────────
async function geocodeAddress(address) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&region=mx&key=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status !== 'OK' || !data.results?.length) return null;
  const r = data.results[0];
  return {
    formatted_address: r.formatted_address,
    latitude: r.geometry.location.lat,
    longitude: r.geometry.location.lng,
  };
}

function bestPlaceMatch(name, places) {
  const target = norm(name);
  let best = null, bestScore = -1;
  for (const p of places) {
    const score = compareTwoStrings(target, norm(p.displayName?.text));
    if (score > bestScore) { bestScore = score; best = p; }
  }
  return { place: best, score: bestScore };
}

function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function findTargets() {
  const [shopsSnap, visitedSnap] = await Promise.all([
    db.collection('shops').get(),
    db.collection('visited_stores').get(),
  ]);
  const shopsById = new Map();
  shopsSnap.docs.forEach((d) => shopsById.set(d.id, d.data()));

  const targets = [];
  for (const d of visitedSnap.docs) {
    if (ONLY_ID && d.id !== ONLY_ID) continue;
    const lead = { id: d.id, ...d.data() };
    const shop = shopsById.get(d.id);
    const hasCoords = shop && Number.isFinite(Number(shop.latitude)) && Number.isFinite(Number(shop.longitude));
    if (!hasCoords) targets.push({ lead, existingShop: shop || null });
  }
  return targets;
}

async function main() {
  if (!API_KEY) {
    console.error('No se encontró GOOGLE_MAPS_API_KEY (revisa el .env en la raíz del repo).');
    process.exit(1);
  }

  const targets = await findTargets();
  console.log(`Leads sin pin en el mapa (o sin coordenadas): ${targets.length}\n`);
  if (targets.length === 0) return;

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const matched = [];
  const geocodedOnly = [];
  const needsReview = [];
  const skippedDup = [];

  for (const { lead, existingShop } of targets) {
    const nombre = lead.name || lead.company_name || lead.id;
    const direccion = lead.formatted_address || existingShop?.formatted_address || '';
    const query = [nombre, direccion || lead.municipality, lead.state || 'Ciudad de México', 'México']
      .filter(Boolean).join(', ');

    let places = [];
    try {
      places = await placesTextSearch(query);
    } catch (e) {
      console.warn(`  [Places ERROR] ${nombre}: ${e.message}`);
    }
    await sleep(PLACES_DELAY_MS);

    const { place, score } = bestPlaceMatch(nombre, places);
    let candidate = null;
    let tier = null;

    if (place && score >= 0.5) {
      tier = 'places_match';
      candidate = {
        name: place.displayName?.text || nombre,
        formatted_address: place.formattedAddress || direccion,
        latitude: place.location?.latitude ?? null,
        longitude: place.location?.longitude ?? null,
        phone: place.nationalPhoneNumber || place.internationalPhoneNumber || lead.phone || null,
        website: place.websiteUri || null,
        google_maps_url: place.googleMapsUri || null,
        rating: place.rating ?? null,
        review_count: place.userRatingCount ?? null,
        business_status: place.businessStatus || '',
        business_hours: (place.regularOpeningHours?.weekdayDescriptions || []).join(' | '),
        google_place_id: place.id || '',
        source: 'google',
      };
    } else if (direccion) {
      const geo = await geocodeAddress(direccion).catch((e) => {
        console.warn(`  [Geocoding ERROR] ${nombre}: ${e.message}`);
        return null;
      });
      await sleep(PLACES_DELAY_MS);
      if (geo) {
        tier = 'geocoded';
        candidate = {
          name: nombre,
          formatted_address: geo.formatted_address,
          latitude: geo.latitude,
          longitude: geo.longitude,
          phone: lead.phone || null,
          website: null,
          google_maps_url: null,
          rating: null,
          review_count: null,
          business_status: '',
          business_hours: '',
          google_place_id: '',
          source: 'geocoded_from_lead',
          needs_review: true,
        };
      }
    }

    if (!candidate || !Number.isFinite(Number(candidate.latitude)) || !Number.isFinite(Number(candidate.longitude))) {
      needsReview.push({ lead, motivo: 'sin_match_ni_geocoding', mejor_candidato: place?.displayName?.text || '', score: score ?? 0 });
      console.log(`- SIN UBICACIÓN: ${nombre}`);
      continue;
    }

    const municipality = lead.municipality || municipalityFromAddress(candidate.formatted_address) || null;
    const shopDoc = {
      name: candidate.name,
      company_name: lead.company_name || '',
      shop_type: lead.shop_type || inferShopType(candidate.name),
      street: null,
      street_number: null,
      interior_number: null,
      neighborhood: null,
      formatted_address: candidate.formatted_address,
      zip: null,
      locality: null,
      municipality,
      state: lead.state || 'Ciudad de México',
      country: 'Mexico',
      phone: candidate.phone,
      email: null,
      website: candidate.website,
      latitude: candidate.latitude,
      longitude: candidate.longitude,
      location: new GeoPoint(candidate.latitude, candidate.longitude),
      rating: candidate.rating,
      review_count: candidate.review_count,
      business_status: candidate.business_status,
      business_hours: candidate.business_hours,
      employee_range: '',
      scian_description: '',
      google_maps_url: candidate.google_maps_url,
      source: candidate.source,
      denue_id: '',
      google_place_id: candidate.google_place_id,
      purchases: null,
      average_order: null,
      ...(candidate.needs_review ? { needs_review: true } : {}),
      imported_at: new Date().toISOString(),
    };

    // Self-check with the SAME production dedupe logic before writing.
    const dups = await findDuplicates(db, shopDoc, lead.id);
    if (dups.length > 0) {
      skippedDup.push({ lead, dups });
      console.log(`- OMITIDO (posible duplicado de ${dups[0].id} por ${dups[0].on}): ${nombre}`);
      continue;
    }

    const bucket = tier === 'places_match' ? matched : geocodedOnly;
    bucket.push({ lead, shopDoc });
    console.log(`- ${tier === 'places_match' ? 'MATCH' : 'GEOCODED'}: ${nombre}  (${candidate.latitude}, ${candidate.longitude})  score=${score.toFixed(2)}`);

    if (APPLY) {
      await db.collection('shops').doc(lead.id).set(shopDoc, { merge: true });
      // Back-fill only blanks on the lead — never overwrite existing values.
      const fill = {};
      if (lead.latitude == null) fill.latitude = candidate.latitude;
      if (lead.longitude == null) fill.longitude = candidate.longitude;
      if (!lead.phone && candidate.phone) fill.phone = candidate.phone;
      if (!lead.formatted_address && candidate.formatted_address) fill.formatted_address = candidate.formatted_address;
      if (Object.keys(fill).length) {
        await db.collection('visited_stores').doc(lead.id).set(fill, { merge: true });
      }
    }
  }

  // Reports
  const reviewHeader = ['id', 'nombre', 'motivo', 'mejor_candidato', 'score', 'direccion'];
  const reviewCsv = [reviewHeader.join(','), ...needsReview.map((r) => [
    csvCell(r.lead.id), csvCell(r.lead.name), csvCell(r.motivo), csvCell(r.mejor_candidato), csvCell(r.score),
    csvCell(r.lead.formatted_address || ''),
  ].join(','))];
  fs.writeFileSync(path.join(OUT_DIR, 'needs-review.csv'), '\ufeff' + reviewCsv.join('\n'), 'utf8');

  const dupHeader = ['id', 'nombre', 'duplicado_de', 'motivo'];
  const dupCsv = [dupHeader.join(','), ...skippedDup.map((r) => [
    csvCell(r.lead.id), csvCell(r.lead.name), csvCell(r.dups[0].id), csvCell(r.dups[0].on),
  ].join(','))];
  fs.writeFileSync(path.join(OUT_DIR, 'skipped-duplicates.csv'), '\ufeff' + dupCsv.join('\n'), 'utf8');

  console.log('\n===== RESUMEN =====');
  console.log(`Total leads sin pin:      ${targets.length}`);
  console.log(`Match en Places (alta confianza): ${matched.length}`);
  console.log(`Solo geocodificado (revisar):      ${geocodedOnly.length}`);
  console.log(`Omitidos por posible duplicado:    ${skippedDup.length}`);
  console.log(`Sin ubicación (revisar manual):    ${needsReview.length}`);
  console.log(`\nneeds-review.csv: ${path.join(OUT_DIR, 'needs-review.csv')}`);
  console.log(`skipped-duplicates.csv: ${path.join(OUT_DIR, 'skipped-duplicates.csv')}`);

  if (!APPLY) {
    console.log('\n[DRY-RUN] No se escribió nada. Ejecuta con --apply para crear los pines.');
  } else {
    console.log(`\n[APPLY] Pines creados: ${matched.length + geocodedOnly.length}`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
