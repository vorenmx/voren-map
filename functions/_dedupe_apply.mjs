/**
 * Dedupe CRM leads by google_place_id (the confident key).
 * Keeps the most complete lead per place_id; deletes the rest (visited_stores
 * lead + shops doc + any actividades subdocs).
 *
 * DRY-RUN by default. Set EXECUTE=1 to actually delete.
 * Requires ADC (gcloud auth application-default login as hola@voren.com.mx).
 */
import admin from 'firebase-admin';
import { writeFileSync } from 'node:fs';

const EXECUTE = process.env.EXECUTE === '1';

admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: 'voren-map' });
const db = admin.firestore();

function phone10(s) { const d = String(s || '').replace(/\D/g, ''); return d.length >= 10 ? d.slice(-10) : ''; }
function chunk(a, n) { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; }
function ms(ts) { if (!ts) return Infinity; if (typeof ts.toDate === 'function') return ts.toDate().getTime(); if (ts.seconds) return ts.seconds * 1000; return Infinity; }

const SURVEY_FIELDS = [
  'score_general', 'score_pains', 'score_probabilidad', 'score_satisfaccion',
  'tamano_tienda', 'credito', 'metodo_pago', 'entrega', 'principal_proveedor',
  'contacto_personal', 'comentarios',
];

function filled(v) {
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'string') return v.trim() !== '';
  return true;
}

function completeness(l, shop) {
  let s = 0;
  if (phone10(l.phone || shop.phone)) s += 2;
  if (Number(l.valor_estimado) > 0) s += 2;
  if (l.pipeline_stage && l.pipeline_stage !== 'nuevo') s += 3;
  // Count how many survey fields are actually filled (richer record wins).
  for (const f of SURVEY_FIELDS) if (filled(l[f])) s += 1;
  if (Array.isArray(l.surveyLog)) s += Math.min(l.surveyLog.length, 5);
  return s;
}

async function main() {
  const snap = await db.collection('visited_stores').where('visited_status', '==', 'visita_exitosa').get();
  const leads = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const refs = leads.map((l) => db.collection('shops').doc(l.id));
  const shopById = new Map();
  for (const group of chunk(refs, 300)) {
    const snaps = await db.getAll(...group);
    snaps.forEach((s) => { if (s.exists) shopById.set(s.id, s.data()); });
  }

  // Group by place_id
  const groups = new Map();
  for (const l of leads) {
    const pid = shopById.get(l.id)?.google_place_id;
    if (!pid) continue;
    if (!groups.has(pid)) groups.set(pid, []);
    groups.get(pid).push(l);
  }

  const toDelete = [];
  let groupsWithDup = 0;
  for (const [pid, items] of groups) {
    if (items.length < 2) continue;
    groupsWithDup++;
    // Pick keeper: highest completeness, then earliest visit (original).
    const ranked = [...items].sort((a, b) => {
      const ca = completeness(a, shopById.get(a.id) || {});
      const cb = completeness(b, shopById.get(b.id) || {});
      if (cb !== ca) return cb - ca;
      return ms(a.visitedAt) - ms(b.visitedAt);
    });
    const keeper = ranked[0];
    const losers = ranked.slice(1);
    console.log(`\nplace ${pid}  (${items.length})`);
    console.log(`  KEEP   ${keeper.id} | ${keeper.name || ''} | tel:${keeper.phone || ''} | score:${keeper.score_general ?? '-'}`);
    for (const lo of losers) {
      console.log(`  DELETE ${lo.id} | ${lo.name || ''} | tel:${lo.phone || ''} | score:${lo.score_general ?? '-'}`);
      toDelete.push(lo.id);
    }
  }

  console.log(`\n===== ${EXECUTE ? 'EJECUTANDO' : 'DRY-RUN (nada se borra)'} =====`);
  console.log(`Grupos con duplicado (place_id): ${groupsWithDup}`);
  console.log(`Leads a eliminar: ${toDelete.length}`);
  console.log(`Leads que quedan: ${leads.length - toDelete.length}`);

  if (!EXECUTE) {
    console.log('\nPara ejecutar: EXECUTE=1 node _dedupe_apply.mjs');
    return;
  }

  // Backup the docs we are about to delete (reversible safety net).
  const backup = [];
  for (const id of toDelete) {
    const [v, sh] = await db.getAll(
      db.collection('visited_stores').doc(id),
      db.collection('shops').doc(id),
    );
    backup.push({ id, visited_stores: v.exists ? v.data() : null, shops: sh.exists ? sh.data() : null });
  }
  const backupFile = `_dedupe_backup_${new Date().toISOString().slice(0, 10)}.json`;
  writeFileSync(backupFile, JSON.stringify(backup, null, 2));
  console.log(`Respaldo guardado en functions/${backupFile} (${backup.length} registros)`);

  let done = 0;
  for (const id of toDelete) {
    // delete actividades subcollection docs (usually none)
    const acts = await db.collection('visited_stores').doc(id).collection('actividades').get();
    const batch = db.batch();
    acts.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(db.collection('visited_stores').doc(id));
    batch.delete(db.collection('shops').doc(id));
    await batch.commit();
    done++;
    if (done % 10 === 0) console.log(`  eliminados ${done}/${toDelete.length}`);
  }
  console.log(`\nListo. Eliminados ${done} leads + tiendas duplicadas.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e.message || e); process.exit(1); });
