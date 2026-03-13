<template>
  <Transition name="panel-slide">
    <div v-if="shops && shops.length" class="hex-panel">
      <div class="panel-inner">
        <div class="panel-header">
          <div class="header-info">
            <span class="hex-icon">⬡</span>
            <div>
              <div class="panel-title">{{ shops.length }} tiendas en esta área</div>
              <div class="sort-row">
                Ordenar por:
                <button :class="{ active: sortKey === 'rating' }" @click="sortKey = 'rating'">Calificación</button>
                <button :class="{ active: sortKey === 'purchases' }" @click="sortKey = 'purchases'">Compras</button>
                <button :class="{ active: sortKey === 'name' }" @click="sortKey = 'name'">Nombre</button>
              </div>
            </div>
          </div>
          <button class="close-btn" @click="$emit('close')" title="Cerrar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div class="shop-list">
          <div
            v-for="shop in sortedShops"
            :key="shop.id || shop.name"
            class="shop-row"
            @click="$emit('select-shop', shop)"
          >
            <div class="row-main">
              <span class="type-dot" :class="typeClass(shop)"></span>
              <div class="row-text">
                <div class="row-name">{{ shop.name || shop.company_name || 'Tienda sin nombre' }}</div>
                <div class="row-sub">
                  <span v-if="shop.shop_type" class="row-type">{{ shop.shop_type }}</span>
                  <span v-if="shop.municipality || shop.state" class="row-loc">
                    {{ [shop.municipality, shop.state].filter(Boolean).join(', ') }}
                  </span>
                </div>
              </div>
            </div>
            <div class="row-right">
              <div v-if="shop.rating" class="row-rating">
                <span class="star-icon">★</span>
                <span>{{ shop.rating }}</span>
              </div>
              <div v-if="shop.purchases != null" class="row-purchases">
                🛒 {{ Number(shop.purchases).toLocaleString() }}
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="row-arrow">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  shops: { type: Array, default: null },
});

defineEmits(['close', 'select-shop']);

const sortKey = ref('rating');

const sortedShops = computed(() => {
  if (!props.shops) return [];
  return [...props.shops].sort((a, b) => {
    if (sortKey.value === 'rating') return (b.rating ?? 0) - (a.rating ?? 0);
    if (sortKey.value === 'purchases') return (b.purchases ?? 0) - (a.purchases ?? 0);
    if (sortKey.value === 'name') return (a.name ?? '').localeCompare(b.name ?? '');
    return 0;
  });
});

function typeClass(shop) {
  const map = { Repair: 'dot-repair', Parts: 'dot-parts', Both: 'dot-both' };
  return map[shop.shop_type] ?? 'dot-other';
}
</script>

<style scoped>
.hex-panel {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 360px;
  z-index: 50;
  display: flex;
  flex-direction: column;
}

.panel-inner {
  height: 100%;
  overflow-y: auto;
  background: rgba(10, 15, 30, 0.97);
  border-left: 1px solid rgba(255,255,255,0.1);
  backdrop-filter: blur(16px);
  display: flex;
  flex-direction: column;
  color: #e2e8f0;
}

.panel-slide-enter-active,
.panel-slide-leave-active {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.panel-slide-enter-from,
.panel-slide-leave-to {
  transform: translateX(100%);
}

.panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 18px 18px 14px;
  border-bottom: 1px solid rgba(255,255,255,0.07);
  gap: 10px;
  flex-shrink: 0;
}

.header-info {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.hex-icon {
  font-size: 22px;
  color: #f59e0b;
  margin-top: 2px;
  line-height: 1;
}

.panel-title {
  font-size: 15px;
  font-weight: 700;
  color: #f1f5f9;
  margin-bottom: 6px;
}

.sort-row {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #475569;
}

.sort-row button {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.08);
  color: #64748b;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 99px;
  cursor: pointer;
  transition: all 0.15s;
}
.sort-row button.active,
.sort-row button:hover {
  background: rgba(59,130,246,0.2);
  border-color: rgba(59,130,246,0.3);
  color: #93c5fd;
}

.close-btn {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 6px;
  color: #64748b;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}
.close-btn:hover { background: rgba(255,255,255,0.12); color: #f1f5f9; }

.shop-list {
  overflow-y: auto;
  flex: 1;
  padding: 8px 0;
}

.shop-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 18px;
  cursor: pointer;
  transition: background 0.12s;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.shop-row:hover { background: rgba(255,255,255,0.05); }

.row-main {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.type-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 4px;
}
.dot-repair { background: #3b82f6; }
.dot-parts  { background: #f59e0b; }
.dot-both   { background: #10b981; }
.dot-other  { background: #6b7280; }

.row-text {
  flex: 1;
  min-width: 0;
}

.row-name {
  font-size: 13px;
  font-weight: 600;
  color: #f1f5f9;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.row-sub {
  display: flex;
  gap: 6px;
  margin-top: 2px;
  flex-wrap: wrap;
}

.row-type {
  font-size: 11px;
  color: #64748b;
}

.row-loc {
  font-size: 11px;
  color: #475569;
}

.row-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
  flex-shrink: 0;
  margin-left: 8px;
}

.row-rating {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 12px;
  font-weight: 700;
  color: #f59e0b;
}
.star-icon { font-size: 11px; }

.row-purchases {
  font-size: 11px;
  color: #60a5fa;
}

.row-arrow {
  color: #334155;
  margin-top: 2px;
}

@media (max-width: 640px) {
  .hex-panel {
    width: 100%;
    left: 0;
  }

  .close-btn {
    width: 44px;
    height: 44px;
  }
}
</style>
