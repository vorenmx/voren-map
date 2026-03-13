<template>
  <Transition name="panel-slide">
    <div v-if="shop" class="detail-panel" @click.self="$emit('close')">
      <div class="panel-inner">
        <!-- Header -->
        <div class="panel-header">
          <div class="header-badges">
            <span class="type-badge" :class="typeClass">{{ shop.shop_type || 'Desconocido' }}</span>
            <span v-if="shop.source" class="source-badge">{{ sourceLabel }}</span>
          </div>
          <button class="close-btn" @click="$emit('close')" title="Cerrar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <h2 class="shop-name">{{ shop.name || shop.company_name || 'Tienda sin nombre' }}</h2>
        <p v-if="shop.company_name && shop.name && shop.company_name !== shop.name" class="company-name">
          {{ shop.company_name }}
        </p>

        <!-- Rating -->
        <div v-if="shop.rating" class="rating-row">
          <div class="stars">
            <span v-for="i in 5" :key="i" class="star" :class="{ filled: i <= Math.round(shop.rating) }">★</span>
          </div>
          <span class="rating-val">{{ shop.rating }}</span>
          <span class="review-count">({{ shop.review_count?.toLocaleString() || 0 }} reseñas)</span>
        </div>

        <div class="divider"></div>

        <!-- Contact & Location -->
        <div class="section">
          <div class="section-title">Ubicación y Contacto</div>

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

        <!-- Business info (without hours) -->
        <div v-if="shop.business_status || shop.employee_range || shop.scian_description" class="section">
          <div class="section-title">Información del Negocio</div>

          <div v-if="shop.business_status" class="field-row">
            <span class="status-dot" :class="shop.business_status === 'OPERATIONAL' ? 'green' : 'red'"></span>
            <span class="field-val">{{ shop.business_status === 'OPERATIONAL' ? 'Operativo' : shop.business_status }}</span>
          </div>

          <div v-if="shop.employee_range" class="field-row">
            <span class="field-icon">👥</span>
            <span class="field-val">{{ shop.employee_range }}</span>
          </div>

          <div v-if="shop.scian_description" class="field-row">
            <span class="field-icon">🏷</span>
            <span class="field-val small">{{ shop.scian_description }}</span>
          </div>
        </div>

        <!-- Status Visita -->
        <div class="section">
          <div class="section-title">Status Visita</div>
          <div class="status-row">
            <button
              class="status-btn exitosa-btn"
              :class="{ 'exitosa-active': isVisitaExitosa }"
              :disabled="statusSaving"
              @click="handleStatusToggle('visita_exitosa')"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
              {{ statusSaving === 'visita_exitosa' ? 'Guardando…' : 'Exitosa' }}
            </button>
            <button
              class="status-btn cerrada-btn"
              :class="{ 'cerrada-active': isCerrada }"
              :disabled="statusSaving"
              @click="handleStatusToggle('cerrada')"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {{ statusSaving === 'cerrada' ? 'Guardando…' : 'Cerrada' }}
            </button>
            <button
              class="status-btn perm-btn"
              :class="{ 'perm-active': isCerradaPerm }"
              :disabled="statusSaving"
              @click="handleStatusToggle('cerrada_permanentemente')"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              {{ statusSaving === 'cerrada_permanentemente' ? 'Guardando…' : 'Cerrada Perm.' }}
            </button>
          </div>
        </div>

        <!-- Google Maps -->
        <div
          v-if="shop.google_maps_url || (shop.latitude && shop.longitude)"
          class="section"
        >
          <div class="section-title">Google Maps</div>
          <a
            :href="shop.google_maps_url || `https://www.google.com/maps?q=${shop.latitude},${shop.longitude}`"
            target="_blank"
            rel="noopener noreferrer"
            class="maps-link-btn"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
            Ver en Google Maps
          </a>
        </div>

        <!-- Evaluación de visita -->
        <div class="section survey-section">
          <div class="section-title">Evaluación</div>

          <!-- Scores 1-10 -->
          <div v-for="score in SURVEY_SCORES" :key="score.field" class="score-row">
            <span class="score-label">
              {{ score.label }}
              <button class="help-btn" @mouseenter="showTooltip(score.help, $event)" @mouseleave="hideTooltip" @click.stop="toggleTooltipClick(score.help, $event)">?</button>
            </span>
            <div class="score-btns">
              <button
                v-for="n in 10" :key="n"
                class="score-btn"
                :class="{ active: surveyData[score.field] === n }"
                :disabled="surveyingSaving"
                @click="handleSurveyField(score.field, surveyData[score.field] === n ? null : n)"
              >{{ n }}</button>
            </div>
          </div>

          <div class="survey-divider"></div>

          <!-- Tamaño tienda -->
          <div class="chip-row">
            <span class="score-label">
              Tamaño tienda
              <button class="help-btn" @mouseenter="showTooltip(TAMANO_HELP, $event)" @mouseleave="hideTooltip" @click.stop="toggleTooltipClick(TAMANO_HELP, $event)">?</button>
            </span>
            <div class="chip-group">
              <button
                v-for="opt in TAMANO_OPTS" :key="opt"
                class="chip-btn"
                :class="{ active: surveyData.tamano_tienda === opt }"
                :disabled="surveyingSaving"
                @click="handleSurveyField('tamano_tienda', surveyData.tamano_tienda === opt ? null : opt)"
              >{{ opt }}</button>
            </div>
          </div>

          <!-- Crédito -->
          <div class="chip-row">
            <span class="score-label">Crédito</span>
            <div class="chip-group">
              <button
                v-for="opt in CREDITO_OPTS" :key="opt"
                class="chip-btn"
                :class="{ active: surveyData.credito === opt }"
                :disabled="surveyingSaving"
                @click="handleSurveyField('credito', surveyData.credito === opt ? null : opt)"
              >{{ opt }}</button>
            </div>
          </div>

          <!-- Método de pago (multi) -->
          <div class="chip-row">
            <span class="score-label">Método de pago</span>
            <div class="chip-group">
              <button
                v-for="opt in PAGO_OPTS" :key="opt"
                class="chip-btn"
                :class="{ active: (surveyData.metodo_pago || []).includes(opt) }"
                :disabled="surveyingSaving"
                @click="handleMultiField('metodo_pago', opt)"
              >{{ opt }}</button>
            </div>
          </div>

          <!-- Entrega -->
          <div class="chip-row">
            <span class="score-label">Entrega</span>
            <div class="chip-group">
              <button
                v-for="opt in ENTREGA_OPTS" :key="opt"
                class="chip-btn"
                :class="{ active: surveyData.entrega === opt }"
                :disabled="surveyingSaving"
                @click="handleSurveyField('entrega', surveyData.entrega === opt ? null : opt)"
              >{{ opt }}</button>
            </div>
          </div>

          <!-- Principal proveedor -->
          <div class="chip-row">
            <span class="score-label">Proveedor principal</span>
            <div class="chip-group">
              <button
                v-for="opt in PROVEEDOR_OPTS" :key="opt"
                class="chip-btn"
                :class="{ active: surveyData.principal_proveedor === opt }"
                :disabled="surveyingSaving"
                @click="handleSurveyField('principal_proveedor', surveyData.principal_proveedor === opt ? null : opt)"
              >{{ opt }}</button>
            </div>
          </div>

          <!-- Contacto personal del tomador de decisión -->
          <div class="chip-row">
            <span class="score-label">El tomador de decisión nos dio su contacto personal</span>
            <div class="chip-group">
              <button
                v-for="opt in CONTACTO_OPTS" :key="opt"
                class="chip-btn"
                :class="{ active: surveyData.contacto_personal === opt }"
                :disabled="surveyingSaving"
                @click="handleSurveyField('contacto_personal', surveyData.contacto_personal === opt ? null : opt)"
              >{{ opt }}</button>
            </div>
          </div>

          <!-- Comentarios -->
          <div class="chip-row">
            <span class="score-label">Comentarios</span>
            <textarea
              class="comentarios-input"
              v-model="comentariosLocal"
              placeholder="Escribe tus comentarios aquí…"
              rows="3"
              @blur="handleComentariosBlur"
            ></textarea>
          </div>

          <div v-if="surveyingSaving" class="survey-saving">Guardando…</div>
        </div>

        <!-- Sales data -->
        <div v-if="shop.purchases != null || shop.average_order != null" class="section">
          <div class="section-title">Datos de Ventas</div>
          <div class="sales-grid">
            <div v-if="shop.purchases != null" class="sales-card blue">
              <div class="sales-val">{{ Number(shop.purchases).toLocaleString() }}</div>
              <div class="sales-label">Compras</div>
            </div>
            <div v-if="shop.average_order != null" class="sales-card amber">
              <div class="sales-val">${{ Number(shop.average_order).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</div>
              <div class="sales-label">Pedido Prom. MXN</div>
            </div>
          </div>
        </div>

        <!-- Activity Log -->
        <div v-if="activityLogs.length" class="section activity-section">
          <button class="activity-header" @click="logOpen = !logOpen">
            <span class="section-title" style="margin:0">Actividad</span>
            <span class="activity-count">{{ activityLogs.length }}</span>
            <svg class="chevron" :class="{ open: logOpen }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          <div v-if="logOpen" class="activity-list">
            <div v-for="entry in activityLogs" :key="entry.key" class="activity-entry">
              <span class="activity-icon" :class="entry.type">
                <svg v-if="entry.type === 'visited'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                <svg v-else-if="entry.type === 'closed'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <svg v-else-if="entry.type === 'perm_closed'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                <svg v-else-if="entry.type === 'survey'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </span>
              <div class="activity-body">
                <span class="activity-label">{{ entry.label }}</span>
                <span class="activity-time">{{ entry.timeStr }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Actions -->
      </div>
    </div>
  </Transition>

  <!-- Tooltip teleported to body to escape overflow clipping -->
  <Teleport to="body">
    <div
      v-if="tooltipVisible"
      class="sdp-tooltip-global"
      :style="{ left: tooltipX + 'px', top: tooltipY + 'px' }"
    >{{ tooltipText }}</div>
  </Teleport>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useVisited } from '../composables/useVisited.js';
import { useShopStatus } from '../composables/useShopStatus.js';

const props = defineProps({
  shop: { type: Object, default: null },
});

defineEmits(['close']);

// ── Survey constants ─────────────────────────────────────
const SURVEY_SCORES = [
  { field: 'score_general',      label: 'Score general',        help: '¿Qué tan productiva fue la visita? 10 es lo mejor' },
  { field: 'score_pains',        label: 'Pains',                help: '¿Qué tan fuertes son los pains del cliente? 10 es lo más fuerte' },
  { field: 'score_probabilidad', label: 'Prob. de venta',       help: '¿Qué tan probable es que nos compre? 10 es que nos compra seguro' },
  { field: 'score_satisfaccion', label: 'Satisf. proveedores',  help: '¿Qué tan satisfecho está con sus proveedores? 10 es máxima satisfacción' },
];
const TAMANO_OPTS    = ['Pequeña', 'Mediana', 'Grande', 'Muy grande'];
const TAMANO_HELP    = 'Pequeña: menos de 5 empleados · Mediana: 5–10 · Grande: 10–20 · Muy grande: más de 20';
const CREDITO_OPTS   = ['Sí', 'No'];
const PAGO_OPTS      = ['Efectivo', 'Tarjeta', 'Transferencia'];
const ENTREGA_OPTS   = ['Tienda física', 'Delivery'];
const CONTACTO_OPTS  = ['Sí', 'No'];
const PROVEEDOR_OPTS = [
  'Remo', 'Supermoto', 'Mudi Motos', 'Motometa', 'Moto Refacciones',
  'La Casa de la Moto', 'Refacciones Italika', 'Surtimoto',
  'Suzuki Motos Pro Shop', 'Rogmar', 'Motopartes Casa', 'Windsor Motopartes',
  'Sayto', 'Motos y Equipos', 'IMR', 'Palamoto', 'Remo Motos México',
];

const SURVEY_LABELS = {
  score_general:      'Score general',
  score_pains:        'Pains',
  score_probabilidad: 'Prob. de venta',
  score_satisfaccion: 'Satisf. proveedores',
  tamano_tienda:      'Tamaño tienda',
  credito:            'Crédito',
  metodo_pago:        'Método de pago',
  entrega:            'Entrega',
  principal_proveedor:'Proveedor principal',
  contacto_personal:  'Contacto personal del tomador de decisión',
  comentarios:        'Comentarios',
};

const { visitedIds, visitedStatusMap, visitedShops, setExclusiveStatus, updateSurvey } = useVisited();
const { statusDocs } = useShopStatus();

const statusSaving      = ref(null); // null | 'visita_exitosa' | 'cerrada' | 'cerrada_permanentemente'
const surveyingSaving   = ref(false);
const logOpen           = ref(false);
const tooltipVisible    = ref(false);
const tooltipText       = ref('');
const tooltipX          = ref(0);
const tooltipY          = ref(0);
const comentariosLocal  = ref('');

function showTooltip(text, event) {
  const rect = event.currentTarget.getBoundingClientRect();
  tooltipText.value    = text;
  tooltipX.value       = Math.max(8, rect.left - 210 + rect.width / 2);
  tooltipY.value       = rect.top - 8; // will be shifted up via CSS transform
  tooltipVisible.value = true;
}
function hideTooltip() {
  tooltipVisible.value = false;
}
function toggleTooltipClick(text, event) {
  if (tooltipVisible.value && tooltipText.value === text) {
    hideTooltip();
  } else {
    showTooltip(text, event);
  }
}

// Close tooltip when switching shops (comentarios watch is below visitedEntry declaration)
watch(() => props.shop?.id, () => { tooltipVisible.value = false; });

const isVisited        = computed(() => props.shop?.id && visitedIds.value.has(props.shop.id));
const currentVStatus   = computed(() => props.shop?.id ? (visitedStatusMap.value.get(props.shop.id) ?? null) : null);
const isVisitaExitosa  = computed(() => currentVStatus.value === 'visita_exitosa');
const isCerrada        = computed(() => currentVStatus.value === 'cerrada');
const isCerradaPerm    = computed(() => currentVStatus.value === 'cerrada_permanentemente');

const visitedEntry = computed(() =>
  props.shop?.id ? visitedShops.value.find((s) => s.id === props.shop.id) : null
);

// Reactive survey values for the current shop
const surveyData = computed(() => visitedEntry.value ?? {});

async function handleSurveyField(field, value) {
  if (!props.shop?.id || surveyingSaving.value) return;
  surveyingSaving.value = true;
  try {
    await updateSurvey(props.shop.id, field, value);
  } finally {
    surveyingSaving.value = false;
  }
}

async function handleMultiField(field, option) {
  if (!props.shop?.id || surveyingSaving.value) return;
  const current = Array.isArray(surveyData.value[field]) ? [...surveyData.value[field]] : [];
  const idx = current.indexOf(option);
  if (idx === -1) current.push(option);
  else current.splice(idx, 1);
  surveyingSaving.value = true;
  try {
    await updateSurvey(props.shop.id, field, current);
  } finally {
    surveyingSaving.value = false;
  }
}
async function handleStatusToggle(visitedStatus) {
  if (!props.shop?.id || statusSaving.value) return;
  statusSaving.value = visitedStatus;
  try { await setExclusiveStatus(props.shop, visitedStatus); } finally { statusSaving.value = null; }
}

function formatTs(ts) {
  if (!ts) return null;
  const date = typeof ts.toDate === 'function' ? ts.toDate() : (ts instanceof Date ? ts : null);
  if (!date) return null;
  return new Intl.DateTimeFormat('en-MX', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(date);
}

const activityLogs = computed(() => {
  const entries = [];
  const entry = visitedEntry.value;

  const visitedTs = formatTs(entry?.visitedAt);
  const statusTs  = formatTs(entry?.statusAt);

  if (visitedTs) entries.push({ key: 'visited', type: 'visited', label: 'Primera visita registrada', timeStr: visitedTs });

  if (statusTs) {
    const vs = entry?.visited_status;
    if (vs === 'visita_exitosa')         entries.push({ key: 'vs_exitosa',   type: 'visited',    label: 'Visita exitosa',                timeStr: statusTs });
    if (vs === 'cerrada')                entries.push({ key: 'vs_cerrada',   type: 'closed',     label: 'Marcada como cerrada',          timeStr: statusTs });
    if (vs === 'cerrada_permanentemente')entries.push({ key: 'vs_perm',      type: 'perm_closed',label: 'Marcada como cerrada permanente',timeStr: statusTs });
  }

  // Survey log entries (newest first within activity)
  const surveyLog = visitedEntry.value?.surveyLog;
  if (Array.isArray(surveyLog)) {
    surveyLog.forEach((entry, i) => {
      const label = SURVEY_LABELS[entry.field] ?? entry.field;
      const val = Array.isArray(entry.value) ? entry.value.join(', ') : (entry.value ?? '—');
      const timeStr = entry.ts ? new Intl.DateTimeFormat('es-MX', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      }).format(new Date(entry.ts)) : null;
      if (timeStr) {
        entries.push({ key: `survey-${i}`, type: 'survey', label: `${label}: ${val}`, timeStr });
      }
    });
  }

  return entries;
});

watch(() => props.shop?.id, () => {
  logOpen.value = false;
  comentariosLocal.value = visitedEntry.value?.comentarios ?? '';
});

watch(visitedEntry, (entry) => {
  comentariosLocal.value = entry?.comentarios ?? '';
}, { immediate: true });

async function handleComentariosBlur() {
  const saved = visitedEntry.value?.comentarios ?? '';
  if (comentariosLocal.value === saved) return;
  await updateSurvey(props.shop.id, 'comentarios', comentariosLocal.value);
}

const typeClass = computed(() => {
  const map = { Repair: 'type-repair', Parts: 'type-parts', Both: 'type-both', Other: 'type-other' };
  return map[props.shop?.shop_type] ?? 'type-other';
});

const sourceLabel = computed(() => {
  const map = { denue: 'DENUE', google: 'Google', both: 'Ambas fuentes' };
  return map[props.shop?.source] ?? props.shop?.source ?? '';
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
  overflow-x: visible;
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

/* Status row — 2×2 grid */
.status-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 10px;
  margin-top: 10px;
}

.status-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  padding: 13px 10px;
  min-height: 44px;
  border-radius: 8px;
  /* neutral / unselected */
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.10);
  color: #64748b;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
  white-space: nowrap;
  touch-action: manipulation;
  user-select: none;
  -webkit-user-select: none;
}
.status-btn:disabled { opacity: 0.5; cursor: default; }

/* Visita Exitosa — green */
.exitosa-btn:hover:not(:disabled) {
  background: rgba(34,197,94,0.1);
  border-color: rgba(34,197,94,0.35);
  color: #86efac;
}
.exitosa-btn.exitosa-active,
.exitosa-btn.exitosa-active:hover:not(:disabled) {
  background: rgba(34,197,94,0.18);
  border-color: rgba(34,197,94,0.55);
  color: #4ade80;
}

/* Cerrada — amber */
.cerrada-btn:hover:not(:disabled) {
  background: rgba(245,158,11,0.1);
  border-color: rgba(245,158,11,0.35);
  color: #fcd34d;
}
.cerrada-btn.cerrada-active,
.cerrada-btn.cerrada-active:hover:not(:disabled) {
  background: rgba(245,158,11,0.18);
  border-color: rgba(245,158,11,0.55);
  color: #fbbf24;
}

/* Google Maps link button */
.maps-link-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  text-decoration: none;
  color: #93c5fd;
  font-size: 13px;
  font-weight: 500;
  padding: 9px 14px;
  border-radius: 8px;
  border: 1px solid rgba(59,130,246,0.30);
  background: rgba(59,130,246,0.08);
  transition: background 0.15s, border-color 0.15s;
}
.maps-link-btn:hover {
  background: rgba(59,130,246,0.18);
  border-color: rgba(59,130,246,0.55);
}

