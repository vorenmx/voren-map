// Cruza el score asignado en el CRM (1-10) con la probabilidad estimada por IA
// desde el informe, y calcula metricas de confiabilidad. Salida: analysis.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataset = JSON.parse(fs.readFileSync(path.join(__dirname, 'dataset.json'), 'utf8'));
const scored = JSON.parse(fs.readFileSync(path.join(__dirname, 'scored.json'), 'utf8'));
const scoredById = new Map(scored.map((s) => [s.id, s]));

// ── Sanity: cobertura del scoring ────────────────────────────────────────────
const sinScore = dataset.filter((d) => !scoredById.has(d.id));
if (sinScore.length) console.warn(`AVISO: ${sinScore.length} informes sin puntuar por IA.`);

// Conjunto comparable: tiene score CRM y estimacion IA.
const points = dataset
  .filter((d) => d.asignado.prob != null && scoredById.has(d.id))
  .map((d) => {
    const s = scoredById.get(d.id);
    return {
      shopName: d.shopName,
      municipio: d.municipio,
      fecha: d.fecha,
      asignado: d.asignado.prob,
      pains_crm: d.asignado.pains,
      estimada: s.p,
      pain: s.pain,
      rec: s.rec,
      intencion: s.int,
      justificacion: s.j,
      diff: d.asignado.prob - s.p, // >0 => CRM sobrevalora
    };
  });

const n = points.length;
const A = points.map((p) => p.asignado);
const E = points.map((p) => p.estimada);

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const std = (xs, m) => Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));

function pearson(x, y) {
  const mx = mean(x), my = mean(y);
  const sx = std(x, mx), sy = std(y, my);
  if (sx === 0 || sy === 0) return 0;
  const cov = mean(x.map((xi, i) => (xi - mx) * (y[i] - my)));
  return cov / (sx * sy);
}
function rank(xs) {
  const idx = xs.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const r = new Array(xs.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
    i = j + 1;
  }
  return r;
}
const spearman = (x, y) => pearson(rank(x), rank(y));

const absDiffs = points.map((p) => Math.abs(p.diff));
const mae = mean(absDiffs);
const bias = mean(points.map((p) => p.diff));
const within1 = absDiffs.filter((d) => d <= 1).length / n;
const within2 = absDiffs.filter((d) => d <= 2).length / n;

// ── Buckets Bajo(1-4) / Medio(5-7) / Alto(8-10) ──────────────────────────────
const bucket = (v) => (v <= 4 ? 'Bajo' : v <= 7 ? 'Medio' : 'Alto');
const orden = ['Bajo', 'Medio', 'Alto'];
const confusion = {};
for (const a of orden) { confusion[a] = { Bajo: 0, Medio: 0, Alto: 0 }; }
points.forEach((p) => { confusion[bucket(p.asignado)][bucket(p.estimada)]++; });
const bucketMatch = points.filter((p) => bucket(p.asignado) === bucket(p.estimada)).length / n;

// ── Distribucion de diferencias ──────────────────────────────────────────────
const histDiff = {};
points.forEach((p) => { histDiff[p.diff] = (histDiff[p.diff] || 0) + 1; });

// ── Pains: ¿el score CRM refleja la fuerza de los pains del informe? ──────────
const painPairs = points.filter((p) => p.pains_crm != null);
const corrPainsCrmVsInforme = painPairs.length > 3
  ? pearson(painPairs.map((p) => p.pains_crm), painPairs.map((p) => p.pain))
  : null;
const corrScoreVsPainInforme = pearson(A, points.map((p) => p.pain));

// ── Top desajustes ───────────────────────────────────────────────────────────
const sobrevalorados = [...points].sort((a, b) => b.diff - a.diff).slice(0, 12);
const subvalorados = [...points].sort((a, b) => a.diff - b.diff).slice(0, 12);

// ── Veredicto ────────────────────────────────────────────────────────────────
const r = pearson(A, E);
let veredicto, veredictoNota;
if (r >= 0.6 && mae <= 1.5) {
  veredicto = 'Alta';
  veredictoNota = 'El score asignado coincide bien con la evidencia de los informes.';
} else if (r >= 0.4 || (mae <= 2.0 && r >= 0.25)) {
  veredicto = 'Media';
  veredictoNota = 'Hay correlacion moderada: el score sirve como guia pero conviene recalibrar casos extremos.';
} else {
  veredicto = 'Baja';
  veredictoNota = 'El score asignado se relaciona debilmente con lo que dicen los informes; usar con cautela.';
}

const analysis = {
  generado_en: new Date().toISOString(),
  cobertura: {
    informes_total: dataset.length,
    con_score_crm: dataset.filter((d) => d.asignado.prob != null).length,
    comparables: n,
    sin_score_crm: dataset.filter((d) => d.asignado.prob == null).length,
  },
  metricas: {
    pearson: +r.toFixed(3),
    spearman: +spearman(A, E).toFixed(3),
    mae: +mae.toFixed(2),
    bias: +bias.toFixed(2),
    acuerdo_pm1: +(within1 * 100).toFixed(1),
    acuerdo_pm2: +(within2 * 100).toFixed(1),
    acuerdo_bucket: +(bucketMatch * 100).toFixed(1),
    prom_asignado: +mean(A).toFixed(2),
    prom_estimado: +mean(E).toFixed(2),
    corr_score_vs_pain_informe: +corrScoreVsPainInforme.toFixed(3),
    corr_pains_crm_vs_informe: corrPainsCrmVsInforme != null ? +corrPainsCrmVsInforme.toFixed(3) : null,
  },
  confusion,
  histograma_diff: histDiff,
  veredicto,
  veredicto_nota: veredictoNota,
  puntos: points,
  top_sobrevalorados: sobrevalorados,
  top_subvalorados: subvalorados,
};

fs.writeFileSync(path.join(__dirname, 'analysis.json'), JSON.stringify(analysis, null, 2));

console.log('===== RESULTADO =====');
console.log(`Comparables:        ${n} (de ${dataset.length} informes)`);
console.log(`Pearson r:          ${analysis.metricas.pearson}`);
console.log(`Spearman:           ${analysis.metricas.spearman}`);
console.log(`MAE:                ${analysis.metricas.mae}`);
console.log(`Sesgo (CRM-IA):     ${analysis.metricas.bias}`);
console.log(`Acuerdo +-1:        ${analysis.metricas.acuerdo_pm1}%`);
console.log(`Acuerdo +-2:        ${analysis.metricas.acuerdo_pm2}%`);
console.log(`Acuerdo bucket:     ${analysis.metricas.acuerdo_bucket}%`);
console.log(`Corr score vs pain: ${analysis.metricas.corr_score_vs_pain_informe}`);
console.log(`VEREDICTO:          ${veredicto} - ${veredictoNota}`);
