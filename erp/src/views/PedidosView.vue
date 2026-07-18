<template>
  <div class="pedidos">
    <div class="metrics">
      <span class="pill">Pedidos: <strong>{{ pedidos.length }}</strong></span>
      <span class="pill">Total: <strong>{{ money(sumaTotal) }}</strong></span>
      <button class="btn btn-sm" :disabled="cargando" @click="refrescar">
        {{ cargando ? 'Actualizando…' : 'Actualizar' }}
      </button>
    </div>

    <div class="filtros">
      <div class="fg grow">
        <label>Buscar</label>
        <input v-model="filtro" class="input" placeholder="Order ID, cliente, SKU…" />
      </div>
      <div class="fg">
        <label>Estado</label>
        <select v-model="filtroEstado" class="select">
          <option value="">Todos</option>
          <option value="pagado">Pagado</option>
          <option value="enviado">Enviado</option>
          <option value="cancelado">Cancelado</option>
        </select>
      </div>
    </div>

    <div v-if="cargando && pedidos.length === 0" class="muted">Cargando pedidos…</div>
    <div v-else-if="filtrados.length === 0" class="muted">No hay pedidos de ecommerce todavía.</div>

    <div v-else class="card table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Pedido</th>
            <th>Cliente</th>
            <th>Items</th>
            <th>Total</th>
            <th>Estado</th>
            <th>Fecha</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in filtrados" :key="p.id">
            <td class="mono">{{ p.orderId || p.id }}</td>
            <td>
              <div>{{ p.customer?.nombre || '—' }}</div>
              <div class="dim">{{ p.customer?.email || p.customer?.telefono || '' }}</div>
            </td>
            <td class="dim">{{ resumenItems(p) }}</td>
            <td>{{ money(p.total) }}</td>
            <td><span class="pill" :class="p.estado">{{ p.estado || '—' }}</span></td>
            <td class="dim">{{ fecha(p.paidAt || p.creado_en) }}</td>
            <td><button class="btn btn-sm" @click="sel = p">Ver</button></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="sel" class="drawer-backdrop" @click.self="sel = null">
      <div class="drawer">
        <header class="drawer-head">
          <h3>Pedido {{ sel.orderId || sel.id }}</h3>
          <button class="btn btn-sm" @click="sel = null">✕</button>
        </header>
        <div class="drawer-body">
          <section class="sec">
            <h4>Cliente</h4>
            <p>{{ sel.customer?.nombre || '—' }}</p>
            <p class="dim">{{ sel.customer?.email || '—' }} · {{ sel.customer?.telefono || '—' }}</p>
            <p v-if="sel.customer?.direccion" class="dim">{{ sel.customer.direccion }}</p>
          </section>
          <section class="sec">
            <h4>Artículos</h4>
            <table class="table">
              <thead>
                <tr><th>SKU</th><th>Nombre</th><th>Cant.</th><th>Precio</th><th>Subtotal</th></tr>
              </thead>
              <tbody>
                <tr v-for="(it, idx) in (sel.items || [])" :key="idx">
                  <td class="mono dim">{{ it.sku }}</td>
                  <td>{{ it.nombre }}</td>
                  <td>{{ it.cantidad }}</td>
                  <td>{{ money(it.precio) }}</td>
                  <td>{{ money(it.subtotal) }}</td>
                </tr>
              </tbody>
            </table>
          </section>
          <section class="sec">
            <div class="totales">
              <span>Total</span>
              <strong>{{ money(sel.total) }} {{ sel.currency || 'MXN' }}</strong>
            </div>
            <p class="dim">Almacén: {{ sel.almacenId || 'principal' }}</p>
            <p class="dim">Movimientos: {{ (sel.movementIds || []).join(', ') || '—' }}</p>
          </section>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { usePedidos } from '../composables/usePedidos.js';

const { pedidos, cargando, fetchPedidos } = usePedidos();
const filtro = ref('');
const filtroEstado = ref('');
const sel = ref(null);

onMounted(() => fetchPedidos());

async function refrescar() {
  await fetchPedidos(true);
}

const sumaTotal = computed(() =>
  pedidos.value.reduce((s, p) => s + (Number(p.total) || 0), 0)
);

const filtrados = computed(() => {
  const q = filtro.value.trim().toLowerCase();
  return pedidos.value.filter((p) => {
    if (filtroEstado.value && p.estado !== filtroEstado.value) return false;
    if (!q) return true;
    const blob = [
      p.orderId, p.id, p.customer?.nombre, p.customer?.email, p.customer?.telefono,
      ...(p.items || []).map((i) => `${i.sku} ${i.nombre}`),
    ].join(' ').toLowerCase();
    return blob.includes(q);
  });
});

function money(n) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(n) || 0);
}

function fecha(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
}

function resumenItems(p) {
  const items = p.items || [];
  if (items.length === 0) return '—';
  const n = items.reduce((s, i) => s + (Number(i.cantidad) || 0), 0);
  return `${items.length} línea${items.length === 1 ? '' : 's'} · ${n} pza`;
}
</script>

<style scoped>
.metrics { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 14px; }
.filtros { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 14px; }
.fg { display: flex; flex-direction: column; gap: 4px; min-width: 140px; }
.fg.grow { flex: 1; min-width: 220px; }
.fg label { font-size: 11px; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.4px; }
.muted { color: var(--text-muted); padding: 24px 0; }
.table-wrap { overflow-x: auto; }
.mono { font-family: ui-monospace, monospace; font-size: 12px; }
.pill.pagado { background: rgba(52, 211, 153, 0.15); color: var(--success); }
.pill.enviado { background: rgba(59, 130, 246, 0.15); color: var(--primary-hover); }
.pill.cancelado { background: rgba(248, 113, 113, 0.15); color: var(--danger); }

.drawer-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 300; display: flex; justify-content: flex-end; }
.drawer { width: 520px; max-width: 100%; background: var(--panel); border-left: 1px solid var(--border); height: 100%; display: flex; flex-direction: column; box-shadow: var(--shadow); }
.drawer-head { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; border-bottom: 1px solid var(--border); }
.drawer-head h3 { margin: 0; font-size: 15px; }
.drawer-body { padding: 16px; overflow-y: auto; }
.sec { margin-bottom: 22px; }
.sec h4 { margin: 0 0 10px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-dim); }
.sec p { margin: 0 0 4px; }
.totales { display: flex; justify-content: space-between; align-items: center; font-size: 16px; margin-bottom: 10px; }
</style>