/* Cerrada Permanentemente — red */
.perm-btn:hover:not(:disabled) {
  background: rgba(239,68,68,0.1);
  border-color: rgba(239,68,68,0.35);
  color: #fca5a5;
}
.perm-btn.perm-active,
.perm-btn.perm-active:hover:not(:disabled) {
  background: rgba(239,68,68,0.18);
  border-color: rgba(239,68,68,0.55);
  color: #f87171;
}

/* ── Activity Log ──────────────────────────────────────── */
.activity-section {
  padding-bottom: 4px;
}

.activity-header {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 0;
  color: inherit;
}
.activity-header:hover .section-title { color: #94a3b8; }

.activity-count {
  font-size: 11px;
  font-weight: 600;
  background: rgba(99,179,237,0.15);
  color: #60a5fa;
  border-radius: 99px;
  padding: 1px 7px;
  line-height: 1.6;
}

.chevron {
  margin-left: auto;
  color: #475569;
  transition: transform 0.2s;
  flex-shrink: 0;
}
.chevron.open { transform: rotate(180deg); }

.activity-list {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.activity-entry {
  display: flex;
  align-items: flex-start;
  gap: 9px;
}

.activity-icon {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 1px;
}
.activity-icon.visited {
  background: rgba(34,197,94,0.15);
  color: #4ade80;
}
.activity-icon.closed {
  background: rgba(245,158,11,0.15);
  color: #fbbf24;
}
.activity-icon.perm_closed {
  background: rgba(239,68,68,0.15);
  color: #f87171;
}
.activity-icon.survey {
  background: rgba(99,179,237,0.15);
  color: #60a5fa;
}

/* ── Survey / Evaluación ──────────────────────────────── */
.survey-section {
  background: rgba(255,255,255,0.02);
  border-radius: 8px;
  padding: 12px !important;
  border: 1px solid rgba(255,255,255,0.06) !important;
}

.score-row {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-bottom: 10px;
}

.score-label {
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  display: flex;
  align-items: center;
  gap: 5px;
}

/* ── Help button ── */
.help-btn {
  width: 15px;
  height: 15px;
  border-radius: 50%;
  border: 1px solid rgba(148,163,184,0.35);
  background: rgba(255,255,255,0.04);
  color: #64748b;
  font-size: 9px;
  font-weight: 700;
  cursor: pointer;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.12s;
  font-family: inherit;
  text-transform: none;
  letter-spacing: 0;
  touch-action: manipulation;
}
.help-btn:hover {
  border-color: #60a5fa;
  color: #93c5fd;
  background: rgba(96,165,250,0.1);
}

.score-btns {
  display: flex;
  gap: 3px;
  flex-wrap: wrap;
}

.score-btn {
  width: 28px;
  height: 28px;
  border-radius: 5px;
  font-size: 11px;
  font-weight: 600;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.05);
  color: #64748b;
  cursor: pointer;
  transition: all 0.12s;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.score-btn:hover:not(:disabled) {
  background: rgba(99,179,237,0.15);
  border-color: rgba(99,179,237,0.3);
  color: #93c5fd;
}
.score-btn.active {
  background: #1d4ed8;
  border-color: #3b82f6;
  color: #fff;
}
.score-btn:disabled { opacity: 0.4; cursor: default; }

.survey-divider {
  height: 1px;
  background: rgba(255,255,255,0.07);
  margin: 10px 0;
}

.chip-row {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-bottom: 10px;
}

.chip-group {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
}

.chip-btn {
  padding: 4px 10px;
  border-radius: 99px;
  font-size: 11px;
  font-weight: 500;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.05);
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.12s;
  white-space: nowrap;
}
.chip-btn:hover:not(:disabled) {
  background: rgba(99,179,237,0.12);
  border-color: rgba(99,179,237,0.3);
  color: #93c5fd;
}
.chip-btn.active {
  background: rgba(59,130,246,0.2);
  border-color: #3b82f6;
  color: #93c5fd;
}
.chip-btn:disabled { opacity: 0.4; cursor: default; }

.comentarios-input {
  width: 100%;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 7px;
  color: #e2e8f0;
  font-size: 12px;
  font-family: inherit;
  line-height: 1.5;
  padding: 8px 10px;
  resize: vertical;
  min-height: 64px;
  box-sizing: border-box;
  transition: border-color 0.15s;
}
.comentarios-input::placeholder { color: #475569; }
.comentarios-input:focus {
  outline: none;
  border-color: rgba(99,179,237,0.4);
}

.survey-saving {
  font-size: 11px;
  color: #475569;
  text-align: right;
  margin-top: 4px;
  font-style: italic;
}

.activity-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.activity-label {
  font-size: 12px;
  color: #cbd5e1;
  font-weight: 500;
}

.activity-time {
  font-size: 11px;
  color: #475569;
}

@media (max-width: 640px) {
  .detail-panel {
    width: 100%;
    left: 0;
  }

  .close-btn {
    width: 44px;
    height: 44px;
  }

  .action-btn {
    padding: 14px;
    font-size: 14px;
  }
}
</style>

<style>
/* Global — not scoped so Teleport renders it outside the component */
.sdp-tooltip-global {
  position: fixed;
  transform: translateY(-100%);
  background: #1e293b;
  border: 1px solid rgba(255,255,255,0.14);
  color: #cbd5e1;
  font-size: 11px;
  font-weight: 400;
  line-height: 1.55;
  padding: 8px 11px;
  border-radius: 8px;
  width: 220px;
  white-space: normal;
  z-index: 9999;
  pointer-events: none;
  box-shadow: 0 6px 18px rgba(0,0,0,0.5);
}
</style>
