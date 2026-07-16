<template>
  <div class="analisis">
    <div class="head">
      <div>
        <h3 style="margin:0">Análisis del pipeline con IA</h3>
        <p class="dim" style="margin:4px 0 0">Generado con Anthropic Opus a partir de los datos del CRM.</p>
      </div>
      <button class="btn btn-primary" @click="regenerar" :disabled="generando">
        <span v-if="generando" class="btn-spin" aria-hidden="true"></span>
        {{ generando ? 'Generando…' : '🤖 Regenerar' }}
      </button>
    </div>

    <div class="tabs">
      <button class="btn btn-sm" :class="{ 'btn-primary': tab === 'semanal' }" @click="tab = 'semanal'">Semanal</button>
      <button class="btn btn-sm" :class="{ 'btn-primary': tab === 'acumulado' }" @click="tab = 'acumulado'">Acumulado</button>
    </div>

    <p v-if="error" class="err">{{ error }}</p>

    <div v-if="generando" class="card loading-card" role="status" aria-live="polite">
      <div class="spinner" aria-hidden="true"></div>
      <div>
        <div class="loading-title">Generando análisis con IA…</div>
        <p class="dim loading-sub">Esto puede tomar hasta un minuto. El reporte se guardará en el historial.</p>
      </div>
    </div>

    <!-- ── Semanal ─────────────────────────────────────────────────────── -->
    <template v-if="tab === 'semanal'">
      <div v-if="semanal.length" class="card hist-card">
        <div class="hist-head">
          <h4 style="margin:0">Reportes semanales guardados</h4>
          <span class="dim gen">{{ semanal.length }} en historial · 1 por día</span>
        </div>
        <div class="hist">
          <button
            v-for="a in semanal"
            :key="a.id"
            type="button"
            class="hist-btn"
            :class="{ active: a.id === ultimoSem?.id }"
            @click="ultimoSem = a"
          >
            <span class="hist-date">{{ fechaCorta(a.id) }}</span>
            <span class="hist-meta">{{ a.id === semanal[0]?.id ? 'Más reciente' : a.id }}</span>
          </button>
        </div>
      </div>

      <div v-if="!ultimoSem && !generando" class="card dim">
        Aún no hay reporte semanal. Presiona "Regenerar" para crear el primero.
      </div>

      <div v-if="ultimoSem" class="content">
        <div class="card resumen">
          <h4 style="margin-top:0">¿Qué hicimos esta semana?</h4>
          <p class="narrativa">{{ insSem.resumenSemana || '—' }}</p>
          <div v-if="actSem" class="stats">
            <span class="pill">Actividades: {{ actSem.total ?? 0 }}</span>
            <span v-for="(n, t) in actSem.porTipo || {}" :key="t" class="pill">{{ t }}: {{ n }}</span>
          </div>
          <div class="dim gen">Ventana: {{ estSem?.ventana?.dias ?? 7 }} días · Actualizado: {{ fecha(ultimoSem.generadoEn) }} · {{ ultimoSem.modelo }}</div>
        </div>

        <div v-if="estSem" class="card">
          <h4>Resultados de la semana</h4>
          <div class="stats">
            <span class="pill">Leads tocados: {{ estSem.leadsTocados?.total ?? 0 }}</span>
            <span class="pill">Nuevos: {{ estSem.leadsTocados?.nuevos ?? 0 }}</span>
            <span class="pill">Ganados: {{ estSem.ganados?.total ?? 0 }}</span>
            <span class="pill">Perdidos: {{ estSem.perdidos?.total ?? 0 }}</span>
            <span class="pill">Valor ganado: {{ money(estSem.ganados?.valorEstimado) }}</span>
          </div>
        </div>

        <div class="cols">
          <div class="card">
            <h4>Logros</h4>
            <ul><li v-for="(x, i) in insSem.logros || []" :key="i">{{ x }}</li></ul>
          </div>
          <div class="card">
            <h4>Riesgos</h4>
            <ul><li v-for="(x, i) in insSem.riesgos || []" :key="i">{{ x }}</li></ul>
          </div>
          <div class="card">
            <h4>Acciones para la próxima semana</h4>
            <ol><li v-for="(x, i) in insSem.accionesProximaSemana || []" :key="i">{{ x }}</li></ol>
          </div>
          <div class="card">
            <h4>Observaciones por vendedor</h4>
            <ul><li v-for="(x, i) in insSem.observacionesVendedores || []" :key="i">{{ x }}</li></ul>
          </div>
        </div>
      </div>
    </template>

    <!-- ── Acumulado ───────────────────────────────────────────────────── -->
    <template v-else>
      <div v-if="!ultimoAcum && !generando" class="card dim">
        Aún no hay reporte acumulado. Presiona "Regenerar" para crear el primero.
      </div>

      <div v-if="ultimoAcum" class="content">
        <div class="card resumen">
          <div class="salud">
            <div class="salud-num" :class="saludClase">{{ insAcum.saludPipeline?.puntuacion ?? '—' }}</div>
            <div>
              <div class="salud-lbl">Salud del pipeline</div>
              <div class="dim">{{ insAcum.saludPipeline?.resumen }}</div>
            </div>
          </div>
          <p class="narrativa">{{ insAcum.narrativa }}</p>
          <div class="dim gen">
            Semanas incluidas: {{ insAcum.semanasIncluidas ?? '—' }} · Actualizado: {{ fecha(ultimoAcum.generadoEn) }} · {{ ultimoAcum.modelo }}
          </div>
        </div>

        <div class="cols">
          <div class="card">
            <h4>Tendencias</h4>
            <ul><li v-for="(x, i) in insAcum.tendencias || []" :key="i">{{ x }}</li></ul>
          </div>
          <div class="card">
            <h4>Logros acumulados</h4>
            <ul><li v-for="(x, i) in insAcum.logrosAcumulados || []" :key="i">{{ x }}</li></ul>
          </div>
          <div class="card">
            <h4>Riesgos persistentes</h4>
            <ul><li v-for="(x, i) in insAcum.riesgosPersistentes || []" :key="i">{{ x }}</li></ul>
          </div>
          <div class="card">
            <h4>Acciones priorizadas</h4>
            <ol><li v-for="(x, i) in insAcum.accionesPriorizadas || []" :key="i">{{ x }}</li></ol>
          </div>
        </div>

        <div v-if="estAcum" class="card">
          <h4>Estadísticas base</h4>
          <div class="stats">
            <span class="pill">Leads: {{ estAcum.totales?.leads }}</span>
            <span class="pill">Abiertos: {{ estAcum.totales?.abiertos }}</span>
            <span class="pill">Ganados: {{ estAcum.totales?.ganados }}</span>
            <span class="pill">Conversión: {{ estAcum.totales?.tasaConversion }}%</span>
            <span class="pill">Estancados: {{ estAcum.estancados?.total }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useInsights } from '../composables/useInsights.js';

