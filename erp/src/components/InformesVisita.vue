<template>
  <section v-if="informes.length" class="sec informes">
    <h4>Informes de visita ({{ informes.length }})</h4>
    <details v-for="inf in informes" :key="inf.id" class="informe">
      <summary>
        <span class="informe-fecha">{{ inf.fecha || 'Sin fecha' }}</span>
        <span class="dim">{{ inf.fuente }}</span>
      </summary>
      <div class="informe-body">
        <div v-for="campo in CAMPOS" :key="campo.key" v-show="valor(inf, campo.key)" class="kv-block">
          <span class="k">{{ campo.label }}</span>
          <div v-if="campo.lista" class="chips">
            <span v-for="(chip, i) in chips(inf, campo.key)" :key="i" class="chip">{{ chip }}</span>
          </div>
          <span v-else class="v">{{ formato(valor(inf, campo.key)) }}</span>
        </div>
        <div v-if="inf.negocio" class="kv-block">
          <span class="k">Contacto</span>
          <span class="v">
            {{ inf.negocio.contacto_nombre || '—' }}
            <template v-if="inf.negocio.persona_entrevistada"> · {{ inf.negocio.persona_entrevistada }}</template>
          </span>
        </div>
        <div v-if="tels(inf.negocio).length" class="kv-block">
          <span class="k">Teléfonos</span>
          <span class="v">{{ tels(inf.negocio).join(' / ') }}</span>
        </div>
      </div>
    </details>
  </section>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useCrm, telefonosDeInforme } from '../composables/useCrm.js';

const props = defineProps({ leadId: { type: String, required: true } });
const { fetchInformes } = useCrm();
const informes = ref([]);

function tels(negocio) { return telefonosDeInforme(negocio); }

const CAMPOS = [
  { key: 'contexto', label: 'Contexto' },
  { key: 'perfil', label: 'Perfil' },
  { key: 'marcas_motos', label: 'Marcas de motos', lista: true },
  { key: 'refacciones_rotacion', label: 'Refacciones de mayor rotación', lista: true },
  { key: 'proveedores', label: 'Proveedores actuales', lista: true },
  { key: 'pain_points', label: 'Pain points' },
  { key: 'oportunidades', label: 'Oportunidades' },
  { key: 'volumen_compra', label: 'Volumen de compra' },
  { key: 'observaciones', label: 'Observaciones' },
  { key: 'probabilidad_venta', label: 'Probabilidad de venta' },
];

function valor(inf, key) { return inf[key] || ''; }

// Solo mejora la presentación (no altera el dato original):
// agrega espacio tras comas/; y capitaliza la primera letra de cada línea.
function formato(txt) {
  return String(txt)
    .replace(/[ \t]*([,;])[ \t]*(?=\S)/g, '$1 ')
    .replace(/[ \t]{2,}/g, ' ')
    .split('\n')
    .map((l) => l.replace(/^(\s*)(\p{Ll})/u, (_, sp, ch) => sp + ch.toUpperCase()))
    .join('\n');
}

// Parte un campo de lista por comas / ; / saltos de línea en etiquetas.
function chips(inf, key) {
  return valor(inf, key)
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1));
}

onMounted(async () => { informes.value = await fetchInformes(props.leadId); });
</script>

<style scoped>
.informes { margin-bottom: 24px; }
.informe { border: 1px solid var(--border); border-radius: var(--radius); margin-bottom: 8px; background: var(--panel-2); }
.informe summary { cursor: pointer; padding: 8px 10px; display: flex; gap: 8px; align-items: center; font-size: 13px; }
.informe-fecha { font-weight: 600; }
.informe-body { padding: 4px 12px 12px; display: flex; flex-direction: column; gap: 8px; }
.kv-block { display: flex; flex-direction: column; gap: 2px; }
.kv-block .k { font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px; color: var(--text-dim); }
.kv-block .v { font-size: 13px; white-space: pre-wrap; }
.chips { display: flex; flex-wrap: wrap; gap: 4px; }
.chip { font-size: 12px; padding: 2px 8px; border-radius: 999px; background: var(--panel); border: 1px solid var(--border); }
</style>
