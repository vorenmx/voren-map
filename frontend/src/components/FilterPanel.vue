<template>
  <aside class="filter-panel" :class="{ collapsed, 'mobile-open': mobileOpen }">
    <button class="collapse-btn" @click="handleCollapseClick" :title="collapsed ? 'Expandir filtros' : 'Colapsar filtros'">
      <span>{{ collapsed ? '›' : '‹' }}</span>
    </button>

    <div v-show="!collapsed" class="panel-content">
      <div class="panel-header">
        <h2 class="panel-title">Filtros</h2>
        <button class="reset-btn" @click="resetFilters">Restablecer</button>
      </div>

      <!-- Stats -->
      <div class="stats-row">
        <div class="stat">
          <span class="stat-number">{{ totalCount.toLocaleString() }}</span>
          <span class="stat-label">total</span>
        </div>
        <div class="stat">
          <span class="stat-number">{{ filteredCount.toLocaleString() }}</span>
          <span class="stat-label">mostradas</span>
        </div>
      </div>

      <!-- Modo de Vista -->
      <section class="filter-section">
        <label class="section-label">Modo de Vista</label>
        <div class="toggle-group">
          <button
            class="toggle-btn"
            :class="{ active: modelValue.viewMode === 'hex' }"
            @click="emit('update:modelValue', { ...modelValue, viewMode: 'hex' })"
          >
            Densidad
          </button>
          <button
            class="toggle-btn"
            :class="{ active: modelValue.viewMode === 'points' }"
            @click="emit('update:modelValue', { ...modelValue, viewMode: 'points' })"
          >
            Tiendas
          </button>
        </div>
        <button
          class="toggle-btn compare-btn"
          :class="{ active: modelValue.viewMode === 'compare' }"
          @click="emit('update:modelValue', { ...modelValue, viewMode: 'compare' })"
          style="margin-top:6px; width:100%;"
        >
          Comparar Compras vs Pedido Prom.
        </button>
      </section>

      <!-- Tipo de Tienda -->
      <section class="filter-section">
        <label class="section-label">Tipo de Tienda</label>
        <div class="checkbox-group">
          <label
            v-for="type in SHOP_TYPES"
            :key="type.value"
            class="checkbox-item"
          >
            <input
              type="checkbox"
              :checked="modelValue.shopTypes.includes(type.value)"
              @change="toggleShopType(type.value)"
            />
            <span class="dot" :style="{ background: type.color }"></span>
            {{ type.label }}
          </label>
        </div>
      </section>

      <!-- Fuente de Datos -->
      <section class="filter-section">
        <label class="section-label">Fuente de Datos</label>
        <div class="checkbox-group">
          <label
            v-for="src in SOURCES"
            :key="src.value"
            class="checkbox-item"
          >
            <input
              type="checkbox"
              :checked="modelValue.sources.includes(src.value)"
              @change="toggleSource(src.value)"
            />
            {{ src.label }}
          </label>
        </div>
      </section>

      <!-- Estado de Visita (visitada / no visitada) -->
      <section class="filter-section">
        <label class="section-label">Estado de Visita</label>
        <div class="checkbox-group">
          <label v-for="vs in VISIT_STATUS" :key="vs.value" class="checkbox-item">
            <input
              type="checkbox"
              :checked="modelValue.showVisitStatus.includes(vs.value)"
              @change="toggleVisitStatus(vs.value)"
            />
            <span class="dot" :style="{ background: vs.color }"></span>
            {{ vs.label }}
          </label>
        </div>
      </section>

      <!-- Estado de la Tienda (visited_status) -->
      <section class="filter-section">
        <label class="section-label">Estado de la Tienda</label>
        <div class="checkbox-group">
          <label v-for="st in VISITED_STATUSES" :key="st.value" class="checkbox-item">
            <input
              type="checkbox"
              :checked="modelValue.showVisitedStatuses.includes(st.value)"
              @change="toggleVisitedStatus(st.value)"
            />
            <span class="dot" :style="{ background: st.color }"></span>
            {{ st.label }}
          </label>
        </div>
      </section>

      <!-- Estado -->
      <section class="filter-section">
        <label class="section-label">Estado</label>
        <select class="select-input" :value="modelValue.state" @change="setFilter('state', $event.target.value)">
          <option value="">Todos los estados</option>
          <option v-for="s in allStates" :key="s" :value="s">{{ s }}</option>
        </select>
      </section>

      <!-- Calificación Mínima -->
      <section class="filter-section">
        <label class="section-label">
          Calificación Mín.
          <span class="rating-val">{{ modelValue.minRating > 0 ? modelValue.minRating + '★' : 'Cualquiera' }}</span>
        </label>
        <input
          type="range"
          min="0"
          max="5"
          step="0.5"
          :value="modelValue.minRating"
          @input="setFilter('minRating', parseFloat($event.target.value))"
          class="range-input"
        />
        <div class="range-labels">
          <span>Cualquiera</span>
          <span>5★</span>
        </div>
      </section>

      <!-- Leyenda (modo puntos) -->
      <section v-if="modelValue.viewMode === 'points'" class="filter-section legend-section">
        <label class="section-label">Leyenda</label>
        <div v-for="type in SHOP_TYPES" :key="type.value" class="legend-item">
          <span class="legend-dot" :style="{ background: type.color }"></span>
          {{ type.label }}
        </div>
      </section>

      <!-- Controles de comparación -->
      <section v-if="modelValue.viewMode === 'compare'" class="filter-section">
        <label class="section-label">Mostrar Columnas</label>
        <label class="checkbox-item">
          <input
            type="checkbox"
            :checked="modelValue.showPurchases"
            @change="setFilter('showPurchases', $event.target.checked)"
          />
          <span class="dot" style="background:#3b82f6;"></span>
          Compras Totales
        </label>
        <label class="checkbox-item" style="margin-top:6px;">
          <input
            type="checkbox"
            :checked="modelValue.showAvgOrder"
            @change="setFilter('showAvgOrder', $event.target.checked)"
          />
          <span class="dot" style="background:#f59e0b;"></span>
          Pedido Prom. (MXN)
        </label>
        <p class="legend-note" style="margin-top:10px;">Alturas normalizadas de forma independiente — más alto = valor relativamente mayor. Acerca y ladea el mapa para ver las columnas en 3D.</p>
      </section>
    </div>
  </aside>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  modelValue: { type: Object, required: true },
  allStates: { type: Array, default: () => [] },
  totalCount: { type: Number, default: 0 },
  filteredCount: { type: Number, default: 0 },
  mobileOpen: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue', 'close']);
