/**
 * Read-only scan for duplicate CRM leads.
 * Uses Application Default Credentials (run once:
 *   gcloud auth application-default login   [select hola@voren.com.mx]
 * ).
 * Leads = visited_stores with visited_status === 'visita_exitosa'.
 */
import admin from 'firebase-admin';

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: 'voren-map',
});
const db = admin.firestore();

function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}
function phone10(s) { const d = String(s || '').replace(/\D/g, ''); return d.length >= 10 ? d.slice(-10) : ''; }
function chunk(a, n) { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; }

async function main() {
  const snap = await db.collection('visited_stores').where('visited_status', '==', 'visita_exitosa').get();
  const leads = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  console.log(`Leads (visita_exitosa): ${leads.length}`);

  const refs = leads.map((l) => db.collection('shops').doc(l.id));
  const shopById = new Map();
  for (const group of chunk(refs, 300)) {
    const snaps = await db.getAll(...group);
    snaps.forEach((s) => { if (s.exists) shopById.set(s.id, s.data()); });
  }

  const enriched = leads.map((l) => {
    const shop = shopById.get(l.id) || {};
    return {
      id: l.id,
      name: l.name || shop.name || shop.company_name || '',
      phone: l.phone || shop.phone || '',
      municipality: l.municipality || shop.municipality || '',
      state: l.state || shop.state || '',
      google_place_id: shop.google_place_id || '',
      denue_id: shop.denue_id || '',
      stage: l.pipeline_stage || 'nuevo',
      owner: l.crm_owner_email || l.visitedByEmail || '',
      shopMissing: !shopById.has(l.id),
    };
  });

  function groupBy(keyFn) {
    const m = new Map();
    for (const e of enriched) { const k = keyFn(e); if (!k) continue; if (!m.has(k)) m.set(k, []); m.get(k).push(e); }
    return [...m.entries()].filter(([, v]) => v.length > 1);
  }
  function report(title, groups) {
    console.log(`\n===== ${title}: ${groups.length} grupos =====`);
    for (const [k, v] of groups) {
      console.log(`  [${k}] x${v.length}`);
      v.forEach((e) => console.log(`     - ${e.id} | ${e.name} | tel:${e.phone} | ${e.municipality}, ${e.state} | etapa:${e.stage} | ${e.owner}`));
    }
  }

  const dupPlace = groupBy((e) => (e.google_place_id ? `place:${e.google_place_id}` : ''));
  const dupDenue = groupBy((e) => (e.denue_id ? `denue:${e.denue_id}` : ''));
  const dupPhone = groupBy((e) => { const p = phone10(e.phone); return p ? `tel:${p}` : ''; });
  const dupNameMuni = groupBy((e) => { const n = norm(e.name); return n ? `${n}|${norm(e.municipality)}` : ''; });

  report('Mismo google_place_id', dupPlace);
  report('Mismo denue_id', dupDenue);
  report('Mismo telefono (10 digitos)', dupPhone);
  report('Mismo nombre + municipio', dupNameMuni);

  const orphans = enriched.filter((e) => e.shopMissing);
  console.log(`\n===== Leads sin doc en shops (huerfanos): ${orphans.length} =====`);
  orphans.slice(0, 40).forEach((e) => console.log(`  - ${e.id} | ${e.name}`));

  const dupIds = new Set();
  [dupPlace, dupDenue, dupPhone, dupNameMuni].forEach((g) => g.forEach(([, v]) => v.forEach((e) => dupIds.add(e.id))));
  console.log(`\n===== RESUMEN =====`);
  console.log(`Total leads: ${leads.length}`);
  console.log(`Leads en algun duplicado: ${dupIds.size}`);
  console.log(`Grupos -> place_id:${dupPlace.length} denue_id:${dupDenue.length} telefono:${dupPhone.length} nombre+municipio:${dupNameMuni.length}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e.message || e); process.exit(1); });
