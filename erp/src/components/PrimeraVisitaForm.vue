<template>
  <div class="drawer-backdrop" @click.self="$emit('close')">
    <div class="drawer">
      <header class="drawer-head">
        <div>
          <h3>{{ soloInformes ? 'Informe de visita' : 'Primera visita · Acercamiento inicial' }}</h3>
          <p class="dim head-sub">{{ cliente.name || cliente.company_name || cliente.id }}</p>
        </div>
        <button class="btn btn-sm" @click="$emit('close')">✕</button>
      </header>

      <div class="drawer-body">
        <InformesVisita :lead-id="cliente.id" />

        <p v-if="soloInformes" class="dim solo-nota">
          Este cliente ya tiene un informe de visita registrado, por lo que no requiere llenar el formulario de primera visita.
        </p>

        <template v-if="!soloInformes">
        <p v-if="ultimaActualizacion" class="pill saved-pill">
          Guardado por {{ form.actualizado_por || '—' }} · {{ ultimaActualizacion }}
        </p>

        <section v-for="sec in ESQUEMA" :key="sec.titulo" class="sec">
          <h4>{{ sec.titulo }}</h4>
          <p v-if="sec.guion" class="guion">{{ sec.guion }}</p>

          <div v-for="campo in sec.campos" :key="campo.key" class="field">
            <label :for="campo.key">{{ campo.label }}</label>

            <textarea
              v-if="campo.tipo === 'textarea'"
              :id="campo.key"
              v-model="form[campo.key]"
              class="textarea"
              rows="2"
              :placeholder="campo.placeholder || ''"
            />
            <select
              v-else-if="campo.tipo === 'select'"
              :id="campo.key"
              v-model="form[campo.key]"
              class="select"
            >
              <option value="">—</option>
              <option v-for="op in campo.opciones" :key="op" :value="op">{{ op }}</option>
            </select>
            <input
              v-else
              :id="campo.key"
              v-model="form[campo.key]"
              class="input"
              :type="campo.tipo === 'number' ? 'number' : 'text'"
              :placeholder="campo.placeholder || ''"
            />
          </div>
        </section>
        </template>
      </div>

      <footer class="drawer-foot">
        <span v-if="mensaje" class="dim">{{ mensaje }}</span>
        <button class="btn" @click="$emit('close')">Cerrar</button>
        <button v-if="!soloInformes" class="btn btn-primary" :disabled="guardando" @click="guardar">
          {{ guardando ? 'Guardando…' : 'Guardar visita' }}
        </button>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useCrm } from '../composables/useCrm.js';
import InformesVisita from './InformesVisita.vue';

const props = defineProps({
  cliente: { type: Object, required: true },
  soloInformes: { type: Boolean, default: false },
});
const emit = defineEmits(['close', 'updated']);

const { guardarPrimeraVisita } = useCrm();

