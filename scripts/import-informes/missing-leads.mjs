/**
 * READ-ONLY. Determines which businesses from the parsed informes exist in
 * NEITHER `shops` (map catalog) NOR `visited_stores` (leads), so you get an
 * authoritative "not in the database anywhere" list.
 *
 * Reuses the already-parsed records in out/dryrun.json (no docx needed) and
 * re-runs the matcher against both collections. Nothing is written to Firestore.
 *
 * Usage: node missing-leads.mjs
 * Requires ADC (gcloud auth application-default login as an @voren.com.mx user).
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadIndex, matchRecord } from './match.mjs';

const OUT_DIR = path.join(process.cwd(), 'out');
const DRYRUN = path.join(OUT_DIR, 'dryrun.json');

function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main() {
  if (!fs.existsSync(DRYRUN)) {
    console.error(`No existe ${DRYRUN}. Corre primero el import en dry-run (node import.mjs).`);
    process.exit(1);
  }
  const rows = JSON.parse(fs.readFileSync(DRYRUN, 'utf8'));
  const records = rows.map((r) => r.rec).filter(Boolean);
  console.log(`Informes parseados (desde dryrun.json): ${records.length}`);

  console.log('Cargando shops y visited_stores desde Firestore…');
  const [shopsIdx, visitedIdx] = await Promise.all([loadIndex('shops'), loadIndex('visited_stores')]);
  console.log(`shops: ${shopsIdx.shops.length} | visited_stores: ${visitedIdx.shops.length}\n`);

  const missing = [];
  for (const rec of records) {
    const mShops = matchRecord(rec, shopsIdx);
    const mVisited = matchRecord(rec, visitedIdx);
    // "Missing" = the matcher found no confident record in EITHER collection.
    if (!mShops.shopId && !mVisited.shopId) {
      missing.push({ rec, mShops, mVisited });
    }
  }

  const header = ['negocio', 'fecha', 'fuente', 'telefonos', 'direccion',
    'mejor_candidato_shops', 'score_shops', 'mejor_candidato_visited', 'score_visited'];
  const toRow = ({ rec, mShops, mVisited }) => [
    csvCell(rec.negocio?.nombre), csvCell(rec.fecha || ''), csvCell(rec.fuente || ''),
    csvCell((rec.negocio?.telefonos || []).join(' | ')), csvCell(rec.negocio?.direccion || ''),
    csvCell(mShops.topCandidateName || ''), csvCell(mShops.score ?? ''),
    csvCell(mVisited.topCandidateName || ''), csvCell(mVisited.score ?? ''),
  ].join(',');

  const csv = [header.join(','), ...missing.map(toRow)];
  const outFile = path.join(OUT_DIR, 'missing-leads.csv');
  fs.writeFileSync(outFile, '\ufeff' + csv.join('\n'), 'utf8');

  console.log(`===== NEGOCIOS EN INFORMES QUE NO EXISTEN EN LA BASE (${missing.length}) =====\n`);
  for (const m of missing) {
    const tel = (m.rec.negocio?.telefonos || []).join(' | ') || '(sin teléfono)';
    console.log(`- ${m.rec.negocio?.nombre}  [${m.rec.fecha || m.rec.fuente || ''}]  ${tel}`);
    console.log(`    dir: ${m.rec.negocio?.direccion || '—'}`);
    console.log(`    más cercano en shops: ${m.mShops.topCandidateName || '—'} (${m.mShops.score ?? 0}) | en visited: ${m.mVisited.topCandidateName || '—'} (${m.mVisited.score ?? 0})`);
  }
  console.log(`\nCSV: ${outFile}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
