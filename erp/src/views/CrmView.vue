<template>
  <div class="crm">
    <div class="crm-head">
      <div class="crm-metrics">
        <span class="pill">Total: <strong>{{ leads.length }}</strong></span>
        <span class="pill">Abiertos: <strong>{{ abiertos }}</strong></span>
        <span class="pill">Ganados: <strong>{{ ganados }}</strong></span>
        <span class="pill">Valor abierto: <strong>{{ money(valorAbierto) }}</strong></span>
        <span class="pill">Mostrando: <strong>{{ filtrados.length }}</strong></span>
        <button v-if="filtrosActivos" class="btn btn-sm limpiar" @click="limpiarFiltros">Limpiar filtros</button>
      </div>
    </div>

    <div class="filtros">
      <div class="fg">
        <label>Informe</label>
        <select v-model="filtroInforme" class="select">
          <option value="">Todos</option>
          <option value="con">Con informe</option>
          <option value="sin">Sin informe</option>
        </select>
      </div>
      <div class="fg">
        <label>Municipio</label>
        <select v-model="filtroMunicipio" class="select">
          <option value="">Todos</option>
          <option v-for="m in municipios" :key="m" :value="m">{{ m }}</option>
        </select>
      </div>
      <div class="fg">
        <label>Responsable</label>
        <select v-model="filtroResponsable" class="select">
          <option value="">Todos</option>
          <option v-for="r in responsables" :key="r" :value="r">{{ r }}</option>
        </select>
      </div>
      <div class="fg">
        <label>Tipo</label>
        <select v-model="filtroTipo" class="select">
          <option value="">Todos</option>
          <option value="taller">Taller</option>
          <option value="refaccionaria">Refaccionaría</option>
          <option value="ambos">Ambos</option>
          <option value="otro">Otro</option>
        </select>
      </div>
      <div class="fg">
        <label>Visita desde</label>
        <input v-model="fechaDesde" type="date" class="input" />
      </div>
      <div class="fg">
        <label>Visita hasta</label>
        <input v-model="fechaHasta" type="date" class="input" />
      </div>
      <div class="fg">
        <label>Prob. venta mín</label>
        <input v-model.number="probMin" type="number" min="1" max="10" step="1" class="input num" placeholder="1" />
      </div>
      <div class="fg">
        <label>Prob. venta máx</label>
        <input v-model.number="probMax" type="number" min="1" max="10" step="1" class="input num" placeholder="10" />
      </div>
      <div class="fg grow">
        <label>Buscar</label>
        <input v-model="filtro" class="input" placeholder="Buscar tienda…" />
      </div>
    </div>

    <div v-if="cargando" class="muted">Cargando leads…</div>

    <div v-else class="board">
      <div v-for="etapa in ETAPAS" :key="etapa.id" class="col">
        <div class="col-head">
          <span>{{ etapa.label }}</span>
          <span class="col-count">{{ porEtapa(etapa.id).length }}</span>
        </div>
        <div class="col-body">
          <div
            v-for="lead in porEtapa(etapa.id)"
            :key="lead.id"
            class="lead"
            @click="abrir(lead)"
          >
            <div class="lead-name">{{ lead.name || lead.company_name || lead.id }}</div>
            <div class="lead-meta">
              <span class="pill tipo" :class="tipo(lead)">{{ TIPO_NEGOCIO[tipo(lead)] }}</span>
              <span v-if="lead.score_general != null" class="pill score" :class="banda(lead.score_general)">
                Score {{ lead.score_general }}
              </span>
              <span v-if="lead.valor_estimado" class="dim">{{ money(lead.valor_estimado) }}</span>
            </div>
            <div class="lead-owner dim">{{ lead.crm_owner_email || lead.visitedByEmail || 'Sin asignar' }}</div>
            <select
              class="select lead-move"
              :value="lead.pipeline_stage"
              @click.stop
              @change="mover(lead, $event.target.value)"
            >
              <option v-for="e in ETAPAS" :key="e.id" :value="e.id">{{ e.label }}</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <LeadDetalle
      v-if="seleccionado"
      :lead="seleccionado"
      @close="seleccionado = null"
      @updated="onUpdated"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useCrm, ETAPAS, clasificarTipo, TIPO_NEGOCIO } from '../composables/useCrm.js';
import LeadDetalle from '../components/LeadDetalle.vue';

const { leads, cargando, fetchLeads, cambiarEtapa, fetchInformesResumen } = useCrm();
const filtro = ref('');
const filtroInforme = ref('');
const filtroMunicipio = ref('');
const filtroResponsable = ref('');
const filtroTipo = ref('');
const fechaDesde = ref('');
const fechaHasta = ref('');
const probMin = ref(null);
const probMax = ref(null);
const seleccionado = ref(null);
const resumen = ref({});

onMounted(async () => {
  await fetchLeads();
  resumen.value = await fetchInformesResumen();
});

function nInformes(l) { return resumen.value[l.id]?.count || 0; }
function responsable(l) { return l.crm_owner_email || l.visitedByEmail || ''; }
function tipo(l) { return clasificarTipo(l); }
function prob(l) {
  const v = Number(l.score_probabilidad);
  return Number.isFinite(v) ? v : null;
}
function fechasVisita(l) { return resumen.value[l.id]?.fechas || []; }

