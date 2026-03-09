<template>
  <div class="search-wrapper" ref="wrapperRef">
    <div class="search-box" :class="{ focused }">
      <span class="search-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      </span>
      <input
        ref="inputRef"
        v-model="query"
        type="text"
        placeholder="Search shops, cities, streets, states…"
        class="search-input"
        autocomplete="off"
        @focus="focused = true"
        @keydown.escape="close"
        @keydown.arrow-down.prevent="moveSelection(1)"
        @keydown.arrow-up.prevent="moveSelection(-1)"
        @keydown.enter.prevent="selectCurrent"
      />
      <span v-if="loadingPlaces" class="loading-dot"></span>
      <button v-else-if="query" class="clear-btn" @click="clear" title="Clear">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>

    <!-- Results dropdown -->
    <div v-if="showDropdown" class="dropdown">

      <!-- Location results (Google Places) -->
      <template v-if="locationResults.length">
        <div class="dropdown-section-label">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
          Locations
        </div>
        <button
          v-for="(item, i) in locationResults"
          :key="item.place_id"
          class="dropdown-item"
          :class="{ active: selectedIndex === i }"
          @click="selectLocation(item)"
          @mouseenter="selectedIndex = i"
        >
          <span class="item-icon location-icon">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
          </span>
          <div class="item-body">
            <div class="item-name">{{ item.structured_formatting?.main_text || item.description }}</div>
            <div class="item-meta">{{ item.structured_formatting?.secondary_text }}</div>
          </div>
        </button>
      </template>

      <!-- Shop results -->
      <template v-if="shopResults.length">
        <div class="dropdown-section-label">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          Shops
        </div>
        <button
          v-for="(item, i) in shopResults"
          :key="item.id || item.name"
          class="dropdown-item"
          :class="{ active: selectedIndex === locationResults.length + i }"
          @click="selectShop(item)"
          @mouseenter="selectedIndex = locationResults.length + i"
        >
          <span class="item-icon shop-icon" :class="typeClass(item.shop_type)">
            {{ typeEmoji(item.shop_type) }}
          </span>
          <div class="item-body">
            <div class="item-name">{{ item.name || item.company_name }}</div>
            <div class="item-meta">{{ [item.municipality, item.state].filter(Boolean).join(', ') }}</div>
          </div>
          <span v-if="item.rating" class="item-rating">{{ item.rating }}★</span>
        </button>
      </template>

      <!-- No results -->
      <div v-if="!locationResults.length && !shopResults.length && query.length >= 2 && !loadingPlaces" class="dropdown-empty">
        No results for "{{ query }}"
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';

const props = defineProps({
  shops: { type: Array, default: () => [] },
});

const emit = defineEmits(['fly-to']);

const query = ref('');
const focused = ref(false);
const selectedIndex = ref(-1);
const wrapperRef = ref(null);
const inputRef = ref(null);

const locationResults = ref([]);
const loadingPlaces = ref(false);

const MAX_SHOPS = 6;
const MAX_LOCATIONS = 5;

// ── Client-side shop filter ──────────────────────────────────────────────────
const shopResults = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (q.length < 2) return [];
  return props.shops
    .filter((s) => (
      s.name?.toLowerCase().includes(q) ||
      s.company_name?.toLowerCase().includes(q) ||
      s.formatted_address?.toLowerCase().includes(q) ||
      s.municipality?.toLowerCase().includes(q) ||
      s.state?.toLowerCase().includes(q) ||
      s.neighborhood?.toLowerCase().includes(q) ||
      s.street?.toLowerCase().includes(q)
    ))
    .slice(0, MAX_SHOPS);
});

// ── Google Places Autocomplete ───────────────────────────────────────────────
let debounceTimer = null;

watch(query, (val) => {
  selectedIndex.value = -1;
  clearTimeout(debounceTimer);
  const q = val.trim();
  if (q.length < 2) {
    locationResults.value = [];
    return;
  }
  debounceTimer = setTimeout(() => fetchPlaces(q), 300);
});

async function fetchPlaces(q) {
  if (!window.google?.maps?.places) return;
  loadingPlaces.value = true;
  try {
    const { AutocompleteSuggestion } = window.google.maps.places;
    const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
      input: q,
      includedRegionCodes: ['mx'],
    });
    locationResults.value = suggestions.slice(0, MAX_LOCATIONS).map((s) => ({
      place_id: s.placePrediction?.placeId,
      description: s.placePrediction?.text?.text,
      structured_formatting: {
        main_text: s.placePrediction?.mainText?.text,
        secondary_text: s.placePrediction?.secondaryText?.text,
      },
      _prediction: s.placePrediction,
    }));
  } catch {
    locationResults.value = [];
  } finally {
    loadingPlaces.value = false;
  }
}

