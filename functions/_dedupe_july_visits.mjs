/**
 * Elimina duplicados de los leads del 15–16 jul (mismo google_place_id).
 * Conserva el más completo; borra lead + shop + subcolecciones.
 *
 * DRY-RUN por defecto; --apply para ejecutar.
 */
import admin from 'firebase-admin';
import { writeFileSync } from 'node:fs';

admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: 'voren-map' });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

// keeper first, then losers to delete
const groups = [
  {
    label: 'Pistón Pro',
    keep: '8V0PnRMh85Zi4bUuLKm6', // tiene comentarios
    delete: ['fwvvTWyDeEKzb2nEOr4W'],
  },
  {
    label: 'Coapa - Saga',
    keep: 'gDZXPruYBRScoxEwyOPN', // contactado + primera_visita + actividad
    delete: ['X2yK8NLkGVHz2xNKE2b2'],
  },
  {
    label: 'Los Compás',
    keep: 'z0V7j0NTCB5Dwuf9vhEW', // tiene comentarios
    delete: ['OJfbMNtbFJ21BfiKj4dQ', 'afV4sQIeyKljMNcDd6Jj'],
  },
  {
    label: 'Heaven Shop',
    keep: 'kvQRIXmuvtUi4pLuaFA2', // registro original (mismo contenido)
    delete: ['0ZjafWOP62iopJTT8igA'],
  },
];

async function loadBackup(id) {
  const [v, sh] = await db.getAll(
    db.collection('visited_stores').doc(id),
    db.collection('shops').doc(id),
  );
  const [acts, informes] = await Promise.all([
    db.collection('visited_stores').doc(id).collection('actividades').get(),
    db.collection('visited_stores').doc(id).collection('informes').get(),
  ]);
  return {
    id,
    visited_stores: v.exists ? v.data() : null,
    shops: sh.exists ? sh.data() : null,
    actividades: acts.docs.map((d) => ({ id: d.id, ...d.data() })),
    informes: informes.docs.map((d) => ({ id: d.id, ...d.data() })),
  };
}

async function deleteLead(id) {
  const acts = await db.collection('visited_stores').doc(id).collection('actividades').get();
  const informes = await db.collection('visited_stores').doc(id).collection('informes').get();
  const batch = db.batch();
  acts.docs.forEach((d) => batch.delete(d.ref));
  informes.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(db.collection('visited_stores').doc(id));
  batch.delete(db.collection('shops').doc(id));
  await batch.commit();
  return { acts: acts.size, informes: informes.size };
}

async function main() {
  const toDelete = groups.flatMap((g) => g.delete);
  console.log(APPLY ? '===== APLICANDO =====' : '===== DRY-RUN =====\n');

  for (const g of groups) {
    const keepSnap = await db.collection('visited_stores').doc(g.keep).get();
    console.log(`\n${g.label}`);
    console.log(`  KEEP   ${g.keep} | ${keepSnap.exists ? keepSnap.data().name : 'MISSING'}`);
    for (const id of g.delete) {
      const s = await db.collection('visited_stores').doc(id).get();
      console.log(`  DELETE ${id} | ${s.exists ? s.data().name : 'MISSING'}`);
    }
  }

  console.log(`\nLeads a eliminar: ${toDelete.length}`);
  if (!APPLY) {
    console.log('Re-run with --apply to delete.');
    return;
  }

  const backup = [];
  for (const id of toDelete) backup.push(await loadBackup(id));
  const backupFile = `_dedupe_july_visits_backup_${new Date().toISOString().slice(0, 10)}.json`;
  writeFileSync(backupFile, JSON.stringify(backup, null, 2));
  console.log(`\nBackup: ${backupFile}`);

  for (const id of toDelete) {
    const r = await deleteLead(id);
    console.log(`  deleted ${id} (acts=${r.acts}, informes=${r.informes})`);
  }
  console.log(`\nListo. Eliminados ${toDelete.length}.`);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
