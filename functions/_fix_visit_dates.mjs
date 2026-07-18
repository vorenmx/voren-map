/**
 * Corrige visitedAt/statusAt de leads reportados el 15 y 16 de julio 2026.
 * DRY-RUN por defecto; pasa --apply para escribir.
 */
import admin from 'firebase-admin';
import { writeFileSync } from 'node:fs';

admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: 'voren-map' });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

function tsLocalNoon(y, m, d) {
  return admin.firestore.Timestamp.fromDate(new Date(y, m - 1, d, 12, 0, 0));
}

const plan = [
  // Reportes 15 julio
  { id: 'o9uPkBFAUtzAOp7cp1iC', name: 'Taller De Motos Sliders Custom', date: '2026-07-15' },
  { id: '8V0PnRMh85Zi4bUuLKm6', name: 'TALLER DE MOTOS PISTON PRO.', date: '2026-07-15' },
  { id: 'fwvvTWyDeEKzb2nEOr4W', name: 'TALLER DE MOTOS PISTON PRO. (dup)', date: '2026-07-15' },
  { id: '8gKIFCB1S1J3iGBtQpB2', name: 'TALLER DE MOTOS IGB', date: '2026-07-15' },
  { id: 'jwQ3b7B6CoZx01oYymRi', name: 'Taller de motos Gustavo', date: '2026-07-15' },
  { id: 'bbGAwC2kQiwMcrWPSMgY', name: 'Taller De Motos El Callejas - Moto Monkey', date: '2026-07-15' },
  { id: 'X2yK8NLkGVHz2xNKE2b2', name: 'Taller de motos Coapa - Saga', date: '2026-07-15' },
  { id: 'gDZXPruYBRScoxEwyOPN', name: 'Taller de motos Coapa - Saga (dup)', date: '2026-07-15' },
  { id: 'OJfbMNtbFJ21BfiKj4dQ', name: 'Taller de motos (los compás)', date: '2026-07-15' },
  { id: 'afV4sQIeyKljMNcDd6Jj', name: 'Taller de motos (los compás) (dup)', date: '2026-07-15' },
  { id: 'z0V7j0NTCB5Dwuf9vhEW', name: 'Taller de motos (los compás) (dup)', date: '2026-07-15' },
  { id: 'cN2rK8mKA4eTek5DRasx', name: 'Taller de motos', date: '2026-07-15' },
  { id: 'q7KzW9Z4chyg47M3dFFI', name: 'TALLER DE MOTOS', date: '2026-07-15' },
  // Reportes 16 julio
  { id: 'qfPoEMp924DTnkussUwT', name: 'TALLE MOTOS L.A', date: '2026-07-16' },
  { id: 'or267yrLvamvdprouY6J', name: 'MOTO SERVICIO LOZA', date: '2026-07-16' },
  { id: 'FcEva05uk1mb4PWLvelI', name: 'MOTO SERVICIO LEON', date: '2026-07-16' },
  { id: '0ZjafWOP62iopJTT8igA', name: 'HEAVEN SHOP XOCHIMILCO Taller de Motos', date: '2026-07-16' },
  { id: 'kvQRIXmuvtUi4pLuaFA2', name: 'HEAVEN SHOP XOCHIMILCO Taller de Motos (dup)', date: '2026-07-16' },
  { id: 'i5mxDTkvOH68uti6UMOl', name: 'GNSBIKERS', date: '2026-07-16' },
  { id: 'nCBp7IXaETarPieevEjl', name: 'Centro de Servicio 2879', date: '2026-07-16' },
  { id: 'EjUX46HbTHT73BUxqI2A', name: 'BODEGA DEL TALLER', date: '2026-07-16' },
];

async function main() {
  const backup = [];
  console.log(APPLY ? '===== APLICANDO =====' : '===== DRY-RUN =====');

  for (const p of plan) {
    const ref = db.collection('visited_stores').doc(p.id);
    const snap = await ref.get();
    if (!snap.exists) {
      console.log('MISSING', p.id, p.name);
      continue;
    }
    const d = snap.data();
    const before = {
      id: p.id,
      name: d.name,
      visitedAt: d.visitedAt?.toDate?.()?.toISOString() || null,
      statusAt: d.statusAt?.toDate?.()?.toISOString() || null,
    };
    const [y, m, day] = p.date.split('-').map(Number);
    const ts = tsLocalNoon(y, m, day);
    backup.push({ ...before, newDate: p.date });
    console.log(`${p.id}`);
    console.log(`  ${d.name}`);
    console.log(`  ${before.visitedAt?.slice(0, 10)} -> ${p.date}`);
    if (APPLY) {
      await ref.set({
        visitedAt: ts,
        statusAt: ts,
        crm_updated_at: new Date().toISOString(),
      }, { merge: true });
    }
  }

  const backupPath = `_fix_visit_dates_backup_${new Date().toISOString().slice(0, 10)}.json`;
  writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  console.log(`\nBackup: ${backupPath} (${backup.length} docs)`);
  if (!APPLY) console.log('Re-run with --apply to write.');
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