async function selectLocation(item) {
  if (!item._prediction) return;
  try {
    const place = item._prediction.toPlace();
    await place.fetchFields({ fields: ['location', 'displayName', 'formattedAddress'] });
    const loc = place.location;
    if (loc) {
      emit('fly-to', {
        lat: loc.lat(),
        lng: loc.lng(),
        zoom: 14,
        place: {
          place_id: item.place_id,
          name: place.displayName || item.structured_formatting?.main_text || item.description || '',
          formatted_address: place.formattedAddress || item.description || '',
          lat: loc.lat(),
          lng: loc.lng(),
        },
      });
    }
  } catch {
    // fallback: nothing
  }
  query.value = item.structured_formatting?.main_text || item.description || '';
  focused.value = false;
}

// ── Shared helpers ───────────────────────────────────────────────────────────
const showDropdown = computed(() =>
  focused.value && query.value.length >= 2 && (locationResults.value.length > 0 || shopResults.value.length > 0 || loadingPlaces.value)
);

const allResultsCount = computed(() => locationResults.value.length + shopResults.value.length);

function selectShop(shop) {
  if (shop.latitude == null || shop.longitude == null) return;
  emit('fly-to', { lat: shop.latitude, lng: shop.longitude, zoom: 16, shop });
  query.value = shop.name || shop.company_name || '';
  focused.value = false;
}

function moveSelection(dir) {
  const max = allResultsCount.value - 1;
  selectedIndex.value = Math.max(-1, Math.min(max, selectedIndex.value + dir));
}

function selectCurrent() {
  const idx = selectedIndex.value;
  if (idx < 0) return;
  if (idx < locationResults.value.length) {
    selectLocation(locationResults.value[idx]);
  } else {
    const shopIdx = idx - locationResults.value.length;
    if (shopResults.value[shopIdx]) selectShop(shopResults.value[shopIdx]);
  }
}

function clear() {
  query.value = '';
  locationResults.value = [];
  focused.value = true;
  inputRef.value?.focus();
}

function close() {
  focused.value = false;
  inputRef.value?.blur();
}

function handleClickOutside(e) {
  if (wrapperRef.value && !wrapperRef.value.contains(e.target)) {
    focused.value = false;
  }
}

onMounted(() => document.addEventListener('mousedown', handleClickOutside));
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleClickOutside);
  clearTimeout(debounceTimer);
});

function typeEmoji(type) {
  return { Repair: '🔧', Parts: '⚙️', Both: '🏪', Other: '📍' }[type] ?? '📍';
}
function typeClass(type) {
  return { Repair: 'c-repair', Parts: 'c-parts', Both: 'c-both', Other: 'c-other' }[type] ?? 'c-other';
}
</script>

<style scoped>
.search-wrapper {
  position: relative;
  flex: 1;
  min-width: 0;
  max-width: 340px;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 8px;
  padding: 0 10px;
  transition: border-color 0.15s, background 0.15s;
}
.search-box.focused {
  background: rgba(255,255,255,0.1);
  border-color: rgba(99,179,237,0.5);
  box-shadow: 0 0 0 3px rgba(59,130,246,0.15);
}

.search-icon {
  color: #64748b;
  display: flex;
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  color: #f1f5f9;
  font-size: 13px;
  padding: 8px 0;
  font-family: inherit;
}
.search-input::placeholder { color: #475569; }

.loading-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 2px solid rgba(99,179,237,0.3);
  border-top-color: #60a5fa;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}

@keyframes spin { to { transform: rotate(360deg); } }

.clear-btn {
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  display: flex;
  padding: 2px;
  border-radius: 4px;
  flex-shrink: 0;
}
.clear-btn:hover { color: #f1f5f9; background: rgba(255,255,255,0.08); }

.dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  background: rgba(13, 20, 40, 0.98);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 12px 40px rgba(0,0,0,0.5);
  z-index: 100;
  backdrop-filter: blur(12px);
  max-height: 420px;
  overflow-y: auto;
}

.dropdown-section-label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #475569;
  padding: 8px 12px 4px;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 12px;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  color: #e2e8f0;
  transition: background 0.1s;
}
.dropdown-item:hover,
.dropdown-item.active {
  background: rgba(255,255,255,0.07);
}

.item-icon {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
}
.location-icon {
  background: rgba(99,179,237,0.12);
  color: #60a5fa;
}
.c-repair { background: rgba(59,130,246,0.2); }
.c-parts  { background: rgba(245,158,11,0.2); }
.c-both   { background: rgba(16,185,129,0.2); }
.c-other  { background: rgba(156,163,175,0.15); }

.item-body { flex: 1; min-width: 0; }

.item-name {
  font-size: 13px;
  font-weight: 500;
  color: #f1f5f9;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-meta {
  font-size: 11px;
  color: #64748b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-rating {
  font-size: 11px;
  color: #f59e0b;
  font-weight: 600;
  flex-shrink: 0;
}

.dropdown-empty {
  padding: 16px 12px;
  font-size: 13px;
  color: #475569;
  text-align: center;
}

@media (max-width: 640px) {
  .search-wrapper {
    max-width: none;
  }

  .dropdown {
    position: fixed;
    left: 8px;
    right: 8px;
    top: 56px;
    z-index: 300;
  }
}
</style>
