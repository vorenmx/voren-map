import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import admin from 'firebase-admin';
import { parseDocx, dateFromFilename, norm } from './parse.mjs';
import { loadIndex, matchRecord, getDb } from './match.mjs';

const APPLY = process.argv.includes('--apply');
const TARGET = process.env.TARGET || 'visited_stores'; // 'visited_stores' | 'shops'
const HOME = os.homedir();
const OUT_DIR = path.join(process.cwd(), 'out');

const VENDEDOR_EMAIL = 'gonzalo@voren.com.mx';

// Snapshot fields copied from shops/{id} when creating a visited_stores doc.
const SNAPSHOT_FIELDS = [
  'name', 'shop_type', 'source', 'latitude', 'longitude', 'formatted_address',
  'street', 'municipality', 'state', 'phone', 'website', 'rating', 'review_count',
  'google_maps_url',
];

function collectFiles() {
  const desktop = path.join(HOME, 'Desktop');
  const files = fs.readdirSync(desktop)
    .filter((f) => /^\d{2}_\d{2}_\d{4}\.docx$/i.test(f))
    .map((f) => path.join(desktop, f));
  const gonzalo = path.join(HOME, 'Downloads', 'Visitas talleres Gonzalo (1).docx');
  if (fs.existsSync(gonzalo)) files.push(gonzalo);
  return files;
}

function slug(s) {
  return norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'sin-nombre';
}

