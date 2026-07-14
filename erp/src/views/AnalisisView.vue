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

    <p v-if="error" class="err">{{ error }}</p>

    <div v-if="!ultimo && !generando" class="card dim">
      Aún no hay análisis. Presiona "Regenerar" para crear el primero.
    </div>

    <div v-if="ultimo" class="content">
      <div class="card resumen">
        <div class="salud">
          <div class="salud-num" :class="saludClase">{{ ins.saludPipeline?.puntuacion ?? '—' }}</div>
          <div>
            <div class="salud-lbl">Salud del pipeline</div>
            <div class="dim">{{ ins.saludPipeline?.resumen }}</div>
          </div>
        </div>
        <p class="narrativa">{{ ins.narrativa }}</p>
        <div class="dim gen">Actualizado: {{ fecha(ultimo.generadoEn) }} · {{ ultimo.modelo }}</div>
      </div>

      <div class="cols">
        <div class="card">
          <h4>Calidad de leads</h4>
          <p>{{ ins.calidadLeads || '—' }}</p>
        </div>
        <div class="card">
          <h4>Leads en riesgo</h4>
          <ul><li v-for="(x, i) in ins.leadsEnRiesgo || []" :key="i">{{ x }}</li></ul>
        </div>
        <div class="card">
          <h4>Acciones priorizadas</h4>
          <ol><li v-for="(x, i) in ins.accionesPriorizadas || []" :key="i">{{ x }}</li></ol>
        </div>
        <div class="card">
          <h4>Observaciones por vendedor</h4>
          <ul><li v-for="(x, i) in ins.observacionesVendedores || []" :key="i">{{ x }}</li></ul>
        </div>
      </div>

      <div v-if="est" class="card">
        <h4>Estadísticas base</h4>
        <div class="stats">
          <span class="pill">Leads: {{ est.totales?.leads }}</span>
          <span class="pill">Abiertos: {{ est.totales?.abiertos }}</span>
          <span class="pill">Ganados: {{ est.totales?.ganados }}</span>
          <span class="pill">Conversión: {{ est.totales?.tasaConversion }}%</span>
          <span class="pill">Estancados: {{ est.estancados?.total }}</span>
        </div>
      </div>

      <div v-if="historial.length > 1" class="card">
        <h4>Historial</h4>
        <div class="hist">
          <button
            v-for="a in historial"
            :key="a.id"
            class="btn btn-sm"
            :class="{ 'btn-primary': a.id === ultimo.id }"
            @click="ultimo = a"
          >{{ a.id }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useInsights } from '../composables/useInsights.js';

const { analisis, generando, error, fetchAnalisis, generarAnalisis } = useInsights();
const ultimo = ref(null);

onMounted(async () => {
  await fetchAnalisis();
  ultimo.value = analisis.value[0] || null;
});

const historial = computed(() => analisis.value);
const ins = computed(() => ultimo.value?.insights || {});
const est = computed(() => ultimo.value?.estadisticas || null);
const saludClase = computed(() => {
  const p = ins.value?.saludPipeline?.puntuacion;
  if (p == null) return '';
  return p >= 70 ? 'ok' : p >= 40 ? 'med' : 'low';
});

async function regenerar() {
  await generarAnalisis();
  ultimo.value = analisis.value[0] || ultimo.value;
}

function fecha(iso) {
  return iso ? new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : '';
}
</script>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; gap: 12px; flex-wrap: wrap; }
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
