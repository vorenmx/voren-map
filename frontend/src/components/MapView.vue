<template>
  <div class="map-wrapper">
    <div ref="mapContainer" class="map-container"></div>

    <ShopTooltip :pick-info="hoverInfo" />

    <!-- Zoom controls -->
    <div class="zoom-controls" v-if="mapReady">
      <button class="zoom-btn" @click="zoomIn" title="Acercar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>
      <div class="zoom-divider"></div>
      <button class="zoom-btn" @click="zoomOut" title="Alejar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>
    </div>

    <div v-if="!mapReady" class="map-overlay">
      <div class="loading-spinner"></div>
      <span>Cargando mapa…</span>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, defineExpose } from 'vue';
import { GoogleMapsOverlay } from '@deck.gl/google-maps';
import ShopTooltip from './ShopTooltip.vue';

const props = defineProps({
  layers: { type: Array, required: true },
  onLayerClick: { type: Function, default: null },
  onSavedPlaceClick: { type: Function, default: null },
});

const mapContainer = ref(null);
const mapReady = ref(false);
const hoverInfo = ref(null);

let googleMap = null;
let deckOverlay = null;

const MEXICO_CENTER = { lat: 23.6345, lng: -102.5528 };

onMounted(async () => {
  // Wait for the global Maps script tag to finish loading
  await window.__mapsReady;

  const mapId = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || undefined;

  googleMap = new window.google.maps.Map(mapContainer.value, {
    center: MEXICO_CENTER,
    zoom: 5,
    mapTypeId: 'roadmap',
    mapId,
    tilt: 0,
    heading: 0,
    disableDefaultUI: false,
    zoomControl: window.innerWidth > 640,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: window.innerWidth > 640,
    // styles only apply when no mapId (vector map); vector map uses Cloud styling
    ...(mapId ? {} : { styles: DARK_MAP_STYLES }),
  });

  deckOverlay = new GoogleMapsOverlay({
    layers: props.layers,
    pickingRadius: 8,
    onHover: (info) => {
      hoverInfo.value = info;
    },
    onClick: (info) => {
      if (props.onLayerClick) props.onLayerClick(info);
    },
  });
  deckOverlay.setMap(googleMap);

  mapReady.value = true;
});

onBeforeUnmount(() => {
  if (deckOverlay) deckOverlay.setMap(null);
});

function zoomIn() {
  if (googleMap) googleMap.setZoom(googleMap.getZoom() + 1);
}

function zoomOut() {
  if (googleMap) googleMap.setZoom(googleMap.getZoom() - 1);
}

function flyTo({ lat, lng, zoom = 15 }) {
  if (!googleMap) return;
  googleMap.panTo({ lat, lng });
  googleMap.setZoom(zoom);
}

let currentPin = null;

function placePin({ lat, lng, label = '' }) {
  if (!googleMap) return;
  if (currentPin) { currentPin.map = null; currentPin = null; }
  const gm = window.google?.maps;
  if (!gm?.marker?.AdvancedMarkerElement) return;
  const pin = new gm.marker.PinElement({
    background: '#ef4444',
    borderColor: '#b91c1c',
    glyphColor: '#ffffff',
    scale: 1.2,
  });
  currentPin = new gm.marker.AdvancedMarkerElement({
    map: googleMap,
    position: { lat, lng },
    title: label,
    content: pin.element,
  });
}

function clearPin() {
  if (currentPin) { currentPin.map = null; currentPin = null; }
}

function setTilt(degrees) {
  if (!googleMap) return;
  googleMap.setTilt(degrees);
}

function setHeading(degrees) {
  if (!googleMap) return;
  googleMap.setHeading(degrees);
}

// ── Saved-place star markers ─────────────────────────────────────────────────
const starMarkers = new Map(); // id → AdvancedMarkerElement

function syncSavedMarkers(places) {
  if (!googleMap || !window.google?.maps?.marker?.AdvancedMarkerElement) return;

  // Remove markers for places no longer in the list
  const ids = new Set(places.map((p) => p.id));
  for (const [id, marker] of starMarkers) {
    if (!ids.has(id)) {
      marker.map = null;
      starMarkers.delete(id);
    }
  }

  // Add markers for newly saved places
  for (const place of places) {
    if (starMarkers.has(place.id)) continue;
    const el = document.createElement('div');
    el.style.cssText = 'font-size:26px;line-height:1;cursor:pointer;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.6));user-select:none;';
    el.textContent = '⭐';
    el.title = place.name || place.formatted_address || 'Lugar guardado';

    const marker = new window.google.maps.marker.AdvancedMarkerElement({
      map: googleMap,
      position: { lat: place.lat, lng: place.lng },
      title: el.title,
      content: el,
    });
    marker.addListener('click', () => {
      if (props.onSavedPlaceClick) props.onSavedPlaceClick(place);
    });
    starMarkers.set(place.id, marker);
  }
}

defineExpose({ flyTo, setTilt, setHeading, placePin, clearPin, syncSavedMarkers });

watch(
  () => props.layers,
  (newLayers) => {
    if (deckOverlay) {
      deckOverlay.setProps({ layers: newLayers });
    }
  },
  { deep: false }
);

// Dark map style for a sleek look
const DARK_MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0f172a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#cbd5e1' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#1e293b' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#0f172a' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#475569' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#1e3a5f' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#172554' }],
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#1e293b' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#0c1a35' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#334155' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
];
</script>

<style scoped>
.map-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}

.map-container {
  width: 100%;
  height: 100%;
}

.map-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: rgba(10, 15, 30, 0.85);
  color: #94a3b8;
  font-size: 14px;
  z-index: 5;
}

.zoom-controls {
  position: absolute;
  bottom: 32px;
  left: 16px;
  display: flex;
  flex-direction: column;
  background: rgba(10, 15, 30, 0.92);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0,0,0,0.4);
  backdrop-filter: blur(8px);
  z-index: 10;
}

.zoom-btn {
  width: 36px;
  height: 36px;
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, color 0.15s;
}
.zoom-btn:hover {
  background: rgba(255,255,255,0.1);
  color: #f1f5f9;
}
.zoom-btn:active {
  background: rgba(59,130,246,0.2);
  color: #60a5fa;
}

.zoom-divider {
  height: 1px;
  background: rgba(255,255,255,0.08);
  margin: 0 6px;
}

.loading-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid rgba(255,255,255,0.1);
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 640px) {
  /* Move zoom controls above the browser navigation bar (~80px) */
  .zoom-controls {
    bottom: 88px;
    left: 12px;
  }

  /* Larger touch targets for zoom buttons */
  .zoom-btn {
    width: 44px;
    height: 44px;
  }
}
</style>
