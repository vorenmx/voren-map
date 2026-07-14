// Ajusta en Firestore el score_probabilidad de los leads con desajuste
// significativo (|CRM - estimacion IA| >= UMBRAL) usando la estimacion por IA
// de los informes. Agrega por tienda (promedio de sus informes, redondeado).
//
// Uso:
//   node apply.mjs            -> DRY RUN (no escribe, solo reporta)
//   node apply.mjs --apply    -> aplica los cambios en Firestore
//
// Antes de escribir guarda un respaldo de los valores actuales.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb } from '../import-informes/match.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('--apply');
const UMBRAL = 2; // diferencia minima (en puntos 1-10) para considerar desajuste.

const dataset = JSON.parse(fs.readFileSync(path.join(__dirname, 'dataset.json'), 'utf8'));
const scored = JSON.parse(fs.readFileSync(path.join(__dirname, 'scored.json'), 'utf8'));
const scoredById = new Map(scored.map((s) => [s.id, s]));

const clamp = (v) => Math.min(10, Math.max(1, v));

// Agregar por tienda: promedio de las estimaciones de sus informes.
const porTienda = new Map();
for (const d of dataset) {
  if (d.asignado.prob == null) continue;
  const s = scoredById.get(d.id);
  if (!s) continue;
  const e = porTienda.get(d.shopId) || {
    shopId: d.shopId, shopName: d.shopName, municipio: d.municipio,
    asignado: d.asignado.prob, estimadas: [], justif: [],
  };
  e.estimadas.push(s.p);
  e.justif.push(s.j);
  porTienda.set(d.shopId, e);
}

const cambios = [];
for (const e of porTienda.values()) {
  const nuevo = clamp(Math.round(e.estimadas.reduce((a, b) => a + b, 0) / e.estimadas.length));
  const diff = e.asignado - nuevo;
  if (Math.abs(diff) >= UMBRAL) {
    cambios.push({ ...e, nuevo, diff, tipo: diff > 0 ? 'sobrevalorado' : 'subvalorado' });
  }
}
cambios.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

console.log(`\nTiendas con informe y score CRM: ${porTienda.size}`);
console.log(`Desajustes |diff| >= ${UMBRAL}:      ${cambios.length}`);
console.log(`  sobrevalorados: ${cambios.filter((c) => c.tipo === 'sobrevalorado').length}`);
console.log(`  subvalorados:   ${cambios.filter((c) => c.tipo === 'subvalorado').length}\n`);
for (const c of cambios) {
  console.log(`${c.diff > 0 ? '▼' : '▲'} ${c.asignado} -> ${c.nuevo}  ${c.shopName}  (${c.municipio || '—'})`);
}

if (!APPLY) {
  console.log('\nDRY RUN. Ejecuta con --apply para escribir en Firestore.');
  process.exit(0);
}

const db = getDb();

// Respaldo de valores actuales.
const backup = cambios.map((c) => ({ shopId: c.shopId, shopName: c.shopName, score_probabilidad: c.asignado }));
const backupPath = path.join(__dirname, `_backup_scores_${new Date().toISOString().slice(0, 10)}.json`);
fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
console.log(`\nRespaldo escrito: ${backupPath}`);

const ahora = new Date();
let batch = db.batch();
let ops = 0, total = 0;
for (const c of cambios) {
  const ref = db.collection('visited_stores').doc(c.shopId);
  batch.set(ref, {
    score_probabilidad: c.nuevo,
    score_probabilidad_prev: c.asignado,
    score_probabilidad_fuente: 'ajuste_ia_informe',
    score_probabilidad_ajustado_en: ahora,
  }, { merge: true });
  ops++; total++;
  if (ops >= 400) { await batch.commit(); batch = db.batch(); ops = 0; }
}
if (ops > 0) await batch.commit();
console.log(`\nActualizados ${total} leads en Firestore.`);
