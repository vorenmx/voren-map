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

      <div class="drawer-body" ref="bodyEl">
        <InformesVisita :lead-id="cliente.id" />

        <p v-if="soloInformes" class="dim solo-nota">
          Este cliente ya tiene un informe de visita registrado, por lo que no requiere llenar el formulario de primera visita.
        </p>

        <template v-if="!soloInformes">
        <p v-if="ultimaActualizacion" class="pill saved-pill">
          Guardado por {{ form.actualizado_por || '—' }} · {{ ultimaActualizacion }}
        </p>

        <p class="dim map-hint">
          Contacto, crédito, proveedor principal y método de cobro ya se capturaron en el mapa al marcar visita exitosa.
        </p>

        <p v-if="advertencia" class="warn-banner" role="alert">
          {{ advertencia }}
        </p>

        <section v-for="sec in ESQUEMA" :key="sec.titulo" class="sec">
          <h4>{{ sec.titulo }}</h4>
          <p v-if="sec.guion" class="guion">{{ sec.guion }}</p>

          <div
            v-for="campo in sec.campos"
            :key="campo.key"
            class="field"
            :class="{ 'field--error': incompletos.has(campo.key) }"
            :data-field="campo.key"
          >
            <label :for="campo.key">
              {{ campo.label }}
              <span class="req" aria-hidden="true">*</span>
            </label>

            <textarea
              v-if="campo.tipo === 'textarea'"
              :id="campo.key"
              v-model="form[campo.key]"
              class="textarea"
              rows="2"
              :placeholder="campo.placeholder || ''"
              @input="limpiarError(campo.key)"
            />
            <div v-else-if="campo.tipo === 'multi'" :id="campo.key" class="checks">
              <label v-for="op in campo.opciones" :key="op" class="check">
                <input
                  type="checkbox"
                  :value="op"
                  v-model="form[campo.key]"
                  @change="limpiarError(campo.key)"
                />
                {{ op }}
              </label>
            </div>
            <select
              v-else-if="campo.tipo === 'select'"
              :id="campo.key"
              v-model="form[campo.key]"
              class="select"
              @change="limpiarError(campo.key)"
            >
              <option value="">—</option>
              <option v-for="op in campo.opciones" :key="op" :value="op">{{ op }}</option>
            </select>
            <div v-else-if="campo.tipo === 'dias'" class="affix-input">
              <input
                :id="campo.key"
                v-model="form[campo.key]"
                class="input"
                type="number"
                min="1"
                step="1"
                :placeholder="campo.placeholder || 'Ej. 7'"
                @input="limpiarError(campo.key)"
              />
              <span class="affix">días</span>
            </div>
            <div v-else-if="campo.tipo === 'mxn'" class="affix-input">
              <span class="affix">$</span>
              <input
                :id="campo.key"
                v-model="form[campo.key]"
                class="input"
                type="number"
                min="0"
                step="1"
                :placeholder="campo.placeholder || '0'"
                @input="limpiarError(campo.key)"
              />
              <span class="affix">MXN</span>
            </div>
            <input
              v-else
              :id="campo.key"
              v-model="form[campo.key]"
              class="input"
              type="text"
              :placeholder="campo.placeholder || ''"
              @input="limpiarError(campo.key)"
            />
            <p v-if="incompletos.has(campo.key)" class="field-error">Esta pregunta es obligatoria</p>
          </div>
        </section>
        </template>
      </div>

      <footer class="drawer-foot">
        <span v-if="mensaje" class="foot-msg" :class="{ 'foot-msg--warn': !!advertencia }">{{ mensaje }}</span>
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

const VALORA_MAS_OPCIONES = [
  'Precio',
  'Días de crédito',
  'Delivery en menos de 24 horas',
  'Atención al cliente',
];

const FORMAS_PAGO_OPCIONES = ['Efectivo', 'Transferencia', 'Depósito', 'Tarjeta'];

