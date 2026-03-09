<template>
  <Transition name="panel-slide">
    <div v-if="place" class="detail-panel">
      <div class="panel-inner">
        <!-- Header -->
        <div class="panel-header">
          <div class="header-badge">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
            Location
          </div>
          <button class="close-btn" @click="$emit('close')" title="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <h2 class="place-name">{{ place.name || place.formatted_address || 'Location' }}</h2>
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

        <!-- Description -->
        <div class="section">
          <div class="section-title">Notes</div>
          <textarea
            v-model="description"
            class="desc-input"
            placeholder="Add a note about this place…"
            rows="3"
          ></textarea>
        </div>

        <!-- Saved info -->
        <div v-if="savedEntry" class="saved-info">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" stroke-width="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          Saved · {{ savedTimeLabel }}
        </div>

        <!-- Actions -->
        <div class="panel-actions">
          <!-- Save / unsave star button -->
          <button
            class="action-btn star-btn"
            :class="{ 'star-active': !!savedEntry }"
            :disabled="saving"
            @click="handleStarToggle"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" :fill="savedEntry ? '#f59e0b' : 'none'" :stroke="savedEntry ? '#f59e0b' : 'currentColor'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            {{ saving ? 'Saving…' : savedEntry ? 'Saved' : 'Save Place' }}
          </button>

          <!-- Update description if already saved -->
          <button
            v-if="savedEntry && descriptionChanged"
            class="action-btn update-btn"
            :disabled="saving"
            @click="handleUpdateDescription"
          >
            Update Notes
          </button>

          <a
            :href="`https://www.google.com/maps?q=${place.lat},${place.lng}`"
            target="_blank"
            rel="noopener noreferrer"
            class="action-btn primary"
          >
            Open in Google Maps
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

const { getSaved, savePlace, deletePlace, updateDescription } = useSavedPlaces();

const description = ref('');
const saving = ref(false);

const savedEntry = computed(() => props.place ? getSaved(props.place) : null);

const descriptionChanged = computed(
  () => savedEntry.value && description.value !== (savedEntry.value.description ?? '')
);

const savedTimeLabel = computed(() => {
  if (!savedEntry.value?.savedAt) return '';
  const ts = savedEntry.value.savedAt;
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
});

// Sync description field when panel opens or switches to a different place
watch(
  () => props.place,
  () => {
    description.value = savedEntry.value?.description ?? '';
  },
  { immediate: true }
);

// Also sync if savedEntry appears (e.g., right after saving)
watch(savedEntry, (entry) => {
  if (entry && !description.value) description.value = entry.description ?? '';
});

async function handleStarToggle() {
  if (!props.place || saving.value) return;
  saving.value = true;
  try {
    if (savedEntry.value) {
      await deletePlace(savedEntry.value.id);
    } else {
      await savePlace(props.place, description.value);
    }
  } finally {
    saving.value = false;
  }
}

async function handleUpdateDescription() {
  if (!savedEntry.value || saving.value) return;
  saving.value = true;
  try {
    await updateDescription(savedEntry.value.id, description.value);
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
  color: #a16207;
  background: rgba(245,158,11,0.08);
  border: 1px solid rgba(245,158,11,0.15);
  border-radius: 6px;
  padding: 7px 10px;
  margin-bottom: 12px;
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

.star-btn {
  background: rgba(245,158,11,0.08);
  color: #94a3b8;
  border: 1px solid rgba(245,158,11,0.2);
}
.star-btn:hover:not(:disabled) {
  background: rgba(245,158,11,0.15);
  color: #fcd34d;
  border-color: rgba(245,158,11,0.4);
}
.star-btn.star-active {
  background: rgba(245,158,11,0.15);
  color: #f59e0b;
  border-color: rgba(245,158,11,0.35);
}
.star-btn.star-active:hover:not(:disabled) {
  background: rgba(239,68,68,0.1);
  color: #fca5a5;
  border-color: rgba(239,68,68,0.3);
}
.star-btn:disabled { opacity: 0.5; cursor: default; }

.update-btn {
  background: rgba(99,179,237,0.08);
  color: #60a5fa;
  border: 1px solid rgba(99,179,237,0.2);
}
.update-btn:hover:not(:disabled) {
  background: rgba(99,179,237,0.15);
}
.update-btn:disabled { opacity: 0.5; cursor: default; }

.action-btn.primary {
  background: #1d4ed8;
  color: #fff;
  border: 1px solid #2563eb;
}
.action-btn.primary:hover { background: #2563eb; }

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