// Guion + preguntas extraídas del documento "Primera visita: Acercamiento inicial".
const ESQUEMA = [
  {
    titulo: 'Conocer al cliente',
    guion: 'Objetivo: conocer al posible cliente encargado de las compras.',
    campos: [
      { key: 'ventas_aproximadas', label: 'Ventas aproximadas o ¿cuántas motos reparan a la semana?' },
    ],
  },
  {
    titulo: 'Qué se mueve más en la tienda',
    campos: [
      { key: 'especializacion', label: '¿Se especializan en alguna marca de motos o tipo de refacción?' },
      { key: 'marca_mas_vendida', label: '¿Qué marca vende más? (Vento, Italika, Bajaj…)' },
      { key: 'piezas_mas_surtidas', label: '¿Qué le piden más / qué piezas surte más?', tipo: 'textarea' },
    ],
  },
  {
    titulo: 'Perfil del cliente',
    guion: 'Identificar el buyer persona y si es un cliente ideal (ICP) para nosotros.',
    campos: [
      { key: 'buyer_persona', label: 'Buyer persona (¿qué tipo de cliente es?)' },
      { key: 'es_icp', label: '¿Es un cliente ideal (ICP)?', tipo: 'select', opciones: ['Sí', 'No', 'Tal vez'] },
    ],
  },
  {
    titulo: 'Proveedores y dolores (painpoints)',
    guion: 'Deja que el cliente hable e indaga sobre surtido y compra de refacciones.',
    campos: [
      { key: 'dolor_1', label: 'Dolor de cabeza #1 del negocio' },
      { key: 'dolor_2', label: 'Dolor de cabeza #2 del negocio' },
      { key: 'dolor_3', label: 'Dolor de cabeza #3 del negocio' },
      { key: 'principales_proveedores', label: '¿Cuáles son sus principales proveedores?', tipo: 'textarea' },
      { key: 'marcas_favoritas', label: 'Marcas de refacciones que MÁS le gustan y por qué', tipo: 'textarea' },
      { key: 'marcas_menos_favoritas', label: 'Marcas que MENOS le gustan y por qué', tipo: 'textarea' },
      { key: 'frecuencia_pedidos', label: '¿Cada cuánto tiempo hace pedidos?' },
      { key: 'monto_pedido_promedio', label: '¿De qué monto es el pedido promedio?' },
      { key: 'puntualidad_entrega', label: '¿Le llegan las piezas a tiempo o tardan mucho?' },
      { key: 'problemas_devoluciones', label: '¿Ha tenido problemas de devoluciones o calidad con algún proveedor?', tipo: 'textarea' },
      { key: 'refacciones_problema_abasto', label: 'Refacciones con más problemas de abastecimiento', tipo: 'textarea' },
      { key: 'buen_precio', label: '¿Le dan buen precio?' },
      { key: 'formas_pago', label: '¿Qué formas de pago tiene con sus proveedores?' },
      { key: 'tiene_credito', label: '¿Le dan crédito?', tipo: 'select', opciones: ['Sí', 'No'] },
      { key: 'entrega_o_recoge', label: '¿Recoge las refacciones o el proveedor las entrega en su tienda?', tipo: 'select', opciones: ['Entregan en tienda', 'Recoge él', 'Ambas'] },
    ],
  },
  {
    titulo: 'Perfil de SKU y cantidades',
    campos: [
      { key: 'productos_clave', label: '¿Cuáles son sus productos clave en este momento?', tipo: 'textarea' },
      { key: 'unidades_por_pedido', label: '¿Cuántas unidades suele pedir de cada uno en un pedido habitual?', tipo: 'textarea' },
      { key: 'sku_reserva_mayor', label: '¿Algún SKU del que le gustaría tener siempre una reserva mayor?', tipo: 'textarea' },
    ],
  },
  {
    titulo: 'Palanca de negociación',
    campos: [
      { key: 'valora_mas', label: '¿Qué valora más?', tipo: 'select', opciones: ['Precio más ajustado', 'Más días de crédito', 'Ambos'] },
    ],
  },
  {
    titulo: 'Cierre de la visita',
    campos: [
      { key: 'numero_contacto', label: '¿Con qué número podemos contactarlo directamente?' },
      { key: 'notas_adicionales', label: 'Notas adicionales / observaciones del vendedor', tipo: 'textarea' },
    ],
  },
];

const form = reactive({});
for (const sec of ESQUEMA) for (const c of sec.campos) form[c.key] = '';

const guardando = ref(false);
const mensaje = ref('');

onMounted(() => {
  const previo = props.cliente.primera_visita;
  if (previo) Object.assign(form, previo);
  // "Encargado de compras" y "teléfono de la tienda" ya se capturan en la
  // encuesta del mapa (responsable_compras_nombre/telefono) — se heredan
  // aquí en vez de pedirlos de nuevo en el acercamiento inicial.
  form.encargado_compras = props.cliente.responsable_compras_nombre || form.encargado_compras || '';
  form.telefono_tienda = props.cliente.responsable_compras_telefono || form.telefono_tienda || '';
});

const ultimaActualizacion = computed(() => {
  if (!form.actualizado_en) return '';
  return new Date(form.actualizado_en).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
});

async function guardar() {
  guardando.value = true;
  mensaje.value = '';
  try {
    const datos = { ...form };
    delete datos.actualizado_por;
    delete datos.actualizado_en;
    const guardado = await guardarPrimeraVisita(props.cliente.id, datos);
    Object.assign(form, guardado);
    mensaje.value = 'Guardado ✓';
    emit('updated');
  } catch (e) {
    mensaje.value = 'No se pudo guardar. Revisa tu conexión o permisos.';
  } finally {
    guardando.value = false;
  }
}
</script>

<style scoped>
.drawer-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 300; display: flex; justify-content: flex-end; }
.drawer { width: 560px; max-width: 100%; background: var(--panel); border-left: 1px solid var(--border); height: 100%; display: flex; flex-direction: column; box-shadow: var(--shadow); }
.drawer-head { display: flex; justify-content: space-between; align-items: flex-start; padding: 14px 16px; border-bottom: 1px solid var(--border); }
.drawer-head h3 { margin: 0; font-size: 15px; }
.head-sub { margin: 2px 0 0; font-size: 12px; text-transform: uppercase; }
.drawer-body { padding: 16px; overflow-y: auto; flex: 1; }
.saved-pill { margin-bottom: 16px; color: var(--success); border-color: rgba(52,211,153,0.3); }
.solo-nota { font-size: 13px; margin: 4px 0 0; }
.sec { margin-bottom: 24px; }
.sec h4 { margin: 0 0 4px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--accent-2); }
.guion { margin: 0 0 12px; font-size: 12px; color: var(--text-dim); font-style: italic; }
.field { margin-bottom: 12px; }
.drawer-foot { display: flex; align-items: center; justify-content: flex-end; gap: 10px; padding: 12px 16px; border-top: 1px solid var(--border); }
.drawer-foot .dim { margin-right: auto; font-size: 12px; }
</style>
