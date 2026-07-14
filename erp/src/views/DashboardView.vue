<template>
  <div class="dash">
    <div class="grid">
      <RouterLink to="/crm" class="card tile">
        <span class="tile-ico">📈</span>
        <div>
          <div class="tile-num">{{ resumen.leads }}</div>
          <div class="tile-lbl">Leads en pipeline</div>
        </div>
      </RouterLink>
      <RouterLink to="/almacen" class="card tile">
        <span class="tile-ico">📦</span>
        <div>
          <div class="tile-num">{{ resumen.items }}</div>
          <div class="tile-lbl">Artículos</div>
        </div>
      </RouterLink>
      <RouterLink to="/almacen" class="card tile" :class="{ alerta: resumen.stockBajo > 0 }">
        <span class="tile-ico">⚠️</span>
        <div>
          <div class="tile-num">{{ resumen.stockBajo }}</div>
          <div class="tile-lbl">Stock bajo</div>
        </div>
      </RouterLink>
      <RouterLink to="/equipo" class="card tile">
        <span class="tile-ico">👥</span>
        <div>
          <div class="tile-num">{{ resumen.empleados }}</div>
          <div class="tile-lbl">Empleados</div>
        </div>
      </RouterLink>
    </div>

    <div class="card welcome">
      <h3>Bienvenido a Voren ERP</h3>
      <p class="muted">
        Gestiona el pipeline comercial (CRM), tu equipo, el inventario del almacén y
        genera análisis automáticos con IA. Usa el menú lateral para navegar.
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase/config.js';

const resumen = ref({ leads: 0, items: 0, stockBajo: 0, empleados: 0 });

onMounted(async () => {
  const [leadsSnap, itemsSnap, stockSnap, empSnap] = await Promise.all([
    getDocs(query(collection(db, 'visited_stores'), where('visited_status', '==', 'visita_exitosa'))),
    getDocs(collection(db, 'inventory_items')),
    getDocs(query(collection(db, 'inventory_stock'), where('stock_bajo', '==', true))),
    getDocs(collection(db, 'empleados')),
  ]);
  resumen.value = {
    leads: leadsSnap.size,
    items: itemsSnap.size,
    stockBajo: stockSnap.size,
    empleados: empSnap.size,
  };
});
</script>

<style scoped>
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; margin-bottom: 18px; }
.tile { display: flex; align-items: center; gap: 14px; }
.tile:hover { border-color: var(--border-strong); }
.tile-ico { font-size: 28px; }
.tile-num { font-size: 26px; font-weight: 800; }
.tile-lbl { font-size: 12px; color: var(--text-dim); }
.tile.alerta { border-color: rgba(248,113,113,0.4); }
.welcome h3 { margin: 0 0 8px; }
.welcome p { margin: 0; line-height: 1.6; }
</style>
