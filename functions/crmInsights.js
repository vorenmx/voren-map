/**
 * CRM insights powered by the Anthropic Opus API.
 *
 * The CRM system of record is Firestore: `visited_stores` documents (extended
 * with pipeline fields) joined with `shops`. We aggregate that data server-side
 * into a compact summary and ask Opus for a structured sales-ops analysis in
 * Spanish. Raw leads are never sent to the model (token/cost control).
 */

import Anthropic from '@anthropic-ai/sdk';

// Latest Opus model; override with the ANTHROPIC_MODEL env var if needed.
const OPUS_MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8';

const PIPELINE_STAGES = [
  'nuevo',
  'contactado',
  'calificado',
  'propuesta',
  'negociacion',
  'ganado',
  'perdido',
];

function avg(nums) {
  const vals = nums.filter((n) => typeof n === 'number' && !Number.isNaN(n));
  if (vals.length === 0) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

function toMillis(ts) {
  if (!ts) return null;
  if (typeof ts.toDate === 'function') return ts.toDate().getTime();
  if (typeof ts === 'string') {
    const t = new Date(ts).getTime();
    return Number.isNaN(t) ? null : t;
  }
  if (ts.seconds) return ts.seconds * 1000;
  return null;
}

/**
 * Reads CRM data from Firestore and builds a compact aggregated snapshot.
 * @param {FirebaseFirestore.Firestore} db
 * @returns {Promise<object>} aggregated summary
 */
export async function buildCrmSnapshot(db) {
  const [visitedSnap, empleadosSnap] = await Promise.all([
    db.collection('visited_stores').get(),
    db.collection('empleados').get(),
  ]);

  const nombrePorEmail = new Map();
  empleadosSnap.docs.forEach((d) => {
    const e = d.data();
    if (e.email) nombrePorEmail.set(String(e.email).toLowerCase(), e.nombre || e.email);
  });

  const now = Date.now();
  const STALE_DAYS = 30;
  const staleMs = STALE_DAYS * 24 * 60 * 60 * 1000;

  // Leads = visited stores that are part of the pipeline (marked as a successful
  // visit at some point, or already carrying a pipeline stage).
  const leads = visitedSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((l) => l.visited_status === 'visita_exitosa' || l.pipeline_stage);

  const porEtapa = {};
  PIPELINE_STAGES.forEach((s) => {
    porEtapa[s] = { cantidad: 0, valorEstimado: 0 };
  });

  const porVendedor = new Map();
  const scoreBands = { alto: 0, medio: 0, bajo: 0, sin_score: 0 };
  let estancados = 0;
  const estancadosEjemplos = [];

  for (const l of leads) {
    const etapa = PIPELINE_STAGES.includes(l.pipeline_stage) ? l.pipeline_stage : 'nuevo';
    porEtapa[etapa].cantidad += 1;
    porEtapa[etapa].valorEstimado += Number(l.valor_estimado) || 0;

    const ownerEmail = String(l.crm_owner_email || l.visitedByEmail || 'sin_asignar').toLowerCase();
    if (!porVendedor.has(ownerEmail)) {
      porVendedor.set(ownerEmail, {
        vendedor: nombrePorEmail.get(ownerEmail) || ownerEmail,
        leads: 0,
        ganados: 0,
        perdidos: 0,
        scoresGeneral: [],
        valorEstimado: 0,
      });
    }
    const v = porVendedor.get(ownerEmail);
    v.leads += 1;
    if (etapa === 'ganado') v.ganados += 1;
    if (etapa === 'perdido') v.perdidos += 1;
    if (typeof l.score_general === 'number') v.scoresGeneral.push(l.score_general);
    v.valorEstimado += Number(l.valor_estimado) || 0;

    const sg = l.score_general;
    if (typeof sg !== 'number') scoreBands.sin_score += 1;
    else if (sg >= 7) scoreBands.alto += 1;
    else if (sg >= 4) scoreBands.medio += 1;
    else scoreBands.bajo += 1;

    const updated = toMillis(l.crm_updated_at) ?? toMillis(l.statusAt) ?? toMillis(l.visitedAt);
    const abierto = etapa !== 'ganado' && etapa !== 'perdido';
    if (abierto && updated && now - updated > staleMs) {
      estancados += 1;
      if (estancadosEjemplos.length < 15) {
        estancadosEjemplos.push({
          id: l.id,
          nombre: l.name || l.company_name || l.id,
          etapa,
          diasSinActividad: Math.round((now - updated) / (24 * 60 * 60 * 1000)),
          score_general: l.score_general ?? null,
          vendedor: nombrePorEmail.get(ownerEmail) || ownerEmail,
        });
      }
    }
  }

  const vendedores = [...porVendedor.values()].map((v) => ({
    vendedor: v.vendedor,
    leads: v.leads,
    ganados: v.ganados,
    perdidos: v.perdidos,
    tasaGanados: v.leads > 0 ? Math.round((v.ganados / v.leads) * 100) : 0,
    promedioScoreGeneral: avg(v.scoresGeneral),
    valorEstimado: Math.round(v.valorEstimado),
  }));

  const totalLeads = leads.length;
  const ganados = porEtapa.ganado.cantidad;
  const perdidos = porEtapa.perdido.cantidad;
  const cerrados = ganados + perdidos;

  return {
    generadoEn: new Date().toISOString(),
    totales: {
      leads: totalLeads,
      ganados,
      perdidos,
      abiertos: totalLeads - cerrados,
      tasaConversion: cerrados > 0 ? Math.round((ganados / cerrados) * 100) : 0,
      valorPipelineAbierto: Math.round(
        PIPELINE_STAGES.filter((s) => s !== 'ganado' && s !== 'perdido').reduce(
          (sum, s) => sum + porEtapa[s].valorEstimado,
          0
        )
      ),
    },
    porEtapa,
    bandasScore: scoreBands,
    vendedores,
    estancados: { total: estancados, umbralDias: STALE_DAYS, ejemplos: estancadosEjemplos },
  };
}

/**
 * Reads CRM data from Firestore and builds a compact snapshot of the ACTIVITY
 * within a rolling window (default: last 7 days). Everything is aggregated, so
 * the payload stays small regardless of the number of leads.
 *
 * Note: stage changes overwrite `pipeline_stage`/`crm_updated_at` with no
 * transition history, so "won/lost this week" is approximated as leads whose
 * current stage is ganado/perdido and whose last update falls inside the window.
 * The `actividades` subcollection is the reliable "what we did" signal.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {number} sinceMs epoch millis marking the start of the window
 * @returns {Promise<object>} aggregated weekly summary
 */
export async function buildWeeklySnapshot(db, sinceMs) {
  const sinceDate = new Date(sinceMs);
  const now = Date.now();

  const [actsSnap, visitedSnap, empleadosSnap] = await Promise.all([
    db.collectionGroup('actividades').where('fecha', '>=', sinceDate).get(),
    db.collection('visited_stores').get(),
    db.collection('empleados').get(),
  ]);

  const nombrePorEmail = new Map();
  empleadosSnap.docs.forEach((d) => {
    const e = d.data();
    if (e.email) nombrePorEmail.set(String(e.email).toLowerCase(), e.nombre || e.email);
  });
  const nombreDe = (email) => nombrePorEmail.get(email) || email;

  // Activities logged this week (real "what we did" signal).
  const actividad = { total: 0, porTipo: {}, porVendedor: {} };
  actsSnap.docs.forEach((d) => {
    const a = d.data();
    actividad.total += 1;
    const tipo = a.tipo || 'otro';
    actividad.porTipo[tipo] = (actividad.porTipo[tipo] || 0) + 1;
    const email = String(a.usuarioEmail || 'sin_asignar').toLowerCase();
    const nombre = nombreDe(email);
    actividad.porVendedor[nombre] = (actividad.porVendedor[nombre] || 0) + 1;
  });

  const leads = visitedSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((l) => l.visited_status === 'visita_exitosa' || l.pipeline_stage);

  const porVendedor = new Map();
  const ganados = [];
  const perdidos = [];
  const nuevos = [];
  const tocados = [];
  let valorGanado = 0;

  for (const l of leads) {
    const updated = toMillis(l.crm_updated_at) ?? toMillis(l.statusAt) ?? toMillis(l.visitedAt);
    if (updated == null || updated < sinceMs || updated > now) continue;

    const etapa = PIPELINE_STAGES.includes(l.pipeline_stage) ? l.pipeline_stage : 'nuevo';
    const email = String(l.crm_owner_email || l.visitedByEmail || 'sin_asignar').toLowerCase();
    const nombre = nombreDe(email);
    const info = {
      id: l.id,
      nombre: l.name || l.company_name || l.id,
      etapa,
      vendedor: nombre,
      valorEstimado: Number(l.valor_estimado) || 0,
      score_general: l.score_general ?? null,
    };

    tocados.push(info);
    if (!porVendedor.has(nombre)) {
      porVendedor.set(nombre, { vendedor: nombre, tocados: 0, ganados: 0, perdidos: 0 });
    }
    const v = porVendedor.get(nombre);
    v.tocados += 1;

    if (etapa === 'ganado') {
      ganados.push(info);
      v.ganados += 1;
      valorGanado += info.valorEstimado;
    } else if (etapa === 'perdido') {
      perdidos.push(info);
      v.perdidos += 1;
    }

    const creado = toMillis(l.visitedAt);
    if (creado != null && creado >= sinceMs) nuevos.push(info);
  }

  return {
    generadoEn: new Date().toISOString(),
    ventana: {
      desde: sinceDate.toISOString(),
      hasta: new Date(now).toISOString(),
      dias: Math.max(1, Math.round((now - sinceMs) / (24 * 60 * 60 * 1000))),
    },
    actividad,
    leadsTocados: { total: tocados.length, nuevos: nuevos.length, ejemplos: tocados.slice(0, 20) },
    ganados: { total: ganados.length, valorEstimado: Math.round(valorGanado), ejemplos: ganados.slice(0, 20) },
    perdidos: { total: perdidos.length, ejemplos: perdidos.slice(0, 20) },
    porVendedor: [...porVendedor.values()],
  };
}

/**
 * Shared Opus call that expects a strict JSON object back and tolerates
 * accidental markdown fences.
 */
async function callOpusJson(apiKey, system, userContent) {
  const anthropic = new Anthropic({ apiKey });

  const msg = await anthropic.messages.create({
    model: OPUS_MODEL,
    max_tokens: 2000,
    system,
    messages: [{ role: 'user', content: userContent }],
  });

  const text = msg.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();

  let insights;
  try {
    const clean = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    insights = JSON.parse(clean);
  } catch {
    insights = { narrativa: text, _parseError: true };
  }

  return { modelo: OPUS_MODEL, insights };
}

const SYSTEM_PROMPT = `Eres un analista senior de operaciones de ventas (sales ops) para Voren, una empresa que vende a tiendas de motocicletas en Mexico. Recibes un resumen agregado del pipeline CRM y debes producir un analisis accionable en espanol.

Responde UNICAMENTE con un objeto JSON valido (sin texto adicional, sin markdown) con esta estructura exacta:
{
  "saludPipeline": { "puntuacion": <0-100>, "resumen": "<1-2 frases>" },
  "calidadLeads": "<parrafo sobre la calidad de los leads segun scores y distribucion>",
  "leadsEnRiesgo": ["<observacion sobre leads estancados o en riesgo>", ...],
  "accionesPriorizadas": ["<accion concreta y priorizada>", ...],
  "observacionesVendedores": ["<observacion por vendedor>", ...],
  "narrativa": "<resumen ejecutivo de 2-4 frases>"
}

Se especifico, usa los numeros del resumen, y prioriza acciones de alto impacto. No inventes datos que no esten en el resumen.`;

const SYSTEM_PROMPT_SEMANAL = `Eres un analista senior de operaciones de ventas (sales ops) para Voren, una empresa que vende a tiendas de motocicletas en Mexico. Recibes un resumen AGREGADO de la ACTIVIDAD DE LA ULTIMA SEMANA del CRM (actividades registradas, leads tocados, nuevos, ganados/perdidos y trabajo por vendedor). Tu tarea es explicar QUE SE HIZO esta semana y que sigue.

Responde UNICAMENTE con un objeto JSON valido (sin texto adicional, sin markdown) con esta estructura exacta:
{
  "resumenSemana": "<2-4 frases sobre lo que se hizo esta semana>",
  "logros": ["<avance o cierre concreto de la semana>", ...],
  "riesgos": ["<lead en riesgo, caida o falta de actividad>", ...],
  "accionesProximaSemana": ["<accion concreta y priorizada para la proxima semana>", ...],
  "observacionesVendedores": ["<observacion por vendedor basada en su actividad>", ...]
}

Se especifico y usa los numeros del resumen (actividades, ganados, etc.), enfocandote SOLO en la ventana de la semana. No inventes datos que no esten en el resumen. Si no hubo actividad, dilo claramente.`;

const SYSTEM_PROMPT_ACUMULADO = `Eres un analista senior de operaciones de ventas (sales ops) para Voren, una empresa que vende a tiendas de motocicletas en Mexico. Mantienes un reporte ACUMULADO del estado del pipeline CRM que evoluciona semana a semana. Recibes (1) el reporte acumulado ANTERIOR (puede ser null si es el primero) y (2) el reporte de la SEMANA mas reciente. Debes FUSIONARLOS para producir un acumulado actualizado, integrando lo nuevo de la semana con el historial previo. No re-analices todo desde cero: parte del acumulado anterior e incorpora la semana.

Responde UNICAMENTE con un objeto JSON valido (sin texto adicional, sin markdown) con esta estructura exacta:
{
  "saludPipeline": { "puntuacion": <0-100>, "resumen": "<1-2 frases>" },
  "narrativa": "<estado acumulado del pipeline en 3-5 frases>",
  "tendencias": ["<como ha evolucionado semana a semana>", ...],
  "logrosAcumulados": ["<logro relevante acumulado>", ...],
  "riesgosPersistentes": ["<riesgo que persiste o crece>", ...],
  "accionesPriorizadas": ["<accion priorizada a nivel acumulado>", ...],
  "semanasIncluidas": <numero entero de semanas consideradas en este acumulado>
}

Actualiza "semanasIncluidas" sumando 1 a la del acumulado anterior (o 1 si no habia previo). Conserva la memoria historica relevante, sintetiza y evita repetir literalmente. No inventes datos.`;

/**
 * Calls Opus with the aggregated snapshot and returns structured insights.
 * @param {string} apiKey
 * @param {object} snapshot
 */
export async function generateInsights(apiKey, snapshot) {
  return callOpusJson(
    apiKey,
    SYSTEM_PROMPT,
    `Resumen del pipeline CRM (JSON):\n\n${JSON.stringify(snapshot, null, 2)}`
  );
}

/**
 * Weekly "what did we do" analysis over the last-7-days snapshot.
 * @param {string} apiKey
 * @param {object} snapshot output of buildWeeklySnapshot
 */
export async function generateWeeklyInsights(apiKey, snapshot) {
  return callOpusJson(
    apiKey,
    SYSTEM_PROMPT_SEMANAL,
    `Resumen de actividad de la semana (JSON):\n\n${JSON.stringify(snapshot, null, 2)}`
  );
}

/**
 * Cumulative analysis produced by merging the previous cumulative report with
 * the latest weekly report only (no full historical re-analysis).
 * @param {string} apiKey
 * @param {object|null} prevCumulativeInsights previous cumulative insights (or null on first run)
 * @param {object} weeklyReport compact weekly report to merge in
 */
export async function generateCumulativeInsights(apiKey, prevCumulativeInsights, weeklyReport) {
  const userContent =
    `Reporte acumulado ANTERIOR (JSON, puede ser null):\n\n${JSON.stringify(prevCumulativeInsights ?? null, null, 2)}\n\n` +
    `Reporte de la SEMANA mas reciente (JSON):\n\n${JSON.stringify(weeklyReport, null, 2)}`;
  return callOpusJson(apiKey, SYSTEM_PROMPT_ACUMULADO, userContent);
}
