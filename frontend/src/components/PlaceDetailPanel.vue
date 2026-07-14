<template>
  <Transition name="panel-slide">
    <div v-if="place" class="detail-panel">
      <div class="panel-inner">
        <!-- Header -->
        <div class="panel-header">
          <div class="header-badge">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
            Ubicación
          </div>
          <button class="close-btn" @click="$emit('close')" title="Cerrar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <h2 class="place-name">{{ place.name || place.formatted_address || 'Ubicación' }}</h2>
        <p v-if="place.formatted_address && place.name && place.formatted_address !== place.name" class="place-address">
          {{ place.formatted_address }}
        </p>
        <p v-else-if="!place.name && place.formatted_address" class="place-address">{{ place.formatted_address }}</p>

        <div class="coords-row">
          <span class="coord-icon">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
          </span>
          <span class="coord-text">{{ place.lat?.toFixed(5) }}, {{ place.lng?.toFixed(5) }}</span>
        </div>

        <div class="divider"></div>

        <!-- Category Selection -->
        <div class="section">
          <div class="section-title">Tipo de Lugar</div>
          <div class="category-grid">
            <button
              class="cat-tile"
              :class="{ 'active-importance': selectedCategory === 'importance' }"
              @click="selectedCategory = 'importance'"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              <span>Importancia</span>
            </button>
            <button
              class="cat-tile"
              :class="{ 'active-competitor': selectedCategory === 'competitor' }"
              @click="selectedCategory = 'competitor'"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
                <line x1="4" y1="22" x2="4" y2="15"/>
              </svg>
              <span>Competidor</span>
            </button>
            <button
              class="cat-tile"
              :class="{ 'active-warehouse': selectedCategory === 'warehouse' }"
              @click="selectedCategory = 'warehouse'"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="16.5" y1="9.4" x2="7.55" y2="4.24"/>
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                <line x1="12" y1="22.08" x2="12" y2="12"/>
              </svg>
              <span>Almacén</span>
            </button>
          </div>
        </div>

        <!-- Custom Name -->
        <div class="section">
          <div class="section-title">Nombre Personalizado</div>
          <input
            v-model="customName"
            class="name-input"
            type="text"
            placeholder="Nombre personalizado (opcional)"
          />
        </div>

        <!-- Description -->
        <div class="section">
          <div class="section-title">Descripción</div>
          <textarea
            v-model="description"
            class="desc-input"
            placeholder="Agregar una descripción sobre este lugar…"
            rows="3"
          ></textarea>
        </div>

        <!-- Saved info collapsible log -->
        <div v-if="savedEntry" class="section activity-section">
          <button class="activity-header" @click="logOpen = !logOpen">
            <span class="saved-emoji-sm">{{ savedCategoryEmoji }}</span>
            <span class="section-title" style="margin:0">{{ savedCategoryLabel }}</span>
            <span class="activity-count">Guardado</span>
            <svg class="chevron" :class="{ open: logOpen }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          <div v-if="logOpen" class="activity-list">
            <div class="activity-entry">
              <span class="activity-icon log-date">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </span>
              <div class="activity-text">
                <span class="activity-label">Guardado el</span>
                <span class="activity-time">{{ savedTimeLabel || 'Hoy' }}</span>
              </div>
            </div>
            <div v-if="savedEntry.customName" class="activity-entry">
              <span class="activity-icon log-name">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </span>
              <div class="activity-text">
                <span class="activity-label">Nombre</span>
                <span class="activity-time">{{ savedEntry.customName }}</span>
              </div>
            </div>
            <div v-if="savedEntry.description" class="activity-entry">
              <span class="activity-icon log-desc">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              </span>
              <div class="activity-text">
                <span class="activity-label">Descripción</span>
                <span class="activity-time">{{ savedEntry.description }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="panel-actions">
          <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
          <!-- Save / unsave button -->
          <button
            class="action-btn save-btn"
            :class="saveBtnClass"
            :disabled="saving"
            @click="handleSaveToggle"
          >
            <!-- Importance: star -->
            <svg v-if="activeCategoryKey === 'importance'" width="16" height="16" viewBox="0 0 24 24"
              :fill="savedEntry ? 'currentColor' : 'none'"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            <!-- Competitor: flag -->
            <svg v-else-if="activeCategoryKey === 'competitor'" width="16" height="16" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
              <line x1="4" y1="22" x2="4" y2="15"/>
            </svg>
            <!-- Warehouse: package -->
            <svg v-else width="16" height="16" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="16.5" y1="9.4" x2="7.55" y2="4.24"/>
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
              <line x1="12" y1="22.08" x2="12" y2="12"/>
            </svg>
            {{ saving ? 'Guardando…' : savedEntry ? 'Guardado' : 'Guardar Lugar' }}
          </button>

          <!-- Update if already saved and something changed -->
          <button
            v-if="savedEntry && hasChanges"
            class="action-btn update-btn"
            :disabled="saving"
            @click="handleUpdatePlace"
          >
            Actualizar
          </button>

          <a
            :href="`https://www.google.com/maps?q=${place.lat},${place.lng}`"
            target="_blank"
            rel="noopener noreferrer"
            class="maps-link-btn"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
            Abrir en Google Maps
          </a>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useSavedPlaces } from '../composables/useSavedPlaces.js';