const municipios = computed(() =>
  [...new Set(leads.value.map((l) => l.municipality).filter(Boolean))].sort((a, b) => a.localeCompare(b))
);
const responsables = computed(() =>
  [...new Set(leads.value.map(responsable).filter(Boolean))].sort((a, b) => a.localeCompare(b))
);

const filtrosActivos = computed(() =>
  !!(filtro.value || filtroInforme.value || filtroMunicipio.value || filtroResponsable.value ||
     filtroTipo.value || fechaDesde.value || fechaHasta.value || probMin.value != null || probMax.value != null)
);

function limpiarFiltros() {
  filtro.value = '';
  filtroInforme.value = '';
  filtroMunicipio.value = '';
  filtroResponsable.value = '';
  filtroTipo.value = '';
  fechaDesde.value = '';
  fechaHasta.value = '';
  probMin.value = null;
  probMax.value = null;
}

const filtrados = computed(() => {
  const f = filtro.value.toLowerCase().trim();
  let lista = leads.value;

  if (filtroInforme.value === 'con') lista = lista.filter((l) => nInformes(l) > 0);
  else if (filtroInforme.value === 'sin') lista = lista.filter((l) => nInformes(l) === 0);
  if (filtroMunicipio.value) lista = lista.filter((l) => l.municipality === filtroMunicipio.value);
  if (filtroResponsable.value) lista = lista.filter((l) => responsable(l) === filtroResponsable.value);
  if (filtroTipo.value) lista = lista.filter((l) => tipo(l) === filtroTipo.value);

  if (fechaDesde.value || fechaHasta.value) {
    lista = lista.filter((l) =>
      fechasVisita(l).some((fecha) =>
        (!fechaDesde.value || fecha >= fechaDesde.value) &&
        (!fechaHasta.value || fecha <= fechaHasta.value)
      )
    );
  }

  if (probMin.value != null || probMax.value != null) {
    const clamp = (v) => Math.min(10, Math.max(1, v));
    const min = probMin.value != null ? clamp(probMin.value) : 1;
    const max = probMax.value != null ? clamp(probMax.value) : 10;
    lista = lista.filter((l) => {
      const p = prob(l);
      if (p == null) return false;
      return p >= min && p <= max;
    });
  }

  if (f) {
    lista = lista.filter((l) =>
      (l.name || l.company_name || '').toLowerCase().includes(f) ||
      (l.municipality || '').toLowerCase().includes(f)
    );
  }
  return lista;
});

function porEtapa(id) {
  return filtrados.value.filter((l) => l.pipeline_stage === id);
}

const abiertos = computed(() => leads.value.filter((l) => !['ganado', 'perdido'].includes(l.pipeline_stage)).length);
const ganados = computed(() => leads.value.filter((l) => l.pipeline_stage === 'ganado').length);
const valorAbierto = computed(() =>
  leads.value
    .filter((l) => !['ganado', 'perdido'].includes(l.pipeline_stage))
    .reduce((s, l) => s + (Number(l.valor_estimado) || 0), 0)
);

function banda(s) { return s >= 7 ? 'alto' : s >= 4 ? 'medio' : 'bajo'; }
function money(n) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n || 0);
}
async function mover(lead, etapa) { await cambiarEtapa(lead.id, etapa); }
function abrir(lead) { seleccionado.value = lead; }
function onUpdated() { /* leads array is mutated in place by the composable */ }
</script>

<style scoped>
.crm-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
.crm-metrics { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.limpiar { margin-left: 4px; }
.filtros { display: flex; align-items: flex-end; gap: 10px; margin-bottom: 16px; overflow-x: auto; padding-bottom: 4px; }
.filtros .fg { display: flex; flex-direction: column; gap: 4px; flex: 0 0 auto; }
.filtros .fg.grow { flex: 1 1 180px; min-width: 160px; }
.filtros .fg label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px; color: var(--text-dim); }
.filtros .fg .select, .filtros .fg .input { min-width: 130px; }
.filtros .fg .num { min-width: 90px; max-width: 100px; }
.board { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 8px; align-items: flex-start; }
.col { flex: 0 0 240px; background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius-lg); }
.col-head { display: flex; justify-content: space-between; padding: 10px 12px; border-bottom: 1px solid var(--border); font-weight: 600; font-size: 13px; }
.col-count { color: var(--text-dim); }
.col-body { padding: 8px; display: flex; flex-direction: column; gap: 8px; min-height: 40px; max-height: calc(100vh - 220px); overflow-y: auto; }
.lead { background: var(--panel-2); border: 1px solid var(--border); border-radius: var(--radius); padding: 10px; cursor: pointer; transition: border-color 0.15s; }
.lead:hover { border-color: var(--border-strong); }
.lead-name { font-weight: 600; font-size: 13px; margin-bottom: 6px; text-transform: uppercase; }
.lead-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.lead-owner { font-size: 11px; margin-bottom: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lead-move { font-size: 11px; padding: 4px 6px; }
.score.alto { color: var(--success); border-color: rgba(52,211,153,0.3); }
.score.medio { color: var(--warning); border-color: rgba(251,191,36,0.3); }
.score.bajo { color: var(--danger); border-color: rgba(248,113,113,0.3); }
.tipo.taller { color: #7dd3fc; border-color: rgba(125,211,252,0.3); }
.tipo.refaccionaria { color: #c4b5fd; border-color: rgba(196,181,253,0.3); }
.tipo.ambos { color: #6ee7b7; border-color: rgba(110,231,183,0.3); }
.tipo.otro { color: var(--text-dim); }
</style>
