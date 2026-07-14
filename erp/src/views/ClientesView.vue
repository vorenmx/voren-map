<template>
  <div class="clientes">
    <div class="metrics">
      <span class="pill">Clientes: <strong>{{ clientes.length }}</strong></span>
      <span class="pill">Con informe: <strong>{{ conInforme }}</strong></span>
      <span class="pill">Sin informe: <strong>{{ clientes.length - conInforme }}</strong></span>
      <span class="pill">Mostrando: <strong>{{ filtrados.length }}</strong></span>
      <button v-if="filtrosActivos" class="btn btn-sm limpiar" @click="limpiarFiltros">Limpiar filtros</button>
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
        <input v-model="filtro" class="input" placeholder="Buscar cliente…" />
      </div>
    </div>

    <div v-if="cargando" class="muted">Cargando clientes…</div>

    <div v-else-if="filtrados.length === 0" class="muted">No hay clientes que coincidan.</div>

    <div v-else class="card table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Municipio</th>
            <th>Tipo</th>
            <th>Teléfono</th>
            <th>Responsable</th>
            <th>Prob. venta</th>
            <th>Última visita</th>
            <th>Informe</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in filtrados" :key="c.id">
            <td class="nombre">{{ c.name || c.company_name || c.id }}</td>
            <td class="dim">{{ c.municipality || '—' }}</td>
            <td><span class="pill tipo" :class="tipo(c)">{{ TIPO_NEGOCIO[tipo(c)] }}</span></td>
            <td class="dim">{{ telefonos(c).join(' / ') || '—' }}</td>
            <td class="dim">{{ c.crm_owner_email || c.visitedByEmail || 'Sin asignar' }}</td>
            <td class="dim">{{ prob(c) ?? '—' }}</td>
            <td class="dim">{{ ultimaVisita(c) || '—' }}</td>
            <td>
              <span v-if="nInformes(c) > 0" class="pill done">✓ {{ nInformes(c) }} informe{{ nInformes(c) > 1 ? 's' : '' }}</span>
              <span v-else class="pill pending">Sin informe</span>
            </td>
            <td class="acciones">
              <button class="btn btn-sm btn-primary" @click="abrir(c)">
                {{ nInformes(c) > 0 ? 'Ver informe' : 'Llenar visita' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <PrimeraVisitaForm
      v-if="seleccionado"
      :cliente="seleccionado"
      :solo-informes="nInformes(seleccionado) > 0"
      @close="seleccionado = null"
      @updated="onUpdated"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useCrm, combinarTelefonos, clasificarTipo, TIPO_NEGOCIO } from '../composables/useCrm.js';
import PrimeraVisitaForm from '../components/PrimeraVisitaForm.vue';

const { leads: clientes, cargando, fetchLeads, fetchInformesResumen } = useCrm();
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

function nInformes(c) { return resumen.value[c.id]?.count || 0; }

// Combina teléfonos de la tienda (Google/INE) con los recabados en los informes.
function telefonos(c) {
  return combinarTelefonos(
    c.phone,
    c.primera_visita?.telefono_tienda,
    resumen.value[c.id]?.telefonos
  );
}

function responsable(c) { return c.crm_owner_email || c.visitedByEmail || ''; }
function tipo(c) { return clasificarTipo(c); }
function prob(c) {
  const v = Number(c.score_probabilidad);
  return Number.isFinite(v) ? v : null;
}
function fechasVisita(c) { return resumen.value[c.id]?.fechas || []; }
function ultimaVisita(c) {
  const fs = fechasVisita(c);
  return fs.length ? fs[fs.length - 1] : '';
}

const municipios = computed(() =>
  [...new Set(clientes.value.map((c) => c.municipality).filter(Boolean))].sort((a, b) => a.localeCompare(b))
);
const responsables = computed(() =>
  [...new Set(clientes.value.map(responsable).filter(Boolean))].sort((a, b) => a.localeCompare(b))
);

const conInforme = computed(() => clientes.value.filter((c) => nInformes(c) > 0).length);

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
  let lista = [...clientes.value].sort((a, b) =>
    (a.name || a.company_name || '').localeCompare(b.name || b.company_name || '')
  );
  if (filtroInforme.value === 'con') lista = lista.filter((c) => nInformes(c) > 0);
  else if (filtroInforme.value === 'sin') lista = lista.filter((c) => nInformes(c) === 0);
  if (filtroMunicipio.value) lista = lista.filter((c) => c.municipality === filtroMunicipio.value);
  if (filtroResponsable.value) lista = lista.filter((c) => responsable(c) === filtroResponsable.value);
  if (filtroTipo.value) lista = lista.filter((c) => tipo(c) === filtroTipo.value);

  if (fechaDesde.value || fechaHasta.value) {
    lista = lista.filter((c) =>
      fechasVisita(c).some((fecha) =>
        (!fechaDesde.value || fecha >= fechaDesde.value) &&
        (!fechaHasta.value || fecha <= fechaHasta.value)
      )
    );
  }

  if (probMin.value != null || probMax.value != null) {
    const clamp = (v) => Math.min(10, Math.max(1, v));
    const min = probMin.value != null ? clamp(probMin.value) : 1;
    const max = probMax.value != null ? clamp(probMax.value) : 10;
    lista = lista.filter((c) => {
      const p = prob(c);
      if (p == null) return false;
      return p >= min && p <= max;
    });
  }

  if (f) {
    lista = lista.filter((c) =>
      (c.name || c.company_name || '').toLowerCase().includes(f) ||
      (c.municipality || '').toLowerCase().includes(f)
    );
  }
  return lista;
});

function abrir(cliente) { seleccionado.value = cliente; }
function onUpdated() { /* leads array is mutated in place by the composable */ }
</script>

<style scoped>
.metrics { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
.limpiar { margin-left: 4px; }
.filtros { display: flex; align-items: flex-end; gap: 10px; margin-bottom: 16px; overflow-x: auto; padding-bottom: 4px; }
.fg { display: flex; flex-direction: column; gap: 4px; flex: 0 0 auto; }
.fg.grow { flex: 1 1 180px; min-width: 160px; }
.fg label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px; color: var(--text-dim); }
.fg .select, .fg .input { min-width: 130px; }
.fg .num { min-width: 90px; max-width: 100px; }
.table-wrap { padding: 0; overflow-x: auto; }
.nombre { font-weight: 600; text-transform: uppercase; }
.acciones { text-align: right; white-space: nowrap; }
.done { color: var(--success); border-color: rgba(52,211,153,0.3); }
.pending { color: var(--warning); border-color: rgba(251,191,36,0.3); }
.tipo.taller { color: #7dd3fc; border-color: rgba(125,211,252,0.3); }
.tipo.refaccionaria { color: #c4b5fd; border-color: rgba(196,181,253,0.3); }
.tipo.ambos { color: #6ee7b7; border-color: rgba(110,231,183,0.3); }
.tipo.otro { color: var(--text-dim); }
</style>
