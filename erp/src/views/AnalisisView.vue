<template>
  <div class="analisis">
    <div class="head">
      <div>
        <h3 style="margin:0">Análisis del pipeline con IA</h3>
        <p class="dim" style="margin:4px 0 0">Generado con Anthropic Opus a partir de los datos del CRM.</p>
      </div>
      <button class="btn btn-primary" @click="regenerar" :disabled="generando">
        {{ generando ? 'Generando…' : '🤖 Regenerar' }}
      </button>
    </div>

    <div class="tabs">
      <button class="btn btn-sm" :class="{ 'btn-primary': tab === 'semanal' }" @click="tab = 'semanal'">Semanal</button>
      <button class="btn btn-sm" :class="{ 'btn-primary': tab === 'acumulado' }" @click="tab = 'acumulado'">Acumulado</button>
    </div>

    <p v-if="error" class="err">{{ error }}</p>

    <!-- ── Semanal ─────────────────────────────────────────────────────── -->
    <template v-if="tab === 'semanal'">
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

        <div v-if="semanal.length > 1" class="card">
          <h4>Historial semanal</h4>
          <div class="hist">
            <button
              v-for="a in semanal"
              :key="a.id"
              class="btn btn-sm"
              :class="{ 'btn-primary': a.id === ultimoSem.id }"
              @click="ultimoSem = a"
            >{{ a.id }}</button>
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

        <div v-if="acumulado.length > 1" class="card">
          <h4>Historial acumulado</h4>
          <div class="hist">
            <button
              v-for="a in acumulado"
              :key="a.id"
              class="btn btn-sm"
              :class="{ 'btn-primary': a.id === ultimoAcum.id }"
              @click="ultimoAcum = a"
            >{{ a.id }}</button>
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
.hist { display: flex; flex-wrap: wrap; gap: 6px; }
.err { color: var(--danger); font-size: 13px; margin-bottom: 12px; }
</style>
