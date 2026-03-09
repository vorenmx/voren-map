<template>
  <div class="app">
    <!-- Header -->
    <header class="app-header">
      <div class="header-left">
        <span class="logo">🏍</span>
        <div>
          <h1 class="app-title">Motorcycle Shops Mexico</h1>
          <p class="app-subtitle">3D density map — deck.gl + Google Maps</p>
        </div>
      </div>
      <SearchBar :shops="shops" @fly-to="onFlyTo" />
      <div class="header-right">
        <div v-if="loading" class="loading-badge">
          <span class="pulse"></span> Loading data…
        </div>
        <div v-else-if="error" class="error-badge" :title="error">
          ⚠ Data error
        </div>
        <div v-else class="data-badge">
          {{ shops.length.toLocaleString() }} shops loaded
        </div>
      </div>
    </header>

    <!-- Map + Filters layout -->
    <div class="main-layout">
      <MapView
        ref="mapViewRef"
        :layers="layers"
        :on-layer-click="onLayerClick"
        :on-saved-place-click="onSavedPlaceClick"
        class="map-area"
      />
      <FilterPanel
        v-model="filters"
        :all-states="allStates"
        :total-count="shops.length"
        :filtered-count="filteredShops.length"
      />

      <!-- Click panels, positioned over the map -->
      <HexShopListPanel
        :shops="clickedHexShops"
        @close="clickedHexShops = null"
        @select-shop="openShopFromHex"
      />
      <ShopDetailPanel
        :shop="clickedShop"
        @close="clickedShop = null"
      />
      <PlaceDetailPanel
        :place="selectedPlace"
        @close="selectedPlace = null; mapViewRef?.clearPin()"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import MapView from './components/MapView.vue';
import FilterPanel from './components/FilterPanel.vue';
import SearchBar from './components/SearchBar.vue';
import ShopDetailPanel from './components/ShopDetailPanel.vue';
import HexShopListPanel from './components/HexShopListPanel.vue';
import PlaceDetailPanel from './components/PlaceDetailPanel.vue';
import { useShops } from './composables/useShops.js';
import { useDeckLayers } from './composables/useDeckLayers.js';
import { useVisited } from './composables/useVisited.js';
import { useSavedPlaces } from './composables/useSavedPlaces.js';

const { shops, loading, error, allStates, fetchShops } = useShops();
const { visitedShops, fetchVisited } = useVisited();
const { savedPlaces, fetchSavedPlaces } = useSavedPlaces();
const mapViewRef = ref(null);

function onFlyTo(payload) {
  mapViewRef.value?.flyTo(payload);

  if (payload.place) {
    // Location result — open PlaceDetailPanel, close shop panels
    selectedPlace.value = payload.place;
    clickedShop.value = null;
    clickedHexShops.value = null;
    mapViewRef.value?.placePin({ lat: payload.lat, lng: payload.lng, label: payload.place.name || '' });
  } else if (payload.shop) {
    // Shop result — open ShopDetailPanel, close place panel
    selectedPlace.value = null;
    clickedShop.value = payload.shop;
    clickedHexShops.value = null;
    const label = payload.shop.name || payload.shop.company_name || '';
    mapViewRef.value?.placePin({ lat: payload.lat, lng: payload.lng, label });
  }
}

function onSavedPlaceClick(place) {
  selectedPlace.value = place;
  clickedShop.value = null;
  clickedHexShops.value = null;
  mapViewRef.value?.flyTo({ lat: place.lat, lng: place.lng, zoom: 15 });
  mapViewRef.value?.placePin({ lat: place.lat, lng: place.lng, label: place.name || '' });
}

const filters = ref({
  viewMode: 'hex',
  shopTypes: ['Repair', 'Parts', 'Both', 'Other'],
  sources: ['denue', 'google', 'both'],
  state: '',
  minRating: 0,
  showPurchases: true,
  showAvgOrder: true,
});

const filteredShops = computed(() => {
  // In visited mode, use the visited_stores snapshot directly
  const source = filters.value.viewMode === 'visited' ? visitedShops.value : shops.value;
  return source.filter((s) => {
    if (!filters.value.shopTypes.includes(s.shop_type)) return false;
    if (filters.value.viewMode !== 'visited') {
      if (!filters.value.sources.includes(s.source)) return false;
    }
    if (filters.value.state && s.state !== filters.value.state) return false;
    if (filters.value.minRating > 0) {
      if (!s.rating || s.rating < filters.value.minRating) return false;
    }
    return true;
  });
});

const viewMode = computed(() => filters.value.viewMode);
const showPurchases = computed(() => filters.value.showPurchases);
const showAvgOrder = computed(() => filters.value.showAvgOrder);
const onHover = ref((info) => info);

// Click state
const clickedShop = ref(null);
const clickedHexShops = ref(null);
const selectedPlace = ref(null); // location from search bar or saved-place marker click

// Hex radius in degrees (~5km at Mexico's latitude, matching HexagonLayer radius: 5000)
const HEX_RADIUS_DEG = 0.045;
// Must match GRID_SIZE in useDeckLayers.js
const COMPARE_GRID_SIZE = 0.05;

function findShopsInHex(clickLng, clickLat) {
  return filteredShops.value.filter((s) =>
    s.latitude != null &&
    s.longitude != null &&
    Math.abs(s.latitude - clickLat) < HEX_RADIUS_DEG &&
    Math.abs(s.longitude - clickLng) < HEX_RADIUS_DEG
  );
}

