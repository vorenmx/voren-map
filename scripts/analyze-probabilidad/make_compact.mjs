// Genera una vista compacta del dataset para puntuar con IA sin leer tanto texto.
// Salida: compact.json = [{ id, shopName, prob_asignado, texto }]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'dataset.json'), 'utf8'));

const compact = data.map((d) => {
  const i = d.informe;
  const texto = [
    i.contexto && `CONTEXTO: ${i.contexto}`,
    i.perfil && `PERFIL: ${i.perfil}`,
    i.pain_points && `PAINS: ${i.pain_points}`,
    i.oportunidades && `OPORTUNIDADES: ${i.oportunidades}`,
    i.observaciones && `OBSERVACIONES: ${i.observaciones}`,
    i.probabilidad_venta && `PROB_INFORME: ${i.probabilidad_venta}`,
  ].filter(Boolean).join(' | ').replace(/\s+/g, ' ').trim();
  return { id: d.id, shopName: d.shopName, prob_asignado: d.asignado.prob, texto };
});

fs.writeFileSync(path.join(__dirname, 'compact.json'), JSON.stringify(compact, null, 1));
console.log(`compact.json: ${compact.length} filas`);
