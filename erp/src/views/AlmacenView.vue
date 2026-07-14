<template>
  <div class="almacen">
    <div class="head">
      <div class="tabs">
        <button class="btn btn-sm" :class="{ 'btn-primary': tab==='inventario' }" @click="tab='inventario'">Inventario</button>
        <button class="btn btn-sm" :class="{ 'btn-primary': tab==='movimiento' }" @click="tab='movimiento'">Registrar movimiento</button>
        <button class="btn btn-sm" :class="{ 'btn-primary': tab==='alertas' }" @click="tab='alertas'">
          Alertas <span v-if="bajos.length" class="pill off">{{ bajos.length }}</span>
        </button>
      </div>
      <div class="head-right">
        <select v-if="almacenes.length > 1" v-model="almacenSel" class="select">
          <option v-for="a in almacenes" :key="a.id" :value="a.id">{{ a.nombre }}</option>
        </select>
        <button v-if="esAdminOGerente" class="btn btn-primary" @click="nuevoItem">+ Artículo</button>
      </div>
    </div>

    <!-- Inventario -->
    <div v-if="tab==='inventario'" class="card">
      <input v-model="filtro" class="input" placeholder="Buscar por nombre, SKU o código…" style="max-width:300px;margin-bottom:12px" />
      <table class="table">
        <thead>
          <tr><th>SKU</th><th>Nombre</th><th>Categoría</th><th>Cantidad</th><th>Disponible</th><th>Precio</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="i in itemsFiltrados" :key="i.id" :class="{ bajo: stockDe(i.id, almacenSel).stock_bajo }">
            <td class="dim">{{ i.sku || '—' }}</td>
            <td>{{ i.nombre }}</td>
            <td>{{ i.categoria || '—' }}</td>
            <td>{{ stockDe(i.id, almacenSel).cantidad }} {{ i.unidad }}</td>
            <td>{{ stockDe(i.id, almacenSel).disponible }}</td>
            <td>{{ money(i.precio_venta) }}</td>
            <td><button class="btn btn-sm" @click="abrirItem(i)">Ver</button></td>
          </tr>
          <tr v-if="itemsFiltrados.length === 0"><td colspan="7" class="dim">Sin artículos.</td></tr>
        </tbody>
      </table>
    </div>

    <!-- Movimiento -->
    <div v-else-if="tab==='movimiento'" class="card mov-card">
      <h3>Registrar movimiento</h3>
      <BarcodeScanner @scanned="onScan" />
      <p v-if="mensaje" class="ok-msg">{{ mensaje }}</p>

      <div v-if="itemMov" class="mov-form">
        <div class="mov-item">
          <strong>{{ itemMov.nombre }}</strong>
          <span class="dim">{{ itemMov.sku }} · Stock: {{ stockDe(itemMov.id, almacenSel).cantidad }} {{ itemMov.unidad }}</span>
        </div>
        <div class="row">
          <div>
            <label>Tipo</label>
            <select v-model="movTipo" class="select">
              <option value="entrada">Entrada</option>
              <option value="salida">Salida</option>
              <option value="ajuste">Ajuste (cantidad final)</option>
            </select>
          </div>
          <div>
            <label>Cantidad</label>
            <input v-model.number="movCantidad" type="number" class="input" min="0" />
          </div>
        </div>
        <label>Motivo</label>
        <input v-model="movMotivo" class="input" placeholder="Compra, venta, merma…" />
        <div class="mov-actions">
          <button class="btn" @click="itemMov = null">Cancelar</button>
          <button class="btn btn-primary" @click="aplicar" :disabled="!esVentas || aplicando">Aplicar</button>
        </div>
        <p v-if="!esVentas" class="err">No tienes permiso para registrar movimientos.</p>
      </div>
    </div>

    <!-- Alertas -->
    <div v-else class="card">
      <h3>Stock bajo</h3>
      <table class="table">
        <thead><tr><th>Nombre</th><th>SKU</th><th>Cantidad</th><th>Mínimo</th></tr></thead>
        <tbody>
          <tr v-for="i in bajos" :key="i.id" class="bajo">
            <td>{{ i.nombre }}</td>
            <td class="dim">{{ i.sku || '—' }}</td>
            <td>{{ stockDe(i.id, almacenSel).cantidad }}</td>
            <td>{{ i.stock_minimo }}</td>
          </tr>
          <tr v-if="bajos.length === 0"><td colspan="4" class="dim">Todo en niveles saludables. 🎉</td></tr>
        </tbody>
      </table>
    </div>

    <ItemDetalle
      v-if="itemSel"
      :item="itemSel"
      :almacen="almacenSel"
      @close="itemSel = null"
      @saved="onSaved"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useInventario } from '../composables/useInventario.js';