const props = defineProps({
  place: { type: Object, default: null },
});

defineEmits(['close']);

const { getSaved, savePlace, deletePlace, updatePlace } = useSavedPlaces();

const description = ref('');
const selectedCategory = ref('importance');
const customName = ref('');
const saving = ref(false);
const logOpen = ref(false);
const errorMsg = ref('');

const savedEntry = computed(() => props.place ? getSaved(props.place) : null);

// The active category key: uses saved entry's category when place is already saved
const activeCategoryKey = computed(() => savedEntry.value?.category || selectedCategory.value);

const hasChanges = computed(() => {
  if (!savedEntry.value) return false;
  return (
    description.value !== (savedEntry.value.description ?? '') ||
    selectedCategory.value !== (savedEntry.value.category ?? 'importance') ||
    customName.value !== (savedEntry.value.customName ?? '')
  );
});

const savedCategoryEmoji = computed(() => {
  const cat = savedEntry.value?.category ?? 'importance';
  if (cat === 'competitor') return '🚩';
  if (cat === 'warehouse') return '📦';
  return '⭐';
});

const savedCategoryLabel = computed(() => {
  const cat = savedEntry.value?.category ?? 'importance';
  if (cat === 'competitor') return 'Competidor';
  if (cat === 'warehouse') return 'Almacén';
  return 'Lugar de Importancia';
});

const savedTimeLabel = computed(() => {
  const ts = savedEntry.value?.savedAt;
  if (!ts) return '';
  if (ts?.toDate) return ts.toDate().toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
  const d = new Date(ts);
  if (isNaN(d.getTime())) return 'Hoy';
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
});

const saveBtnClass = computed(() => {
  const cat = activeCategoryKey.value;
  if (savedEntry.value) return `save-active-${cat}`;
  return `save-inactive-${cat}`;
});

// Sync all fields when panel opens or switches to a different place
watch(
  () => props.place,
  () => {
    description.value = savedEntry.value?.description ?? '';
    selectedCategory.value = savedEntry.value?.category ?? 'importance';
    customName.value = savedEntry.value?.customName ?? '';
    logOpen.value = false;
    errorMsg.value = '';
  },
  { immediate: true }
);

// Sync if savedEntry appears right after saving
watch(savedEntry, (entry) => {
  if (entry) {
    if (!description.value) description.value = entry.description ?? '';
    selectedCategory.value = entry.category ?? 'importance';
    if (!customName.value) customName.value = entry.customName ?? '';
  }
});

async function handleSaveToggle() {
  if (!props.place || saving.value) return;
  saving.value = true;
  errorMsg.value = '';
  try {
    if (savedEntry.value) {
      await deletePlace(savedEntry.value.id);
    } else {
      await savePlace(props.place, description.value, selectedCategory.value, customName.value);
    }
  } catch (e) {
    console.error('Failed to save/unsave place:', e);
    errorMsg.value = e?.code === 'permission-denied'
      ? 'No tienes permiso para hacer este cambio.'
      : 'No se pudo guardar. Intenta de nuevo.';
  } finally {
    saving.value = false;
  }
}