// Preguntas propias del acercamiento. Se omiten las ya capturadas en el mapa
// (contacto, crédito, proveedor principal, método de cobro).
const ESQUEMA = [
  {
    titulo: 'Perfil del cliente',
    guion: 'Identificar el buyer persona y si es un cliente ideal (ICP) para nosotros.',
    campos: [
      { key: 'buyer_persona', label: 'Buyer persona (¿qué tipo de cliente es?)' },
      { key: 'es_icp', label: '¿Es un cliente ideal (ICP)?', tipo: 'select', opciones: ['Sí', 'No', 'Tal vez'] },
    ],
  },
  {
    titulo: 'Conocer al cliente',
    guion: 'Objetivo: conocer al posible cliente encargado de las compras.',
    campos: [
      { key: 'ventas_aproximadas', label: 'Ventas aproximadas o ¿cuántas motos reparan a la semana?' },
    ],
  },
  {
    titulo: 'Proveedores y dolores (painpoints)',
    guion: 'Deja que el cliente hable e indaga sobre surtido y compra de refacciones.',
    campos: [
      {
        key: 'dolores',
        label: 'Principales dolores de cabeza del negocio',
        tipo: 'textarea',
        placeholder: 'Hasta 3: abasto, precio, crédito, calidad…',
      },
      { key: 'marcas_favoritas', label: 'Marcas de refacciones que MÁS le gustan y por qué', tipo: 'textarea' },
      { key: 'marcas_menos_favoritas', label: 'Marcas que MENOS le gustan y por qué', tipo: 'textarea' },
      {
        key: 'frecuencia_pedidos',
        label: '¿Cada cuántos días hace pedidos?',
        tipo: 'dias',
        placeholder: 'Ej. 7',
      },
      {
        key: 'monto_pedido_promedio',
        label: '¿De qué monto es el pedido promedio?',
        tipo: 'mxn',
        placeholder: '0',
      },
      { key: 'puntualidad_entrega', label: '¿Le llegan las piezas a tiempo o tardan mucho?' },
      { key: 'problemas_devoluciones', label: '¿Ha tenido problemas de devoluciones o calidad con algún proveedor?', tipo: 'textarea' },
      { key: 'refacciones_problema_abasto', label: 'Refacciones con más problemas de abastecimiento', tipo: 'textarea' },
      {
        key: 'formas_pago',
        label: '¿Qué formas de pago tiene con sus proveedores?',
        tipo: 'multi',
        opciones: FORMAS_PAGO_OPCIONES,
      },
      {
        key: 'entrega_o_recoge',
        label: '¿Recoge las refacciones o el proveedor las entrega en su tienda?',
        tipo: 'select',
        opciones: ['Entregan en tienda', 'Recoge él', 'Ambas'],
      },
      {
        key: 'valora_mas',
        label: '¿Qué valora más? (puedes marcar varias)',
        tipo: 'multi',
        opciones: VALORA_MAS_OPCIONES,
      },
    ],
  },
  {
    titulo: 'Qué se mueve más en la tienda',
    campos: [
      {
        key: 'especializacion',
        label: '¿En qué marcas o tipo de refacción se especializan? ¿Cuál vende más?',
        placeholder: 'Ej. Italika / frenos y suspensión',
      },
      { key: 'piezas_mas_surtidas', label: '¿Qué le piden más / qué piezas surte más?', tipo: 'textarea' },
    ],
  },
  {
    titulo: 'Perfil de SKU y cantidades',
    campos: [
      { key: 'unidades_por_pedido', label: '¿Cuántas unidades suele pedir de cada producto clave en un pedido habitual?', tipo: 'textarea' },
      { key: 'sku_reserva_mayor', label: '¿Algún SKU del que le gustaría tener siempre una reserva mayor?', tipo: 'textarea' },
    ],
  },
  {
    titulo: 'Cierre de la visita',
    campos: [
      { key: 'notas_adicionales', label: 'Notas adicionales / observaciones del vendedor', tipo: 'textarea' },
    ],
  },
];

const CAMPOS = ESQUEMA.flatMap((s) => s.campos);

const form = reactive({});
for (const c of CAMPOS) {
  form[c.key] = c.tipo === 'multi' ? [] : '';
}

const bodyEl = ref(null);
const guardando = ref(false);
const mensaje = ref('');
const advertencia = ref('');
const incompletos = ref(new Set());

function normalizarValoraMas(valor) {
  if (Array.isArray(valor)) return valor.filter((v) => VALORA_MAS_OPCIONES.includes(v));
  if (!valor || typeof valor !== 'string') return [];
  if (valor === 'Ambos') return ['Precio', 'Días de crédito'];
  if (valor === 'Precio más ajustado') return ['Precio'];
  if (valor === 'Más días de crédito') return ['Días de crédito'];
  return VALORA_MAS_OPCIONES.includes(valor) ? [valor] : [];
}

function normalizarFormasPago(valor) {
  if (Array.isArray(valor)) return valor.filter((v) => FORMAS_PAGO_OPCIONES.includes(v));
  if (!valor || typeof valor !== 'string') return [];
  return FORMAS_PAGO_OPCIONES.filter((op) =>
    valor.toLowerCase().includes(op.toLowerCase()),
  );
}

function normalizarDolores(previo) {
  if (previo.dolores) return previo.dolores;
  const partes = [previo.dolor_1, previo.dolor_2, previo.dolor_3].filter(Boolean);
  return partes.length ? partes.join('\n') : '';
}

function campoCompleto(campo) {
  const valor = form[campo.key];
  if (campo.tipo === 'multi') return Array.isArray(valor) && valor.length > 0;
  if (campo.tipo === 'dias' || campo.tipo === 'mxn') {
    if (valor === '' || valor === null || valor === undefined) return false;
    const n = Number(valor);
    return Number.isFinite(n) && (campo.tipo === 'dias' ? n >= 1 : n >= 0);
  }
  return String(valor ?? '').trim().length > 0;
}

