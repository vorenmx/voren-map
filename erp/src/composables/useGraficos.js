import { clasificarTipo, TIPO_NEGOCIO } from './useCrm.js';

function toDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function startOfWeek(d) {
  const day = d.getDay(); // 0 Sun
  const diff = (day + 6) % 7; // Monday-start
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff);
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function bucketKey(date, periodo) {
  const d = startOfDay(date);
  if (periodo === 'semanas') {
    const w = startOfWeek(d);
    return w.toISOString().slice(0, 10);
  }
  if (periodo === 'meses') {
    const m = startOfMonth(d);
    return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
  }
  return d.toISOString().slice(0, 10);
}

function formatBucketLabel(key, periodo) {
  if (periodo === 'meses') {
    const [y, m] = key.split('-');
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleDateString('es-MX', { month: 'short', year: 'numeric' });
  }
  if (periodo === 'semanas') {
    const d = new Date(key + 'T12:00:00');
    return `Sem ${d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}`;
  }
  const d = new Date(key + 'T12:00:00');
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

function leadDate(lead) {
  return toDate(lead.visitedAt)
    || toDate(lead.statusAt)
    || toDate(lead.crm_updated_at)
    || toDate(lead.surveyUpdatedAt);
}

function vendedor(lead) {
  return lead.crm_owner_email || lead.visitedByEmail || 'Sin asignar';
}

function bandaProb(n) {
  if (n == null || !Number.isFinite(n)) return 'Sin score';
  if (n >= 7) return 'Alta (≥7)';
  if (n >= 4) return 'Media (4–6)';
  return 'Baja (<4)';
}

function countBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const k = keyFn(item);
    map.set(k, (map.get(k) || 0) + 1);
  }
  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

/** Builds pie + timeline series for a list of leads/clientes. */
export function buildSeries(items, periodo = 'semanas') {
  const prob = countBy(items, (l) => {
    const n = Number(l.score_probabilidad);
    return bandaProb(Number.isFinite(n) ? n : null);
  });
  // Keep a stable order for prob bands
  const PROB_ORDER = ['Alta (≥7)', 'Media (4–6)', 'Baja (<4)', 'Sin score'];
  prob.sort((a, b) => PROB_ORDER.indexOf(a.label) - PROB_ORDER.indexOf(b.label));

  const porVendedor = countBy(items, vendedor);
  const porMunicipio = countBy(items, (l) => l.municipality || 'Sin municipio');
  const porTipo = countBy(items, (l) => TIPO_NEGOCIO[clasificarTipo(l)] || 'Otro');

  // Timeline buckets
  const dated = items
    .map((l) => ({ lead: l, date: leadDate(l) }))
    .filter((x) => x.date)
    .sort((a, b) => a.date - b.date);

  const buckets = new Map();
  for (const { date } of dated) {
    const key = bucketKey(date, periodo);
    buckets.set(key, (buckets.get(key) || 0) + 1);
  }

  // Fill gaps between first and last so the line is continuous
  const keys = [...buckets.keys()].sort();
  if (keys.length >= 2) {
    const filled = new Map();
    let cursor = new Date(keys[0] + (periodo === 'meses' ? '-01T12:00:00' : 'T12:00:00'));
    const end = new Date(keys[keys.length - 1] + (periodo === 'meses' ? '-01T12:00:00' : 'T12:00:00'));
    while (cursor <= end) {
      const k = bucketKey(cursor, periodo);
      filled.set(k, buckets.get(k) || 0);
      if (periodo === 'dias') cursor.setDate(cursor.getDate() + 1);
      else if (periodo === 'semanas') cursor.setDate(cursor.getDate() + 7);
      else cursor.setMonth(cursor.getMonth() + 1);
    }
    for (const [k, v] of filled) buckets.set(k, v);
  }

  const sortedKeys = [...buckets.keys()].sort();
  const nuevosValues = sortedKeys.map((k) => buckets.get(k) || 0);
  let running = 0;
  const totalesValues = nuevosValues.map((n) => {
    running += n;
    return running;
  });

  return {
    total: items.length,
    conFecha: dated.length,
    probabilidad: {
      labels: prob.map((x) => x.label),
      values: prob.map((x) => x.value),
      colors: ['#34d399', '#fbbf24', '#f87171', '#64748b'],
    },
    vendedor: {
      labels: porVendedor.map((x) => x.label),
      values: porVendedor.map((x) => x.value),
    },
    municipio: {
      labels: porMunicipio.map((x) => x.label),
      values: porMunicipio.map((x) => x.value),
    },
    tipo: {
      labels: porTipo.map((x) => x.label),
      values: porTipo.map((x) => x.value),
      colors: ['#7dd3fc', '#c4b5fd', '#6ee7b7', '#94a3b8'],
    },
    nuevos: {
      labels: sortedKeys.map((k) => formatBucketLabel(k, periodo)),
      values: nuevosValues,
    },
    totales: {
      labels: sortedKeys.map((k) => formatBucketLabel(k, periodo)),
      values: totalesValues,
    },
  };
}

/** Clientes = leads that reached the "ganado" stage (won deals). */
export function filtrarClientes(leads) {
  return leads.filter((l) => l.pipeline_stage === 'ganado');
}
