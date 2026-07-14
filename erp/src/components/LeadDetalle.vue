<template>
  <div class="drawer-backdrop" @click.self="$emit('close')">
    <div class="drawer">
      <header class="drawer-head">
        <h3>{{ lead.name || lead.company_name || lead.id }}</h3>
        <button class="btn btn-sm" @click="$emit('close')">✕</button>
      </header>

      <div class="drawer-body">
        <section class="sec">
          <h4>Datos de la tienda</h4>
          <div class="kv"><span class="dim">Tipo</span><span>{{ TIPO_NEGOCIO[clasificarTipo(lead)] }}</span></div>
          <div class="kv"><span class="dim">Teléfono</span><span>{{ telefonos.join(' / ') || '—' }}</span></div>
          <div class="kv"><span class="dim">Municipio</span><span>{{ lead.municipality || '—' }}</span></div>
          <div class="kv"><span class="dim">Estado</span><span>{{ lead.state || '—' }}</span></div>
        </section>

        <section class="sec">
          <h4>Informes de visita</h4>
          <InformesVisita :lead-id="lead.id" />
        </section>

        <section class="sec">
          <h4>Scores</h4>
          <div class="scores">
            <span class="pill">General: {{ lead.score_general ?? '—' }}</span>
            <span class="pill">Pains: {{ lead.score_pains ?? '—' }}</span>
            <span class="pill">Prob.: {{ lead.score_probabilidad ?? '—' }}</span>
            <span class="pill">Satisf.: {{ lead.score_satisfaccion ?? '—' }}</span>
          </div>
        </section>

        <section class="sec">
          <h4>Pipeline</h4>
          <label>Etapa</label>
          <select v-model="etapa" class="select" @change="guardar">
            <option v-for="e in ETAPAS" :key="e.id" :value="e.id">{{ e.label }}</option>
          </select>
          <label style="margin-top:10px">Valor estimado (MXN)</label>
          <input v-model.number="valor" class="input" type="number" @change="guardar" />
          <label style="margin-top:10px">Responsable (email)</label>
          <input v-model="owner" class="input" placeholder="vendedor@voren.com.mx" @change="guardar" />
        </section>

        <section class="sec">
          <h4>Actividades</h4>
          <div class="act-form">
            <select v-model="nuevoTipo" class="select">
              <option value="llamada">Llamada</option>
              <option value="visita">Visita</option>
              <option value="correo">Correo</option>
              <option value="nota">Nota</option>
            </select>
            <input v-model="nuevaNota" class="input" placeholder="Nota…" @keyup.enter="agregarActividad" />
            <button class="btn btn-primary btn-sm" @click="agregarActividad">Agregar</button>
          </div>
          <ul class="act-list">
            <li v-for="a in actividades" :key="a.id">
              <span class="pill">{{ a.tipo }}</span>
              <span>{{ a.nota }}</span>
              <span class="dim act-when">{{ fecha(a.fecha) }} · {{ a.usuarioEmail }}</span>
            </li>
            <li v-if="actividades.length === 0" class="dim">Sin actividades registradas.</li>
          </ul>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useCrm, ETAPAS, combinarTelefonos, telefonosDeInforme, clasificarTipo, TIPO_NEGOCIO } from '../composables/useCrm.js';
import InformesVisita from './InformesVisita.vue';

const props = defineProps({ lead: { type: Object, required: true } });
const emit = defineEmits(['close', 'updated']);

const { actualizarLead, fetchInformes, fetchActividades, registrarActividad } = useCrm();
const telefonos = ref(combinarTelefonos(props.lead.phone, props.lead.primera_visita?.telefono_tienda));

const etapa = ref(props.lead.pipeline_stage || 'nuevo');
const valor = ref(props.lead.valor_estimado || 0);
const owner = ref(props.lead.crm_owner_email || props.lead.visitedByEmail || '');
const actividades = ref([]);
const nuevoTipo = ref('llamada');
const nuevaNota = ref('');

onMounted(async () => {
  actividades.value = await fetchActividades(props.lead.id);
  const informes = await fetchInformes(props.lead.id);
  const delInforme = informes.flatMap((inf) => telefonosDeInforme(inf.negocio));
  telefonos.value = combinarTelefonos(
    props.lead.phone,
    props.lead.primera_visita?.telefono_tienda,
    delInforme
  );
});

async function guardar() {
  await actualizarLead(props.lead.id, {
    pipeline_stage: etapa.value,
    valor_estimado: Number(valor.value) || 0,
    crm_owner_email: owner.value || null,
  });
  emit('updated');
}

async function agregarActividad() {
  if (!nuevaNota.value.trim()) return;
  await registrarActividad(props.lead.id, nuevoTipo.value, nuevaNota.value.trim());
  nuevaNota.value = '';
  actividades.value = await fetchActividades(props.lead.id);
}

function fecha(ts) {
  const d = ts?.toDate?.();
  return d ? d.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : '';
}
</script>

<style scoped>
.drawer-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 300; display: flex; justify-content: flex-end; }
.drawer { width: 420px; max-width: 100%; background: var(--panel); border-left: 1px solid var(--border); height: 100%; display: flex; flex-direction: column; box-shadow: var(--shadow); }
.drawer-head { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; border-bottom: 1px solid var(--border); }
.drawer-head h3 { margin: 0; font-size: 15px; text-transform: uppercase; }
.drawer-body { padding: 16px; overflow-y: auto; }
.sec { margin-bottom: 22px; }
.sec h4 { margin: 0 0 10px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-dim); }
.kv { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; border-bottom: 1px solid var(--border); }
.scores { display: flex; flex-wrap: wrap; gap: 6px; }
.act-form { display: flex; gap: 6px; margin-bottom: 12px; }
.act-form .select { max-width: 110px; }
.act-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
.act-list li { display: flex; flex-direction: column; gap: 3px; font-size: 13px; }
.act-when { font-size: 11px; }
</style>