async function handleUpdatePlace() {
  if (!savedEntry.value || saving.value) return;
  saving.value = true;
  errorMsg.value = '';
  try {
    await updatePlace(savedEntry.value.id, {
      description: description.value,
      category: selectedCategory.value,
      customName: customName.value,
    });
  } catch (e) {
    console.error('Failed to update place:', e);
    errorMsg.value = e?.code === 'permission-denied'
      ? 'No tienes permiso para hacer este cambio.'
      : 'No se pudo actualizar. Intenta de nuevo.';
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.detail-panel {
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
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 0;
  color: #e2e8f0;
  font-size: 13px;
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
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.header-badge {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 10px;
  border-radius: 99px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: rgba(99,179,237,0.15);
  color: #60a5fa;
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

.place-name {
  font-size: 17px;
  font-weight: 700;
  color: #f8fafc;
  margin: 0 0 4px;
  line-height: 1.3;
}

.place-address {
  font-size: 12px;
  color: #94a3b8;
  margin: 0 0 8px;
  line-height: 1.4;
}

.coords-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
}

.coord-icon { color: #475569; display: flex; }

.coord-text {
  font-size: 12px;
  color: #475569;
  font-family: 'Courier New', monospace;
}

.divider {
  height: 1px;
  background: rgba(255,255,255,0.07);
  margin: 16px 0;
}

.section { margin-bottom: 16px; }

.section-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #475569;
  margin-bottom: 8px;
}

/* Category selector */
.category-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.cat-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 10px 6px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  color: #64748b;
  font-family: inherit;
  line-height: 1;
}
.cat-tile:hover {
  background: rgba(255,255,255,0.08);
  color: #94a3b8;
  border-color: rgba(255,255,255,0.15);
}

.cat-tile.active-importance {
  background: rgba(245,158,11,0.12);
  border-color: rgba(245,158,11,0.4);
  color: #f59e0b;
}
.cat-tile.active-competitor {
  background: rgba(239,68,68,0.12);
  border-color: rgba(239,68,68,0.4);
  color: #f87171;
}
.cat-tile.active-warehouse {
  background: rgba(52,211,153,0.12);
  border-color: rgba(52,211,153,0.4);
  color: #34d399;
}

/* Custom name input */
.name-input {
  width: 100%;
  box-sizing: border-box;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  padding: 10px 12px;
  color: #e2e8f0;
  font-size: 13px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s;
}
.name-input:focus {
  border-color: rgba(99,179,237,0.4);
  background: rgba(255,255,255,0.07);
}
.name-input::placeholder { color: #475569; }

.desc-input {
  width: 100%;
  box-sizing: border-box;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  padding: 10px 12px;
  color: #e2e8f0;
  font-size: 13px;
  font-family: inherit;
  resize: vertical;
  min-height: 72px;
  transition: border-color 0.15s;
  outline: none;
  line-height: 1.5;
}
.desc-input:focus {
  border-color: rgba(99,179,237,0.4);
  background: rgba(255,255,255,0.07);
}
.desc-input::placeholder { color: #475569; }

.saved-info {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  border-radius: 6px;
  padding: 7px 10px;
  margin-bottom: 12px;
}
.saved-emoji { font-size: 14px; line-height: 1; }

.saved-info.saved-importance {
  color: #fbbf24;
  background: rgba(245,158,11,0.08);
  border: 1px solid rgba(245,158,11,0.2);
}
.saved-info.saved-competitor {
  color: #f87171;
  background: rgba(239,68,68,0.08);
  border: 1px solid rgba(239,68,68,0.2);
}
.saved-info.saved-warehouse {
  color: #6ee7b7;
  background: rgba(52,211,153,0.08);
  border: 1px solid rgba(52,211,153,0.2);
}

.panel-actions {
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid rgba(255,255,255,0.07);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.error-msg {
  margin: 0;
  font-size: 12px;
  color: #f87171;
  background: rgba(239,68,68,0.08);
  border: 1px solid rgba(239,68,68,0.25);
  border-radius: 6px;
  padding: 7px 10px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 10px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  text-align: center;
  transition: all 0.15s;
  border: none;
  cursor: pointer;
  font-family: inherit;
}

/* Save button: inactive states */
.save-btn.save-inactive-importance {
  background: rgba(245,158,11,0.08);
  color: #94a3b8;
  border: 1px solid rgba(245,158,11,0.2);
}
.save-btn.save-inactive-importance:hover:not(:disabled) {
  background: rgba(245,158,11,0.15);
  color: #fcd34d;
  border-color: rgba(245,158,11,0.4);
}
.save-btn.save-inactive-competitor {
  background: rgba(239,68,68,0.08);
  color: #94a3b8;
  border: 1px solid rgba(239,68,68,0.2);
}
.save-btn.save-inactive-competitor:hover:not(:disabled) {
  background: rgba(239,68,68,0.15);
  color: #fca5a5;
  border-color: rgba(239,68,68,0.4);
}
.save-btn.save-inactive-warehouse {
  background: rgba(52,211,153,0.08);
  color: #94a3b8;
  border: 1px solid rgba(52,211,153,0.2);
}
.save-btn.save-inactive-warehouse:hover:not(:disabled) {
  background: rgba(52,211,153,0.15);
  color: #6ee7b7;
  border-color: rgba(52,211,153,0.4);
}

/* Save button: active (saved) states */
.save-btn.save-active-importance {
  background: rgba(245,158,11,0.15);
  color: #f59e0b;
  border: 1px solid rgba(245,158,11,0.35);
}
.save-btn.save-active-importance:hover:not(:disabled) {
  background: rgba(239,68,68,0.1);
  color: #fca5a5;
  border-color: rgba(239,68,68,0.3);
}
.save-btn.save-active-competitor {
  background: rgba(239,68,68,0.15);
  color: #f87171;
  border: 1px solid rgba(239,68,68,0.35);
}
.save-btn.save-active-competitor:hover:not(:disabled) {
  background: rgba(239,68,68,0.1);
  color: #fca5a5;
  border-color: rgba(239,68,68,0.3);
}
.save-btn.save-active-warehouse {
  background: rgba(52,211,153,0.15);
  color: #34d399;
  border: 1px solid rgba(52,211,153,0.35);
}
.save-btn.save-active-warehouse:hover:not(:disabled) {
  background: rgba(239,68,68,0.1);
  color: #fca5a5;
  border-color: rgba(239,68,68,0.3);
}

.save-btn:disabled { opacity: 0.5; cursor: default; }

.update-btn {
  background: rgba(99,179,237,0.08);
  color: #60a5fa;
  border: 1px solid rgba(99,179,237,0.2);
}
.update-btn:hover:not(:disabled) {
  background: rgba(99,179,237,0.15);
}
.update-btn:disabled { opacity: 0.5; cursor: default; }

/* Activity log dropdown */
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
  font-family: inherit;
}
.activity-header:hover .section-title { color: #94a3b8; }

.saved-emoji-sm {
  font-size: 15px;
  line-height: 1;
  flex-shrink: 0;
}

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
.log-date { background: rgba(99,179,237,0.15); color: #60a5fa; }
.log-name { background: rgba(167,139,250,0.15); color: #a78bfa; }
.log-desc { background: rgba(52,211,153,0.15); color: #34d399; }

.activity-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.activity-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #475569;
}
.activity-time {
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.4;
  word-break: break-word;
}

.maps-link-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  text-decoration: none;
  color: #93c5fd;
  font-size: 13px;
  font-weight: 500;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid rgba(59,130,246,0.30);
  background: rgba(59,130,246,0.08);
  transition: background 0.15s, border-color 0.15s;
  font-family: inherit;
}
.maps-link-btn:hover {
  background: rgba(59,130,246,0.18);
  border-color: rgba(59,130,246,0.55);
}

@media (max-width: 640px) {
  .detail-panel {
    width: 100%;
    left: 0;
  }

  .panel-actions {
    padding-bottom: max(env(safe-area-inset-bottom, 0px), 64px);
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