import { useAuth } from '../composables/useAuth.js';
import BarcodeScanner from '../components/BarcodeScanner.vue';
import ItemDetalle from '../components/ItemDetalle.vue';

const {
  items, almacenes, ALMACEN_DEFAULT, fetchInventario, stockDe,
  registrarMovimiento, buscarPorCodigo,
} = useInventario();
const { esAdminOGerente, esVentas } = useAuth();

const tab = ref('inventario');
const filtro = ref('');
const almacenSel = ref(ALMACEN_DEFAULT);
const itemSel = ref(null);

const itemMov = ref(null);
const movTipo = ref('entrada');
const movCantidad = ref(1);
const movMotivo = ref('');
const aplicando = ref(false);
const mensaje = ref('');

onMounted(() => fetchInventario());

const itemsFiltrados = computed(() => {
  const f = filtro.value.toLowerCase().trim();
  if (!f) return items.value;
  return items.value.filter((i) =>
    (i.nombre || '').toLowerCase().includes(f) ||
    (i.sku || '').toLowerCase().includes(f) ||
    (i.codigos_barras || []).some((c) => c.toLowerCase().includes(f))
  );
});

const bajos = computed(() => items.value.filter((i) => stockDe(i.id, almacenSel.value).stock_bajo));

function money(n) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0);
}
function nuevoItem() { itemSel.value = { nuevo: true }; }
function abrirItem(i) { itemSel.value = i; }
async function onSaved() { itemSel.value = null; await fetchInventario(true); }

async function onScan(codigo) {
  mensaje.value = '';
  const item = await buscarPorCodigo(codigo);
  if (item) {
    itemMov.value = item;
  } else {
    mensaje.value = `No se encontró un artículo con el código "${codigo}".`;
    itemMov.value = null;
  }
}

async function aplicar() {
  if (!itemMov.value) return;
  aplicando.value = true;
  try {
    await registrarMovimiento({
      itemId: itemMov.value.id,
      almacenId: almacenSel.value,
      tipo: movTipo.value,
      cantidad: movCantidad.value,
      motivo: movMotivo.value,
    });
    mensaje.value = `Movimiento registrado. Se actualizará el stock en unos segundos.`;
    itemMov.value = null;
    movCantidad.value = 1;
    movMotivo.value = '';
    setTimeout(() => fetchInventario(true), 3000);
  } finally {
    aplicando.value = false;
  }
}
</script>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; gap: 12px; flex-wrap: wrap; }
.tabs { display: flex; gap: 8px; }
.head-right { display: flex; gap: 8px; align-items: center; }
.mov-card { max-width: 560px; }
.mov-card h3 { margin: 0 0 14px; }
.mov-form { margin-top: 16px; }
.mov-item { display: flex; flex-direction: column; gap: 2px; margin-bottom: 12px; padding: 10px; background: var(--panel-2); border-radius: var(--radius); }
.row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 10px; }
.mov-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
.ok-msg { color: var(--success); font-size: 13px; margin-top: 10px; }
.err { color: var(--danger); font-size: 12px; }
.pill.off { color: var(--danger); padding: 1px 7px; }
tr.bajo td { background: rgba(248,113,113,0.08); }
</style>
