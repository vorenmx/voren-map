// Compacta analysis.json a lo justo para incrustar en el canvas.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const a = JSON.parse(fs.readFileSync(path.join(__dirname, 'analysis.json'), 'utf8'));

// Grid de dispersion: cuenta por par (asignado, estimada).
const gridMap = new Map();
for (const p of a.puntos) {
  const k = `${p.asignado},${p.estimada}`;
  gridMap.set(k, (gridMap.get(k) || 0) + 1);
}
const scatter = [...gridMap.entries()].map(([k, n]) => {
  const [asignado, estimada] = k.split(',').map(Number);
  return { asignado, estimada, n };
});

// Histograma de diferencias como arreglo ordenado -N..N.
const diffs = Object.keys(a.histograma_diff).map(Number).sort((x, y) => x - y);
const hist = diffs.map((d) => ({ diff: d, n: a.histograma_diff[d] }));

const trim = (arr) => arr.map((p) => ({
  shopName: p.shopName,
  municipio: p.municipio,
  asignado: p.asignado,
  estimada: p.estimada,
  diff: p.diff,
  j: p.justificacion,
}));

const out = {
  generado_en: a.generado_en,
  cobertura: a.cobertura,
  metricas: a.metricas,
  confusion: a.confusion,
  scatter,
  hist,
  veredicto: a.veredicto,
  veredicto_nota: a.veredicto_nota,
  top_sobrevalorados: trim(a.top_sobrevalorados),
  top_subvalorados: trim(a.top_subvalorados),
};

fs.writeFileSync(path.join(__dirname, 'canvas_data.json'), JSON.stringify(out, null, 2));
console.log(`canvas_data.json listo. scatter=${scatter.length} celdas, hist=${hist.length} barras`);
