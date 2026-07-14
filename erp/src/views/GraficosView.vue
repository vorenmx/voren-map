<template>
  <div class="graficos">
    <div class="section-head">
      <h3 class="group-title">Ventas</h3>
      <div class="crm-metrics">
        <span class="pill">Leads: <strong>{{ seriesLeads.total }}</strong></span>
        <span class="pill">Clientes: <strong>{{ seriesClientes.total }}</strong></span>
        <span v-if="cargando" class="pill muted">Cargando…</span>
      </div>
    </div>

    <div class="tabs">
      <button class="btn btn-sm" :class="{ 'btn-primary': seccion === 'leads' }" @click="seccion = 'leads'">
        Leads
      </button>
      <button class="btn btn-sm" :class="{ 'btn-primary': seccion === 'clientes' }" @click="seccion = 'clientes'">
        Clientes
      </button>
    </div>

    <p class="muted intro">
      <template v-if="seccion === 'leads'">
        Visualizaciones del pipeline comercial (visitas exitosas).
      </template>
      <template v-else>
        Visualizaciones de clientes (leads en etapa <strong>Ganado</strong>).
        Aún no hay clientes registrados — los gráficos se llenarán cuando cierres deals.
      </template>
    </p>

    <div class="charts-grid">
      <div class="card chart-card">
        <h4>Probabilidad de venta</h4>
        <PieChart
          :labels="activo.probabilidad.labels"
          :values="activo.probabilidad.values"
          :colors="activo.probabilidad.colors"
          :empty-text="emptyMsg"
        />
      </div>

      <div class="card chart-card">
        <h4>{{ seccion === 'leads' ? 'Leads' : 'Clientes' }} por vendedor</h4>
        <PieChart
          :labels="activo.vendedor.labels"
          :values="activo.vendedor.values"
          :empty-text="emptyMsg"
        />
      </div>

      <div class="card chart-card">
        <h4>{{ seccion === 'leads' ? 'Leads' : 'Clientes' }} por municipio</h4>
        <PieChart
          :labels="activo.municipio.labels"
          :values="activo.municipio.values"
          :empty-text="emptyMsg"
        />
      </div>

      <div class="card chart-card">
        <h4>Tipo de {{ seccion === 'leads' ? 'leads' : 'clientes' }}</h4>
        <PieChart
          :labels="activo.tipo.labels"
          :values="activo.tipo.values"
          :colors="activo.tipo.colors"
          :empty-text="emptyMsg"
        />
      </div>

      <div class="card chart-card wide">
        <div class="chart-head">
          <div>
            <h4>{{ seccion === 'leads' ? 'Leads nuevos' : 'Clientes nuevos' }}</h4>
            <p class="chart-sub">Altas por {{ periodoLabel }}</p>
          </div>
          <div class="periodo-bar">
            <span class="periodo-lbl">Línea de tiempo</span>
            <div class="periodo-btns">
              <button
                v-for="p in PERIODOS"
                :key="p.id"
                class="btn btn-sm"
                :class="{ 'btn-primary': periodo === p.id }"
                @click="periodo = p.id"
              >{{ p.label }}</button>
            </div>
          </div>
        </div>
        <LineChart
          :labels="activo.nuevos.labels"
          :values="activo.nuevos.values"
          :label="seccion === 'leads' ? 'Leads nuevos' : 'Clientes nuevos'"
          color="#3b82f6"
          :empty-text="emptyMsg"
        />
      </div>

      <div class="card chart-card wide">
        <h4>{{ seccion === 'leads' ? 'Leads totales' : 'Clientes totales' }}</h4>
        <p class="chart-sub">Acumulado por {{ periodoLabel }}</p>
        <LineChart
          :labels="activo.totales.labels"
          :values="activo.totales.values"
          :label="seccion === 'leads' ? 'Leads totales' : 'Clientes totales'"
          color="#34d399"
          :empty-text="emptyMsg"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useCrm } from '../composables/useCrm.js';
import { buildSeries, filtrarClientes } from '../composables/useGraficos.js';
import PieChart from '../components/charts/PieChart.vue';
import LineChart from '../components/charts/LineChart.vue';

const PERIODOS = [
  { id: 'dias', label: 'Días' },
  { id: 'semanas', label: 'Semanas' },
  { id: 'meses', label: 'Meses' },
];

const { leads, cargando, fetchLeads } = useCrm();
const seccion = ref('leads');
const periodo = ref('semanas');

onMounted(() => fetchLeads());

const seriesLeads = computed(() => buildSeries(leads.value, periodo.value));
const seriesClientes = computed(() => buildSeries(filtrarClientes(leads.value), periodo.value));
const activo = computed(() => (seccion.value === 'leads' ? seriesLeads.value : seriesClientes.value));

const periodoLabel = computed(() =>
  ({ dias: 'día', semanas: 'semana', meses: 'mes' }[periodo.value] || periodo.value)
);

const emptyMsg = computed(() =>
  seccion.value === 'clientes'
    ? 'Sin clientes aún (etapa Ganado)'
    : 'Sin datos aún'
);
</script>

<style scoped>
.section-head {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  flex-wrap: wrap; margin-bottom: 14px;
}
.group-title {
  margin: 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;
  color: var(--accent-2);
}
.crm-metrics { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.tabs { display: flex; gap: 8px; margin-bottom: 10px; }
.intro { margin: 0 0 16px; font-size: 13px; line-height: 1.5; }
.chart-head {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
  flex-wrap: wrap; margin-bottom: 10px;
}
.periodo-bar {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
}
.periodo-lbl {
  font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px; color: var(--text-dim);
}
.periodo-btns { display: flex; gap: 6px; }
.charts-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}
.chart-card { padding: 14px; }
.chart-card h4 {
  margin: 0 0 4px; font-size: 13px; font-weight: 600;
}
.chart-sub {
  margin: 0; font-size: 11px; color: var(--text-dim);
}
.chart-card.wide { grid-column: 1 / -1; }
@media (max-width: 900px) {
  .charts-grid { grid-template-columns: 1fr; }
  .chart-card.wide { grid-column: auto; }
}
</style>