const collapsed = ref(false);

function handleCollapseClick() {
  if (window.innerWidth <= 640) {
    emit('close');
  } else {
    collapsed.value = !collapsed.value;
  }
}

const SHOP_TYPES = [
  { value: 'Repair', label: 'Reparación', color: '#3b82f6' },
  { value: 'Parts',  label: 'Refacciones', color: '#f59e0b' },
  { value: 'Both',   label: 'Ambos',      color: '#10b981' },
  { value: 'Other',  label: 'Otro',       color: '#9ca3af' },
];

const SOURCES = [
  { value: 'denue',  label: 'Solo DENUE' },
  { value: 'google', label: 'Solo Google' },
  { value: 'both',   label: 'Coincidentes (ambas)' },
];

const VISIT_STATUS = [
  { value: 'visitada',    label: 'Visitada',    color: '#22c55e' },
  { value: 'no_visitada', label: 'No Visitada', color: '#64748b' },
];

const VISITED_STATUSES = [
  { value: 'visita_exitosa',          label: 'Visita Exitosa',      color: '#22c55e' },
  { value: 'cerrada',                 label: 'Cerrada',             color: '#f59e0b' },
  { value: 'cerrada_permanentemente', label: 'Cerrada Permanente',  color: '#ef4444' },
];

function toggleShopType(type) {
  const current = [...props.modelValue.shopTypes];
  const idx = current.indexOf(type);
  if (idx === -1) current.push(type);
  else current.splice(idx, 1);
  emit('update:modelValue', { ...props.modelValue, shopTypes: current });
}

function toggleSource(src) {
  const current = [...props.modelValue.sources];
  const idx = current.indexOf(src);
  if (idx === -1) current.push(src);
  else current.splice(idx, 1);
  emit('update:modelValue', { ...props.modelValue, sources: current });
}

function toggleVisitStatus(val) {
  const current = [...(props.modelValue.showVisitStatus ?? [])];
  const idx = current.indexOf(val);
  if (idx === -1) current.push(val); else current.splice(idx, 1);
  emit('update:modelValue', { ...props.modelValue, showVisitStatus: current });
}

function toggleVisitedStatus(val) {
  const current = [...(props.modelValue.showVisitedStatuses ?? [])];
  const idx = current.indexOf(val);
  if (idx === -1) current.push(val); else current.splice(idx, 1);
  emit('update:modelValue', { ...props.modelValue, showVisitedStatuses: current });
}