function findShopsInCompareCell(cellLat, cellLng) {
  const latKey = Math.floor(cellLat / COMPARE_GRID_SIZE);
  const lngKey = Math.floor(cellLng / COMPARE_GRID_SIZE);
  return filteredShops.value.filter((s) =>
    s.latitude != null &&
    s.longitude != null &&
    Math.floor(s.latitude / COMPARE_GRID_SIZE) === latKey &&
    Math.floor(s.longitude / COMPARE_GRID_SIZE) === lngKey
  );
}

function findNearestShopToClick(clickLat, clickLng, cellLat, cellLng) {
  const shops = findShopsInCompareCell(cellLat, cellLng);
  if (!shops.length) return null;
  if (shops.length === 1) return shops[0];
  // Use click coordinate if available, otherwise fall back to cell center
  const refLat = clickLat ?? cellLat;
  const refLng = clickLng ?? cellLng;
  return shops.reduce((nearest, s) => {
    const d = (s.latitude - refLat) ** 2 + (s.longitude - refLng) ** 2;
    const nd = (nearest.latitude - refLat) ** 2 + (nearest.longitude - refLng) ** 2;
    return d < nd ? s : nearest;
  });
}

function onLayerClick(info) {
  const layerId = info.layer?.id;

  if (layerId === 'scatter-layer' && info.object) {
    clickedShop.value = info.object;
    clickedHexShops.value = null;
    if (info.object.latitude != null && info.object.longitude != null) {
      mapViewRef.value?.placePin({
        lat: info.object.latitude,
        lng: info.object.longitude,
        label: info.object.name || info.object.company_name || '',
      });
    }

  } else if (layerId === 'hexagon-layer') {
    // Try deck.gl's built-in points array first, then fall back to
    // coordinate-based search (deck.gl v9 changed aggregation data structure)
    const [clickLng, clickLat] = info.coordinate ?? [];
    let shops = info.object?.points ?? info.object?.data ?? [];
    if (!shops.length && clickLat != null) {
      shops = findShopsInHex(clickLng, clickLat);
    }
    if (shops.length) {
      clickedHexShops.value = shops;
      clickedShop.value = null;
      mapViewRef.value?.clearPin();
    }

  } else if (layerId === 'purchases-column' || layerId === 'avgorder-column') {
    if (!info.object) return;
    const shop = info.object;
    clickedShop.value = shop;
    clickedHexShops.value = null;
    if (shop.latitude != null && shop.longitude != null) {
      mapViewRef.value?.placePin({
        lat: shop.latitude,
        lng: shop.longitude,
        label: shop.name || shop.company_name || '',
      });
    }
  }
}

function openShopFromHex(shop) {
  clickedHexShops.value = null;
  clickedShop.value = shop;
  if (shop.latitude != null && shop.longitude != null) {
    mapViewRef.value?.placePin({ lat: shop.latitude, lng: shop.longitude, label: shop.name || shop.company_name || '' });
    mapViewRef.value?.flyTo({ lat: shop.latitude, lng: shop.longitude, zoom: 17 });
  }
}

const onClickCallback = ref(onLayerClick);
const { layers } = useDeckLayers(filteredShops, viewMode, onHover, showPurchases, showAvgOrder, onClickCallback);

// Auto-tilt map when entering compare mode, reset otherwise
watch(viewMode, (mode) => {
  if (mode === 'compare') {
    mapViewRef.value?.setTilt(55);
    mapViewRef.value?.setHeading(20);
  } else {
    mapViewRef.value?.setTilt(0);
    mapViewRef.value?.setHeading(0);
  }
  // Refresh visited list whenever user switches to visited mode
  if (mode === 'visited') fetchVisited();
});

// Keep star markers in sync whenever savedPlaces list changes.
// Also call again after a short delay on first load to ensure the map is ready.
watch(savedPlaces, (places) => {
  if (mapViewRef.value) {
    mapViewRef.value.syncSavedMarkers(places);
  } else {
    setTimeout(() => mapViewRef.value?.syncSavedMarkers(places), 2000);
  }
}, { deep: true });

onMounted(() => {
  fetchShops();
  fetchVisited();
  fetchSavedPlaces();
});
</script>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background: #0f172a;
  font-family: 'Inter', system-ui, sans-serif;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 20px;
  background: rgba(10, 15, 30, 0.95);
  border-bottom: 1px solid rgba(255,255,255,0.07);
  z-index: 20;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo { font-size: 24px; }

.app-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #f1f5f9;
}

.app-subtitle {
  margin: 0;
  font-size: 11px;
  color: #475569;
}

.header-right {
  font-size: 13px;
}

.loading-badge,
.data-badge,
.error-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 99px;
  font-size: 12px;
  font-weight: 500;
}

.loading-badge {
  background: rgba(59,130,246,0.15);
  color: #60a5fa;
  border: 1px solid rgba(59,130,246,0.3);
}

.data-badge {
  background: rgba(16,185,129,0.12);
  color: #34d399;
  border: 1px solid rgba(16,185,129,0.25);
}

.error-badge {
  background: rgba(239,68,68,0.12);
  color: #f87171;
  border: 1px solid rgba(239,68,68,0.25);
  cursor: help;
}

.pulse {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #3b82f6;
  animation: pulse 1.2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.75); }
}

.main-layout {
  position: relative;
  flex: 1;
  overflow: hidden;
  display: flex;
}

.map-area {
  flex: 1;
  height: 100%;
}

</style>
