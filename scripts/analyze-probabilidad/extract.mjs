// Readonly: une el texto de los informes (dryrun.json) con los scores 1-10
// asignados en el CRM (visited_stores) y reporta cobertura de datos.
//
// Uso:  node extract.mjs
// Salida: ./dataset.json  (+ resumen de cobertura en consola)
//
// Reutiliza las credenciales y getDb del pipeline de importacion.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb } from '../import-informes/match.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DRYRUN = path.join(__dirname, '..', 'import-informes', 'out', 'dryrun.json');
const OUT = path.join(__dirname, 'dataset.json');

const numOrNull = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

async function main() {
  const rows = JSON.parse(fs.readFileSync(DRYRUN, 'utf8')).filter((r) => r.tier === 'auto');
  console.log(`Informes AUTO en dryrun: ${rows.length}`);

  const shopIds = [...new Set(rows.map((r) => r.match?.shopId).filter(Boolean))];
  console.log(`Leads unicos a consultar: ${shopIds.length}`);

  const db = getDb();
  const leadById = new Map();
  // Lecturas por lotes para no saturar.
  for (let i = 0; i < shopIds.length; i += 50) {
    const batch = shopIds.slice(i, i + 50);
    const snaps = await Promise.all(
      batch.map((id) => db.collection('visited_stores').doc(id).get())
    );
    for (const s of snaps) if (s.exists) leadById.set(s.id, s.data());
  }

  const dataset = [];
  rows.forEach((r, idx) => {
    const shopId = r.match?.shopId;
    const lead = leadById.get(shopId) || {};
    const rec = r.rec || {};
    dataset.push({
      id: `${rec.fecha || 'gonzalo'}__${shopId}__${idx}`,
      shopId,
      shopName: r.match?.shopName || rec.negocio?.nombre || shopId,
      municipio: r.match?.shopMuni || lead.municipality || '',
      fecha: rec.fecha || null,
      fuente: rec.fuente || null,
      asignado: {
        prob: numOrNull(lead.score_probabilidad),
        pains: numOrNull(lead.score_pains),
        general: numOrNull(lead.score_general),
        satisfaccion: numOrNull(lead.score_satisfaccion),
      },
      informe: {
        contexto: rec.contexto || '',
        perfil: rec.perfil || '',
        pain_points: rec.pain_points || '',
        oportunidades: rec.oportunidades || '',
        observaciones: rec.observaciones || '',
        probabilidad_venta: rec.probabilidad_venta || '',
      },
    });
  });

  fs.writeFileSync(OUT, JSON.stringify(dataset, null, 2));

  const conProb = dataset.filter((d) => d.asignado.prob != null).length;
  const pct = ((conProb / dataset.length) * 100).toFixed(1);
  console.log('\n===== COBERTURA =====');
  console.log(`Filas (informes):                 ${dataset.length}`);
  console.log(`Con score_probabilidad asignado:  ${conProb} (${pct}%)`);
  console.log(`Sin score asignado:               ${dataset.length - conProb}`);
  console.log(`\nEscrito: ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