function validar() {
  const faltantes = new Set();
  for (const campo of CAMPOS) {
    if (!campoCompleto(campo)) faltantes.add(campo.key);
  }
  incompletos.value = faltantes;
  return faltantes.size === 0;
}

function limpiarError(key) {
  if (!incompletos.value.has(key)) return;
  const campo = CAMPOS.find((c) => c.key === key);
  if (campo && campoCompleto(campo)) {
    const next = new Set(incompletos.value);
    next.delete(key);
    incompletos.value = next;
    if (next.size === 0) {
      advertencia.value = '';
      if (mensaje.value.startsWith('Faltan')) mensaje.value = '';
    } else {
      advertencia.value = `Faltan ${next.size} pregunta${next.size === 1 ? '' : 's'} por responder. Completa los campos marcados en rojo.`;
      mensaje.value = advertencia.value;
    }
  }
}

function scrollPrimerError() {
  const firstKey = CAMPOS.find((c) => incompletos.value.has(c.key))?.key;
  if (!firstKey || !bodyEl.value) return;
  const el = bodyEl.value.querySelector(`[data-field="${firstKey}"]`);
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

onMounted(() => {
  const previo = props.cliente.primera_visita;
  if (previo) {
    Object.assign(form, previo);
    form.valora_mas = normalizarValoraMas(previo.valora_mas);
    form.formas_pago = normalizarFormasPago(previo.formas_pago);
    form.dolores = normalizarDolores(previo);
    if (previo.marca_mas_vendida && !previo.especializacion) {
      form.especializacion = previo.marca_mas_vendida;
    } else if (previo.marca_mas_vendida && previo.especializacion) {
      form.especializacion = `${previo.especializacion} · vende más: ${previo.marca_mas_vendida}`;
    }
  }
  // Contacto ya capturado en el mapa (responsable_compras_*) — se hereda, no se vuelve a pedir.
  form.encargado_compras = props.cliente.responsable_compras_nombre || form.encargado_compras || '';
  form.telefono_tienda = props.cliente.responsable_compras_telefono || form.telefono_tienda || '';
});

const ultimaActualizacion = computed(() => {
  if (!form.actualizado_en) return '';
  return new Date(form.actualizado_en).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
});

async function guardar() {
  mensaje.value = '';
  advertencia.value = '';

  if (!validar()) {
    const n = incompletos.value.size;
    advertencia.value = `Faltan ${n} pregunta${n === 1 ? '' : 's'} por responder. Completa los campos marcados en rojo para guardar la visita.`;
    mensaje.value = advertencia.value;
    scrollPrimerError();
    return;
  }

  guardando.value = true;
  try {
    const datos = { ...form };
    delete datos.actualizado_por;
    delete datos.actualizado_en;
    const guardado = await guardarPrimeraVisita(props.cliente.id, datos);
    Object.assign(form, guardado);
    form.valora_mas = normalizarValoraMas(guardado.valora_mas);
    form.formas_pago = normalizarFormasPago(guardado.formas_pago);
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
.saved-pill { margin-bottom: 12px; color: var(--success); border-color: rgba(52,211,153,0.3); }
.map-hint { font-size: 12px; margin: 0 0 16px; line-height: 1.4; }
.warn-banner {
  margin: 0 0 16px;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(248, 113, 113, 0.12);
  border: 1px solid rgba(248, 113, 113, 0.45);
  color: #fca5a5;
  font-size: 13px;
  line-height: 1.4;
}
.solo-nota { font-size: 13px; margin: 4px 0 0; }
.sec { margin-bottom: 24px; }
.sec h4 { margin: 0 0 4px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--accent-2); }
.guion { margin: 0 0 12px; font-size: 12px; color: var(--text-dim); font-style: italic; }
.field { margin-bottom: 12px; }
.field label { display: block; }
.req { color: #f87171; margin-left: 2px; }
.field--error .input,
.field--error .textarea,
.field--error .select {
  border-color: #f87171;
  box-shadow: 0 0 0 1px rgba(248, 113, 113, 0.35);
}
.field--error .checks {
  padding: 8px;
  border-radius: 8px;
  border: 1px solid rgba(248, 113, 113, 0.55);
  background: rgba(248, 113, 113, 0.06);
}
.field--error .affix-input {
  border-radius: 8px;
  box-shadow: 0 0 0 1px rgba(248, 113, 113, 0.55);
}
.field-error { margin: 4px 0 0; font-size: 11px; color: #f87171; }
.checks { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
.check { display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer; color: var(--text); }
.check input { width: auto; margin: 0; accent-color: var(--accent); }
.affix-input {
  display: flex;
  align-items: center;
  gap: 8px;
}
.affix-input .input { flex: 1; min-width: 0; }
.affix {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--text-dim);
  font-weight: 600;
}
.drawer-foot { display: flex; align-items: center; justify-content: flex-end; gap: 10px; padding: 12px 16px; border-top: 1px solid var(--border); }
.foot-msg { margin-right: auto; font-size: 12px; color: var(--text-dim); }
.foot-msg--warn { color: #fca5a5; }
</style>