function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main() {
  const files = collectFiles();
  console.log(`Archivos encontrados: ${files.length}`);
  files.forEach((f) => console.log('  - ' + path.basename(f)));

  // Parse all reports
  const records = [];
  for (const file of files) {
    const fecha = dateFromFilename(file);
    const fuente = path.basename(file);
    let recs = [];
    try {
      recs = await parseDocx(file);
    } catch (e) {
      console.error(`ERROR parseando ${fuente}: ${e.message}`);
    }
    for (const r of recs) records.push({ ...r, fecha, fuente });
  }
  console.log(`\nInformes (talleres) parseados: ${records.length}`);

  console.log(`Cargando colección '${TARGET}' desde Firestore…`);
  const index = await loadIndex(TARGET);
  console.log(`${TARGET} cargados: ${index.shops.length}`);

  // Match + classify into confidence tiers
  const AUTO_NAME_THRESHOLD = 0.85;
  function tierOf(match) {
    if (!match.shopId) return 'no_match';
    if (match.metodo === 'telefono' || match.metodo === 'telefono+nombre') return 'auto';
    // name-based (nombre / nombre+municipio)
    return match.score >= AUTO_NAME_THRESHOLD ? 'auto' : 'review';
  }

  const rows = [];
  const byMethod = {};
  for (const rec of records) {
    const match = matchRecord(rec, index);
    const tier = tierOf(match);
    byMethod[match.metodo] = (byMethod[match.metodo] || 0) + 1;
    rows.push({ rec, match, tier });
  }

  // Write reports
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const header = ['tier', 'fuente', 'fecha', 'negocio', 'telefonos', 'direccion', 'metodo', 'score', 'shop_id', 'shop_name', 'shop_muni', 'candidato_revisar'];
  const rowToCsv = ({ rec, match, tier }) => [
    csvCell(tier), csvCell(rec.fuente), csvCell(rec.fecha || ''), csvCell(rec.negocio?.nombre),
    csvCell((rec.negocio?.telefonos || []).join(' | ')), csvCell(rec.negocio?.direccion),
    csvCell(match.metodo), csvCell(match.score), csvCell(match.shopId || ''),
    csvCell(match.shopName || ''), csvCell(match.shopMuni || ''),
    csvCell(match.topCandidateName ? `${match.topCandidateName} (${match.topCandidateId})` : ''),
  ].join(',');

  const fullCsv = [header.join(','), ...rows.map(rowToCsv)];
  fs.writeFileSync(path.join(OUT_DIR, 'report.csv'), '\ufeff' + fullCsv.join('\n'), 'utf8');

  const reviewRows = rows.filter((r) => r.tier !== 'auto');
  const reviewCsv = [header.join(','), ...reviewRows.map(rowToCsv)];
  fs.writeFileSync(path.join(OUT_DIR, 'revisar.csv'), '\ufeff' + reviewCsv.join('\n'), 'utf8');
  fs.writeFileSync(path.join(OUT_DIR, 'dryrun.json'), JSON.stringify(rows, null, 2), 'utf8');

  // Summary
  const nAuto = rows.filter((r) => r.tier === 'auto').length;
  const nReview = rows.filter((r) => r.tier === 'review').length;
  const nNoMatch = rows.filter((r) => r.tier === 'no_match').length;
  console.log('\n===== RESUMEN =====');
  console.log(`Total informes:          ${rows.length}`);
  console.log(`AUTO (alta confianza):   ${nAuto}`);
  console.log(`REVIEW (nombre <0.85):   ${nReview}`);
  console.log(`NO MATCH:                ${nNoMatch}`);
  console.log('\nPor método:');
  Object.entries(byMethod).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k.padEnd(18)} ${v}`));
  console.log(`\nReporte completo: ${path.join(OUT_DIR, 'report.csv')}`);
  console.log(`A revisar (${reviewRows.length}): ${path.join(OUT_DIR, 'revisar.csv')}`);

  if (!APPLY) {
    console.log('\n[DRY-RUN] No se escribió nada. Ejecuta con --apply para cargar SOLO el nivel AUTO.');
    return;
  }

  // ── APPLY (solo nivel AUTO) ────────────────────────────────────────────────
  console.log(`\n[APPLY] Escribiendo ${nAuto} informes de nivel AUTO en Firestore…`);
  const db = getDb();
  let wrote = 0;
  for (const { rec, match, tier } of rows) {
    if (tier !== 'auto') continue;
    const vsRef = db.collection('visited_stores').doc(match.shopId);
    const vsSnap = await vsRef.get();
    const cur = vsSnap.data() || {};
    const base = { crm_updated_at: new Date().toISOString() };
    // No pisar el estado de visita existente; solo completar si falta.
    if (!cur.visited_status) { base.visited_status = 'visita_exitosa'; base.status = 'visitada'; }
    if (!cur.visitedByEmail) base.visitedByEmail = VENDEDOR_EMAIL;
    if (!cur.crm_owner_email) base.crm_owner_email = VENDEDOR_EMAIL;
    if (!cur.pipeline_stage) base.pipeline_stage = 'nuevo';
    await vsRef.set(base, { merge: true });

    const informeId = (rec.fecha ? `${rec.fecha}_` : 'gonzalo_') + slug(rec.negocio?.nombre);
    const informe = {
      fecha: rec.fecha,
      fuente: rec.fuente,
      vendedor_email: VENDEDOR_EMAIL,
      negocio: rec.negocio,
      contexto: rec.contexto || '',
      perfil: rec.perfil || '',
      servicios: rec.servicios || '',
      marcas_motos: rec.marcas_motos || '',
      marcas_refacciones: rec.marcas_refacciones || '',
      refacciones_rotacion: rec.refacciones_rotacion || '',
      proveedores: rec.proveedores || '',
      pain_points: rec.pain_points || '',
      oportunidades: rec.oportunidades || '',
      volumen_compra: rec.volumen_compra || '',
      observaciones: rec.observaciones || '',
      probabilidad_venta: rec.probabilidad_venta || '',
      seguimiento: rec.seguimiento || '',
      raw_text: rec.raw_text,
      match: { metodo: match.metodo, score: match.score },
      importado_en: admin.firestore.FieldValue.serverTimestamp(),
    };
    await vsRef.collection('informes').doc(informeId).set(informe, { merge: true });
    wrote++;
  }
  console.log(`\n[APPLY] Listo. Clientes/informes escritos: ${wrote}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
