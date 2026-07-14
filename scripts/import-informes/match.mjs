import admin from 'firebase-admin';
import { compareTwoStrings } from 'string-similarity';
import { norm, phone10, municipalityFromAddress } from './parse.mjs';

const PROJECT_ID = 'voren-map';

let _db;
export function getDb() {
  if (!_db) {
    admin.initializeApp({ projectId: PROJECT_ID, credential: admin.credential.applicationDefault() });
    _db = admin.firestore();
  }
  return _db;
}

export async function loadIndex(collName) {
  const db = getDb();
  const snap = await db.collection(collName).get();
  const shops = [];
  const phoneIndex = new Map();
  snap.forEach((doc) => {
    const d = doc.data();
    const name = d.name || d.company_name || '';
    const shop = {
      id: doc.id,
      name,
      nameNorm: norm(name),
      muniNorm: norm(d.municipality),
      coloniaNorm: norm(d.neighborhood),
      phone: phone10(d.phone),
      municipality: d.municipality || '',
      visited_status: d.visited_status || null,
    };
    shops.push(shop);
    if (shop.phone) {
      if (!phoneIndex.has(shop.phone)) phoneIndex.set(shop.phone, []);
      phoneIndex.get(shop.phone).push(shop);
    }
  });
  return { shops, phoneIndex };
}

export const loadShops = () => loadIndex('shops');
export const loadVisited = () => loadIndex('visited_stores');

const ACCEPT_WITH_MUNI = 0.5; // name similarity threshold when municipality agrees
const ACCEPT_NAME_ONLY = 0.7; // stricter threshold when no municipality context

function bestByName(nameNorm, pool) {
  let best = null;
  let bestScore = -1;
  for (const s of pool) {
    if (!s.nameNorm) continue;
    const sc = compareTwoStrings(nameNorm, s.nameNorm);
    if (sc > bestScore) { bestScore = sc; best = s; }
  }
  return { best, score: bestScore };
}

export function matchRecord(rec, { shops, phoneIndex }) {
  const nameNorm = norm(rec.negocio?.nombre);
  const recPhones = (rec.negocio?.telefonos || []).map(phone10).filter(Boolean);
  const rmuni = municipalityFromAddress(rec.negocio?.direccion);

  // 1) Phone match (strongest)
  for (const p of recPhones) {
    const cands = phoneIndex.get(p);
    if (cands && cands.length) {
      if (cands.length === 1) {
        return { shopId: cands[0].id, shopName: cands[0].name, shopMuni: cands[0].municipality, metodo: 'telefono', score: 1 };
      }
      const { best, score } = bestByName(nameNorm, cands);
      return { shopId: best.id, shopName: best.name, shopMuni: best.municipality, metodo: 'telefono+nombre', score: Math.max(0.9, score) };
    }
  }

  // 2) Name similarity, scoped by municipality when known
  let pool = shops;
  if (rmuni) {
    const scoped = shops.filter((s) => s.muniNorm === rmuni);
    if (scoped.length) pool = scoped;
  }
  const { best, score } = bestByName(nameNorm, pool);

  // colonia agreement bonus
  const rcol = norm(rec.negocio?.direccion);
  let adjScore = score;
  if (best && best.coloniaNorm && rcol.includes(best.coloniaNorm)) adjScore = Math.min(1, score + 0.1);

  const threshold = rmuni ? ACCEPT_WITH_MUNI : ACCEPT_NAME_ONLY;
  if (best && adjScore >= threshold) {
    return {
      shopId: best.id, shopName: best.name, shopMuni: best.municipality,
      metodo: rmuni ? 'nombre+municipio' : 'nombre', score: +adjScore.toFixed(3),
    };
  }

  return {
    shopId: null,
    metodo: 'needs_review',
    score: best ? +Math.max(0, score).toFixed(3) : 0,
    topCandidateId: best?.id || null,
    topCandidateName: best?.name || null,
  };
}
