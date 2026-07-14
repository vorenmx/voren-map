/**
 * Renombra tiendas con nombre genérico ("Taller de motos" / "Taller de motos
 * sin nombre") a "Taller de motos <colonia> <n>" para diferenciarlas.
 *
 * DRY-RUN por defecto. EXECUTE=1 para aplicar.
 */
import admin from 'firebase-admin';
import { writeFileSync } from 'node:fs';

const EXECUTE = process.env.EXECUTE === '1';

admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: 'voren-map' });
const db = admin.firestore();

function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}
function titleCase(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]+/g, '').trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
function chunk(a, n) { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; }

const GENERIC = new Set(['taller de motos', 'taller de motos sin nombre']);

async function main() {
  const snap = await db.collection('visited_stores').where('visited_status', '==', 'visita_exitosa').get();
  const leads = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const refs = leads.map((l) => db.collection('shops').doc(l.id));
  const shopById = new Map();
  for (const g of chunk(refs, 300)) {
    const snaps = await db.getAll(...g);
    snaps.forEach((s) => { if (s.exists) shopById.set(s.id, s.data()); });
  }

  const targets = leads
    .map((l) => {
      const shop = shopById.get(l.id) || {};
      const name = l.name || shop.name || '';
      return {
        id: l.id,
        name,
        colonia: shop.neighborhood || l.neighborhood || shop.municipality || l.municipality || '',
        municipality: shop.municipality || l.municipality || '',
      };
    })
    .filter((t) => GENERIC.has(norm(t.name)))
    .sort((a, b) => (a.id < b.id ? -1 : 1));

  // Numeral por colonia (usa municipio si no hay colonia).
  const counters = new Map();
  const plan = [];
  for (const t of targets) {
    const colRaw = t.colonia || t.municipality || '';
    const colKey = norm(colRaw);
    const n = (counters.get(colKey) || 0) + 1;
    counters.set(colKey, n);
    const colonia = titleCase(colRaw);
    const nuevo = colonia ? `Taller de motos ${colonia} ${n}` : `Taller de motos ${n}`;
    plan.push({ id: t.id, viejo: t.name, nuevo });
  }

  console.log(`\n===== ${EXECUTE ? 'APLICANDO' : 'DRY-RUN (nada se guarda)'} =====`);
  console.log(`Tiendas genéricas a renombrar: ${plan.length}\n`);
  for (const p of plan) console.log(`  ${p.id}\n     "${p.viejo}"  ->  "${p.nuevo}"`);

  if (!EXECUTE) {
    console.log('\nPara aplicar: EXECUTE=1 node _rename_generic.mjs');
    return;
  }

  writeFileSync(`_rename_backup_${new Date().toISOString().slice(0, 10)}.json`,
    JSON.stringify(plan, null, 2));

  let done = 0;
  for (const group of chunk(plan, 200)) {
    const batch = db.batch();
    for (const p of group) {
      batch.set(db.collection('shops').doc(p.id), { name: p.nuevo }, { merge: true });
      batch.set(db.collection('visited_stores').doc(p.id), { name: p.nuevo }, { merge: true });
    }
    await batch.commit();
    done += group.length;
    console.log(`  renombradas ${done}/${plan.length}`);
  }
  console.log(`\nListo. ${done} tiendas renombradas.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e.message || e); process.exit(1); });