function setFilter(key, val) {
  emit('update:modelValue', { ...props.modelValue, [key]: val });
}

function resetFilters() {
  emit('update:modelValue', {
    viewMode:           'points',
    shopTypes:          ['Repair', 'Parts', 'Both', 'Other'],
    sources:            ['denue', 'google', 'both'],
    state:              '',
    minRating:          0,
    showVisitStatus:    ['visitada', 'no_visitada'],
    showVisitedStatuses:['visita_exitosa', 'cerrada', 'cerrada_permanentemente'],
  });
}
</script>

<style scoped>
.filter-panel {
  position: absolute;
  top: 0;
  right: 0;
  height: 100%;
  width: 260px;
  background: rgba(10, 15, 30, 0.92);
  backdrop-filter: blur(12px);
  border-left: 1px solid rgba(255,255,255,0.08);
  color: #e2e8f0;
  display: flex;
  flex-direction: row;
  z-index: 10;
  transition: width 0.2s ease;
}

.filter-panel.collapsed {
  width: 36px;
}

.collapse-btn {
  flex-shrink: 0;
  width: 36px;
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}
.collapse-btn:hover { color: #f1f5f9; }

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px 16px 16px 4px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.panel-title {
  font-size: 15px;
  font-weight: 700;
  color: #f1f5f9;
  margin: 0;
}

.reset-btn {
  font-size: 12px;
  color: #60a5fa;
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 6px;
}
.reset-btn:hover { text-decoration: underline; }

.stats-row {
  display: flex;
  gap: 12px;
  background: rgba(255,255,255,0.05);
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 8px;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}
.stat-number {
  font-size: 18px;
  font-weight: 700;
  color: #f1f5f9;
}
.stat-label {
  font-size: 11px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.filter-section {
  padding: 10px 0;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.filter-section:last-child { border-bottom: none; }

.section-label {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 8px;
}

.rating-val {
  color: #f59e0b;
  font-weight: 700;
  text-transform: none;
  letter-spacing: 0;
}

.toggle-group {
  display: flex;
  gap: 6px;
}

.toggle-btn {
  flex: 1;
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.05);
  color: #94a3b8;
  transition: all 0.15s;
}
.toggle-btn.active {
  background: #1d4ed8;
  border-color: #2563eb;
  color: #fff;
}

.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #cbd5e1;
  cursor: pointer;
}
.checkbox-item input { cursor: pointer; accent-color: #3b82f6; }

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.select-input {
  width: 100%;
  padding: 6px 10px;
  border-radius: 6px;
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.12);
  color: #e2e8f0;
  font-size: 13px;
  outline: none;
}
.select-input option { background: #1e293b; }

.range-input {
  width: 100%;
  accent-color: #3b82f6;
  cursor: pointer;
}

.range-labels {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #64748b;
  margin-top: 2px;
}

.legend-section { border-bottom: none; }

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #94a3b8;
  margin-bottom: 4px;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.compare-btn {
  background: rgba(139, 92, 246, 0.1) !important;
  border-color: rgba(139, 92, 246, 0.3) !important;
  color: #c4b5fd !important;
}
.compare-btn.active {
  background: #6d28d9 !important;
  border-color: #7c3aed !important;
  color: #fff !important;
}

.visited-mode-btn {
  display: flex !important;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: rgba(34, 197, 94, 0.08) !important;
  border-color: rgba(34, 197, 94, 0.25) !important;
  color: #86efac !important;
}
.visited-mode-btn.active {
  background: #15803d !important;
  border-color: #16a34a !important;
  color: #fff !important;
}

.legend-note {
  font-size: 11px;
  color: #475569;
  margin-top: 6px;
  line-height: 1.4;
}

@media (max-width: 640px) {
  .filter-panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    height: 100%;
    width: 85vw;
    max-width: 300px;
    z-index: 200;
    transform: translateX(100%);
    transition: transform 0.25s ease;
  }

  .filter-panel.mobile-open {
    transform: translateX(0);
  }

  /* Flip arrow to point right (→ close direction) on mobile */
  .collapse-btn {
    font-size: 18px;
    transform: scaleX(-1);
  }

  /* Larger touch targets for checkboxes */
  .checkbox-item {
    padding: 6px 0;
    font-size: 14px;
  }

  .toggle-btn {
    padding: 10px 8px;
    font-size: 13px;
  }

  .select-input {
    padding: 10px;
    font-size: 14px;
  }
}
</style>
