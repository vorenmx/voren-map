<template>
  <Transition name="panel-slide">
    <div v-if="shop" class="detail-panel" @click.self="$emit('close')">
      <div class="panel-inner">
        <!-- Header -->
        <div class="panel-header">
          <div class="header-badges">
            <span class="type-badge" :class="typeClass">{{ shop.shop_type || 'Unknown' }}</span>
            <span v-if="shop.source" class="source-badge">{{ sourceLabel }}</span>
          </div>
          <button class="close-btn" @click="$emit('close')" title="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <h2 class="shop-name">{{ shop.name || shop.company_name || 'Unnamed Shop' }}</h2>
        <p v-if="shop.company_name && shop.name && shop.company_name !== shop.name" class="company-name">
          {{ shop.company_name }}
        </p>

        <!-- Rating -->
        <div v-if="shop.rating" class="rating-row">
          <div class="stars">
            <span v-for="i in 5" :key="i" class="star" :class="{ filled: i <= Math.round(shop.rating) }">★</span>
          </div>
          <span class="rating-val">{{ shop.rating }}</span>
          <span class="review-count">({{ shop.review_count?.toLocaleString() || 0 }} reviews)</span>
        </div>

        <div class="divider"></div>

        <!-- Contact & Location -->
        <div class="section">
          <div class="section-title">Location & Contact</div>

          <div v-if="shop.formatted_address" class="field-row">
            <span class="field-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
            </span>
            <span class="field-val">{{ shop.formatted_address }}</span>
          </div>

          <div v-else-if="shop.street" class="field-row">
            <span class="field-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
            </span>
            <span class="field-val">
              {{ [shop.street, shop.street_number, shop.neighborhood, shop.municipality, shop.state].filter(Boolean).join(', ') }}
            </span>
          </div>

          <a v-if="shop.phone" :href="`tel:${shop.phone}`" class="field-row field-link">
            <span class="field-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8a19.79 19.79 0 01-3.07-8.67A2 2 0 012 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.96a16 16 0 006.13 6.13l1.32-1.32a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
            </span>
            <span class="field-val">{{ shop.phone }}</span>
          </a>

          <a v-if="shop.email" :href="`mailto:${shop.email}`" class="field-row field-link">
            <span class="field-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            </span>
            <span class="field-val">{{ shop.email }}</span>
          </a>

          <a v-if="shop.website" :href="shop.website" target="_blank" rel="noopener noreferrer" class="field-row field-link">
            <span class="field-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
            </span>
            <span class="field-val truncate">{{ shop.website.replace(/^https?:\/\//, '') }}</span>
          </a>
        </div>

        <!-- Business info -->
        <div v-if="shop.business_hours || shop.business_status || shop.employee_range" class="section">
          <div class="section-title">Business Info</div>

          <div v-if="shop.business_status" class="field-row">
            <span class="status-dot" :class="shop.business_status === 'OPERATIONAL' ? 'green' : 'red'"></span>
            <span class="field-val">{{ shop.business_status === 'OPERATIONAL' ? 'Operational' : shop.business_status }}</span>
          </div>

          <div v-if="shop.employee_range" class="field-row">
            <span class="field-icon">👥</span>
            <span class="field-val">{{ shop.employee_range }}</span>
          </div>

          <div v-if="shop.scian_description" class="field-row">
            <span class="field-icon">🏷</span>
            <span class="field-val small">{{ shop.scian_description }}</span>
          </div>

          <div v-if="shop.business_hours" class="hours-block">
            <div class="hours-title">Hours</div>
            <div v-for="line in hoursLines" :key="line" class="hours-line">{{ line }}</div>
          </div>
        </div>

        <!-- Sales data -->
        <div v-if="shop.purchases != null || shop.average_order != null" class="section">
          <div class="section-title">Sales Data</div>
          <div class="sales-grid">
            <div v-if="shop.purchases != null" class="sales-card blue">
              <div class="sales-val">{{ Number(shop.purchases).toLocaleString() }}</div>
              <div class="sales-label">Purchases</div>
            </div>
            <div v-if="shop.average_order != null" class="sales-card amber">
              <div class="sales-val">${{ Number(shop.average_order).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</div>
              <div class="sales-label">Avg. Order MXN</div>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="panel-actions">
          <!-- Visited toggle -->
          <button
            class="action-btn visited-btn"
            :class="{ 'visited-active': isVisited }"
            :disabled="saving"
            @click="handleVisitedToggle"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path v-if="isVisited" d="M20 6L9 17l-5-5" />
              <circle v-else cx="12" cy="12" r="10" />
            </svg>
            {{ saving ? 'Saving…' : isVisited ? 'Visited' : 'Mark as Visited' }}
          </button>

          <a
            v-if="shop.google_maps_url"
            :href="shop.google_maps_url"
            target="_blank"
            rel="noopener noreferrer"
            class="action-btn primary"
          >
            View on Google Maps
          </a>
          <a
            v-else-if="shop.latitude && shop.longitude"
            :href="`https://www.google.com/maps?q=${shop.latitude},${shop.longitude}`"
            target="_blank"
            rel="noopener noreferrer"
            class="action-btn primary"
          >
            View on Google Maps
          </a>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useVisited } from '../composables/useVisited.js';

const props = defineProps({
  shop: { type: Object, default: null },
});

defineEmits(['close']);

const { visitedIds, toggleVisited } = useVisited();
const saving = ref(false);

const isVisited = computed(() => props.shop?.id && visitedIds.value.has(props.shop.id));

async function handleVisitedToggle() {
  if (!props.shop?.id || saving.value) return;
  saving.value = true;
  try {
    await toggleVisited(props.shop);
  } finally {
    saving.value = false;
  }
}

const typeClass = computed(() => {
  const map = { Repair: 'type-repair', Parts: 'type-parts', Both: 'type-both', Other: 'type-other' };
  return map[props.shop?.shop_type] ?? 'type-other';
});

const sourceLabel = computed(() => {
  const map = { denue: 'DENUE', google: 'Google', both: 'Both sources' };
  return map[props.shop?.source] ?? props.shop?.source ?? '';
});

const hoursLines = computed(() => {
  if (!props.shop?.business_hours) return [];
  return props.shop.business_hours.split(' | ');
});
</script>

<style scoped>
.detail-panel {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 380px;
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
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 0;
  color: #e2e8f0;
  font-size: 13px;
}

/* Slide-in animation */
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
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.header-badges {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.type-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 10px;
  border-radius: 99px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.type-repair  { background: rgba(59,130,246,0.2);  color: #93c5fd; }
.type-parts   { background: rgba(245,158,11,0.2);  color: #fcd34d; }
.type-both    { background: rgba(16,185,129,0.2);  color: #6ee7b7; }
.type-other   { background: rgba(156,163,175,0.15); color: #9ca3af; }

.source-badge {
  font-size: 11px;
  font-weight: 500;
  padding: 2px 10px;
  border-radius: 99px;
  background: rgba(255,255,255,0.08);
  color: #64748b;
}

.close-btn {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 6px;
  color: #64748b;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}
.close-btn:hover { background: rgba(255,255,255,0.12); color: #f1f5f9; }

.shop-name {
  font-size: 18px;
  font-weight: 700;
  color: #f8fafc;
  margin: 0 0 4px;
  line-height: 1.3;
}

.company-name {
  font-size: 12px;
  color: #64748b;
  margin: 0 0 8px;
}

.rating-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
}

.stars { display: flex; gap: 2px; }
.star { color: #374151; font-size: 14px; }
.star.filled { color: #f59e0b; }

.rating-val {
  font-size: 14px;
  font-weight: 700;
  color: #f59e0b;
}

.review-count {
  font-size: 12px;
  color: #64748b;
}

.divider {
  height: 1px;
  background: rgba(255,255,255,0.07);
  margin: 16px 0;
}

.section {
  margin-bottom: 16px;
}

.section-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #475569;
  margin-bottom: 10px;
}

.field-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 8px;
  text-decoration: none;
  color: #cbd5e1;
}

.field-link { color: #60a5fa; }
.field-link:hover { color: #93c5fd; }

.field-icon {
  flex-shrink: 0;
  width: 16px;
  color: #475569;
  margin-top: 1px;
}

.field-val {
  flex: 1;
  line-height: 1.4;
}
.field-val.small { font-size: 12px; color: #64748b; }
.field-val.truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 3px;
}
.status-dot.green { background: #22c55e; }
.status-dot.red   { background: #ef4444; }

.hours-block {
  background: rgba(255,255,255,0.04);
  border-radius: 8px;
  padding: 10px 12px;
  margin-top: 6px;
}

.hours-title {
  font-size: 11px;
  font-weight: 600;
  color: #475569;
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.hours-line {
  font-size: 12px;
  color: #94a3b8;
  margin-bottom: 3px;
  line-height: 1.4;
}

.sales-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.sales-card {
  border-radius: 10px;
  padding: 12px;
  text-align: center;
}
.sales-card.blue  { background: rgba(59,130,246,0.12); border: 1px solid rgba(59,130,246,0.2); }
.sales-card.amber { background: rgba(245,158,11,0.12); border: 1px solid rgba(245,158,11,0.2); }

.sales-val {
  font-size: 16px;
  font-weight: 700;
  color: #f1f5f9;
  margin-bottom: 2px;
}
.sales-card.blue  .sales-val { color: #93c5fd; }
.sales-card.amber .sales-val { color: #fcd34d; }

.sales-label {
  font-size: 11px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.panel-actions {
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid rgba(255,255,255,0.07);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.action-btn {
  display: block;
  text-align: center;
  padding: 10px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.15s;
}

.action-btn.primary {
  background: #1d4ed8;
  color: #fff;
  border: 1px solid #2563eb;
}
.action-btn.primary:hover {
  background: #2563eb;
}

.visited-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  background: rgba(255,255,255,0.05);
  color: #94a3b8;
  border: 1px solid rgba(255,255,255,0.12);
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.15s;
}
.visited-btn:hover:not(:disabled) {
  background: rgba(34,197,94,0.1);
  border-color: rgba(34,197,94,0.3);
  color: #86efac;
}
.visited-btn.visited-active {
  background: rgba(34,197,94,0.15);
  border-color: rgba(34,197,94,0.4);
  color: #4ade80;
}
.visited-btn.visited-active:hover:not(:disabled) {
  background: rgba(239,68,68,0.1);
  border-color: rgba(239,68,68,0.3);
  color: #fca5a5;
}
.visited-btn:disabled {
  opacity: 0.5;
  cursor: default;
}
</style>
