<template>
  <div class="drawer-backdrop" @click.self="$emit('close')">
    <div class="drawer">
      <header class="drawer-head">
        <h3>{{ form.nuevo ? 'Nuevo artículo' : form.nombre }}</h3>
        <button class="btn btn-sm" @click="$emit('close')">✕</button>
      </header>

      <div class="drawer-body">
        <section class="sec">
          <div class="row">
            <div><label>SKU</label><input v-model="form.sku" class="input" :disabled="!puedeEditar" /></div>
            <div><label>Unidad</label><input v-model="form.unidad" class="input" :disabled="!puedeEditar" placeholder="pza" /></div>
          </div>
          <label>Nombre</label>
          <input v-model="form.nombre" class="input" :disabled="!puedeEditar" />
          <label>Categoría</label>
          <input v-model="form.categoria" class="input" :disabled="!puedeEditar" />
          <label>Descripción</label>
          <textarea v-model="form.descripcion" class="textarea" rows="2" :disabled="!puedeEditar"></textarea>
          <div class="row">
            <div><label>Costo unitario</label><input v-model.number="form.costo_unitario" type="number" class="input" :disabled="!puedeEditar" /></div>
            <div><label>Precio venta</label><input v-model.number="form.precio_venta" type="number" class="input" :disabled="!puedeEditar" /></div>
          </div>
          <div class="row">
            <div><label>Stock mínimo</label><input v-model.number="form.stock_minimo" type="number" class="input" :disabled="!puedeEditar" /></div>
            <div><label>Imagen (URL)</label><input v-model="form.imagen_url" class="input" :disabled="!puedeEditar" /></div>
          </div>
        </section>

        <section class="sec">
          <h4>Códigos de barras</h4>
          <div class="codes">
            <span v-for="(c, idx) in form.codigos_barras" :key="idx" class="pill">
              {{ c }}
              <button v-if="puedeEditar" class="x" @click="quitarCodigo(idx)">✕</button>
            </span>
            <span v-if="form.codigos_barras.length === 0" class="dim">Sin códigos.</span>
          </div>
          <div v-if="puedeEditar" class="add-code">
            <input v-model="nuevoCodigo" class="input" placeholder="Agregar código (EAN/UPC/interno)" @keyup.enter="agregarCodigo" />
            <button class="btn btn-sm" @click="agregarCodigo">+</button>
          </div>
        </section>

        <section v-if="!form.nuevo" class="sec">
          <h4>Etiqueta imprimible</h4>
          <BarcodeLabel :value="form.codigos_barras[0] || form.sku || form.id" :nombre="form.nombre" />
        </section>

        <section class="sec">
          <label class="check"><input type="checkbox" v-model="form.activo" :disabled="!puedeEditar" /> Activo</label>
          <label class="check"><input type="checkbox" v-model="form.publicar_ecommerce" :disabled="!puedeEditar" /> Publicar en e-commerce</label>
        </section>

        <div v-if="puedeEditar" class="save-row">
          <button class="btn btn-primary" @click="guardar" :disabled="guardando">Guardar</button>
        </div>

        <section v-if="!form.nuevo" class="sec">
          <h4>Historial de movimientos</h4>
          <table class="table">
            <thead><tr><th>Fecha</th><th>Tipo</th><th>Cant.</th><th>Motivo</th></tr></thead>
            <tbody>
              <tr v-for="m in historial" :key="m.id">
                <td class="dim">{{ fecha(m.fecha) }}</td>
                <td>{{ m.tipo }}</td>
                <td>{{ m.cantidad }}</td>
                <td class="dim">{{ m.motivo || '—' }}</td>
              </tr>
              <tr v-if="historial.length === 0"><td colspan="4" class="dim">Sin movimientos.</td></tr>
            </tbody>
          </table>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useInventario } from '../composables/useInventario.js';
import { useAuth } from '../composables/useAuth.js';
import BarcodeLabel from './BarcodeLabel.vue';

const props = defineProps({
  item: { type: Object, required: true },
  almacen: { type: String, default: 'principal' },
});
const emit = defineEmits(['close', 'saved']);

const { guardarItem, historialMovimientos } = useInventario();
const { esAdminOGerente } = useAuth();
const puedeEditar = esAdminOGerente;

const form = ref({
  nuevo: props.item.nuevo || false,
  id: props.item.id,
  sku: props.item.sku || '',
  nombre: props.item.nombre || '',
  categoria: props.item.categoria || '',
  descripcion: props.item.descripcion || '',
  unidad: props.item.unidad || 'pza',
  costo_unitario: props.item.costo_unitario || 0,
  precio_venta: props.item.precio_venta || 0,
  stock_minimo: props.item.stock_minimo || 0,
  imagen_url: props.item.imagen_url || '',
  codigos_barras: [...(props.item.codigos_barras || [])],
  activo: props.item.activo !== false,
  publicar_ecommerce: !!props.item.publicar_ecommerce,
});
const nuevoCodigo = ref('');
const guardando = ref(false);
const historial = ref([]);

onMounted(async () => {
  if (!form.value.nuevo && form.value.id) {
    historial.value = await historialMovimientos(form.value.id);
  }
});

function agregarCodigo() {
  const c = nuevoCodigo.value.trim();
  if (c && !form.value.codigos_barras.includes(c)) form.value.codigos_barras.push(c);
  nuevoCodigo.value = '';
}
function quitarCodigo(idx) { form.value.codigos_barras.splice(idx, 1); }

async function guardar() {
  guardando.value = true;
  try {
    await guardarItem({ ...form.value, id: form.value.nuevo ? undefined : form.value.id });
    emit('saved');
  } finally {
    guardando.value = false;
  }
}

function fecha(ts) {
  const d = ts?.toDate?.();
  return d ? d.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : '';
}
</script>

<style scoped>
.drawer-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 300; display: flex; justify-content: flex-end; }
.drawer { width: 460px; max-width: 100%; background: var(--panel); border-left: 1px solid var(--border); height: 100%; display: flex; flex-direction: column; box-shadow: var(--shadow); }
.drawer-head { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; border-bottom: 1px solid var(--border); }
.drawer-head h3 { margin: 0; font-size: 15px; }
.drawer-body { padding: 16px; overflow-y: auto; }
.sec { margin-bottom: 22px; }
.sec h4 { margin: 0 0 10px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-dim); }
.row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
label { margin-top: 10px; }
.codes { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
.x { background: none; border: none; color: var(--text-dim); cursor: pointer; padding: 0 0 0 4px; }
.add-code { display: flex; gap: 6px; }
.check { display: flex; align-items: center; gap: 8px; }
.check input { width: auto; }
.save-row { display: flex; justify-content: flex-end; margin-bottom: 20px; }
</style>
