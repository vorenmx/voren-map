/**
 * Backup + delete a single duplicate lead/shop by id.
 * Usage: node _dedupe_one.mjs <docId>
 */
import admin from 'firebase-admin';
import { writeFileSync } from 'node:fs';

const id = process.argv[2];
if (!id) { console.error('Falta el id. Uso: node _dedupe_one.mjs <docId>'); process.exit(1); }

admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: 'voren-map' });
const db = admin.firestore();

async function main() {
  const [v, sh] = await db.getAll(
    db.collection('visited_stores').doc(id),
    db.collection('shops').doc(id),
  );
  const backup = { id, visited_stores: v.exists ? v.data() : null, shops: sh.exists ? sh.data() : null };
  const file = `_dedupe_backup_one_${id}.json`;
  writeFileSync(file, JSON.stringify(backup, null, 2));
  console.log(`Respaldo guardado en functions/${file}`);

  const acts = await db.collection('visited_stores').doc(id).collection('actividades').get();
  const batch = db.batch();
  acts.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(db.collection('visited_stores').doc(id));
  batch.delete(db.collection('shops').doc(id));
  await batch.commit();
  console.log(`Eliminado ${id} (lead + tienda${acts.size ? ` + ${acts.size} actividades` : ''}).`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e.message || e); process.exit(1); });
