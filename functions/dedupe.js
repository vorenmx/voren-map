/**
 * Duplicate detection for `shops`.
 *
 * A candidate is a duplicate of an existing shop when ANY of these hold:
 *   - same phone (last 10 digits)                       -> strong
 *   - same normalized address                           -> strong
 *   - same normalized name AND within 150 m             -> strong
 *
 * Name-only matches are intentionally NOT enough: generic names such as
 * "TALLER DE MOTOS" repeat across genuinely different stores, so we require
 * geographic proximity before trusting a name match.
 */

const PROXIMITY_KM = 0.15; // 150 meters

export function normText(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function phone10(s) {
  const d = String(s || '').replace(/\D/g, '');
  return d.length >= 10 ? d.slice(-10) : '';
}

export function buildAddress(s) {
  const fa = s.formatted_address || s.full_address || '';
  if (fa && fa.trim()) return fa;
  return [s.street, s.street_number, s.neighborhood, s.municipality, s.state]
    .filter(Boolean)
    .join(' ');
}

export function normAddr(s) {
  return normText(buildAddress(s));
}

/**
 * Address usable as a STRONG dedupe signal: only when there is street-level
 * detail (a real formatted address, or a street/street_number). Without it,
 * buildAddress falls back to just "municipality state", which is identical for
 * every addressless shop in the same municipality and would wrongly flag
 * genuinely different stores as duplicates. Returns '' when not specific.
 */
export function specificAddr(s) {
  const fa = (s.formatted_address || s.full_address || '').trim();
  if (fa) return normText(fa);
  if (s.street || s.street_number) return normAddr(s);
  return '';
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Epoch ms used to prefer the OLDER (original) record. Missing = oldest. */
export function ageOf(s) {
  const t = s.created_at || s.imported_at;
  if (!t) return 0;
  const ms = Date.parse(t);
  return Number.isNaN(ms) ? 0 : ms;
}

function completeness(s) {
  let n = 0;
  if (phone10(s.phone)) n += 1;
  if (normAddr(s)) n += 1;
  if (normText(s.name)) n += 1;
  if (s.google_place_id) n += 1;
  if (s.denue_id) n += 1;
  return n;
}

/**
 * Returns existing shops that duplicate `cand` (excluding `excludeId`).
 * Each result: { id, data, on } where `on` is the matched field.
 * Scans within the same municipality when available to bound cost.
 */
export async function findDuplicates(db, cand, excludeId) {
  const muni = cand.municipality || '';
  const snap = muni
    ? await db.collection('shops').where('municipality', '==', muni).get()
    : await db.collection('shops').get();

  const cName = normText(cand.name);
  const cPhone = phone10(cand.phone);
  const cAddr = specificAddr(cand);
  const cLat = Number(cand.latitude);
  const cLng = Number(cand.longitude);

  const out = [];
  for (const d of snap.docs) {
    if (d.id === excludeId) continue;
    const e = d.data();
    let on = null;
    if (cPhone && phone10(e.phone) === cPhone) on = 'telefono';
    else if (cAddr && specificAddr(e) === cAddr) on = 'direccion';
    else if (cName && normText(e.name) === cName) {
      const eLat = Number(e.latitude);
      const eLng = Number(e.longitude);
      if ([cLat, cLng, eLat, eLng].every(Number.isFinite) &&
          haversineKm(cLat, cLng, eLat, eLng) <= PROXIMITY_KM) {
        on = 'nombre+ubicacion';
      }
    }
    if (on) out.push({ id: d.id, data: e, on });
  }
  return out;
}

/**
 * Deterministically pick which record to KEEP from a group of duplicates.
 * Priority: oldest first -> most complete -> smallest id.
 */
export function chooseKeeper(group) {
  return [...group].sort((a, b) => {
    const aa = ageOf(a.data);
    const ab = ageOf(b.data);
    if (aa !== ab) return aa - ab;
    const ca = completeness(a.data);
    const cb = completeness(b.data);
    if (ca !== cb) return cb - ca;
    return a.id < b.id ? -1 : 1;
  })[0].id;
}