const { semanal, acumulado, generando, error, fetchAnalisis, generarAnalisis } = useInsights();
const tab = ref('semanal');
const ultimoSem = ref(null);
const ultimoAcum = ref(null);

onMounted(async () => {
  await fetchAnalisis();
  ultimoSem.value = semanal.value[0] || null;
  ultimoAcum.value = acumulado.value[0] || null;
});

const insSem = computed(() => ultimoSem.value?.insights || {});
const estSem = computed(() => ultimoSem.value?.estadisticas || null);
const actSem = computed(() => estSem.value?.actividad || null);

const insAcum = computed(() => ultimoAcum.value?.insights || {});
const estAcum = computed(() => ultimoAcum.value?.estadisticas || null);
const saludClase = computed(() => {
  const p = insAcum.value?.saludPipeline?.puntuacion;
  if (p == null) return '';
  return p >= 70 ? 'ok' : p >= 40 ? 'med' : 'low';
});

async function regenerar() {
  await generarAnalisis();
  ultimoSem.value = semanal.value[0] || ultimoSem.value;
  ultimoAcum.value = acumulado.value[0] || ultimoAcum.value;
}

function fecha(iso) {
  return iso ? new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : '';
}

/** Format Firestore doc id `YYYY-MM-DD` for the history picker. */
function fechaCorta(id) {
  if (!id) return '';
  const d = new Date(`${id}T12:00:00`);
  if (Number.isNaN(d.getTime())) return id;
  return d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function money(n) {
  if (n == null) return '—';
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);
}
</script>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; gap: 12px; flex-wrap: wrap; }
.tabs { display: flex; gap: 6px; margin-bottom: 16px; }
.content { display: flex; flex-direction: column; gap: 14px; }
.resumen .salud { display: flex; align-items: center; gap: 16px; margin-bottom: 12px; }
.salud-num { font-size: 40px; font-weight: 800; width: 72px; height: 72px; border-radius: 16px; display: flex; align-items: center; justify-content: center; background: var(--panel-2); }
.salud-num.ok { color: var(--success); }
.salud-num.med { color: var(--warning); }
.salud-num.low { color: var(--danger); }
.salud-lbl { font-weight: 700; }
.narrativa { line-height: 1.6; margin: 0 0 10px; }
.gen { font-size: 11px; }
.cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; }
.cols h4, .card h4 { margin: 0 0 10px; font-size: 13px; }
.cols ul, .cols ol { margin: 0; padding-left: 18px; line-height: 1.7; }
.stats { display: flex; flex-wrap: wrap; gap: 8px; }
.hist-card { margin-bottom: 14px; }
.hist-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-bottom: 10px; }
.hist { display: flex; flex-wrap: wrap; gap: 8px; }
.hist-btn {
  display: flex; flex-direction: column; align-items: flex-start; gap: 2px;
  padding: 8px 12px; border-radius: var(--radius); cursor: pointer;
  background: var(--panel-2); border: 1px solid var(--border); color: inherit;
  text-align: left; min-width: 140px;
}
.hist-btn:hover { border-color: var(--primary-hover); }
.hist-btn.active { border-color: var(--primary); background: rgba(29, 78, 216, 0.18); }
.hist-date { font-weight: 600; font-size: 13px; text-transform: capitalize; }
.hist-meta { font-size: 11px; color: var(--muted, #94a3b8); }
.err { color: var(--danger); font-size: 13px; margin-bottom: 12px; }

.btn-primary { display: inline-flex; align-items: center; gap: 8px; }
.btn-spin {
  width: 14px; height: 14px; border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: #fff;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}
.loading-card {
  display: flex; align-items: center; gap: 16px;
  margin-bottom: 14px;
  min-height: 88px;
}
.spinner {
  width: 36px; height: 36px; border-radius: 50%;
  border: 3px solid var(--border);
  border-top-color: var(--primary-hover);
  animation: spin 0.8s linear infinite;
  flex-shrink: 0;
}
.loading-title { font-weight: 700; margin-bottom: 4px; }
.loading-sub { margin: 0; font-size: 13px; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
