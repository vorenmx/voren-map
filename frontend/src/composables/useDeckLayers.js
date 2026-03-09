import { computed } from 'vue';
import { HexagonLayer } from '@deck.gl/aggregation-layers';
import { ScatterplotLayer, ColumnLayer } from '@deck.gl/layers';

// Color map by shop type — [R, G, B, A]
const SHOP_TYPE_COLORS = {
  Repair: [59, 130, 246, 220],
  Parts: [245, 158, 11, 220],
  Both: [16, 185, 129, 220],
  Other: [156, 163, 175, 200],
};

function shopColor(shop) {
  return SHOP_TYPE_COLORS[shop.shop_type] ?? SHOP_TYPE_COLORS.Other;
}

// ── Compare mode: grid aggregation ──────────────────────────────────────────
const GRID_SIZE = 0.05;      // ~5.5 km per cell (finer grid for denser data)
const COLUMN_RADIUS = 120;   // meters — matches scatter point size visually
const COL_OFFSET = 0.0015;   // degrees (~165 m) — tight pair of columns
const MAX_ELEVATION = 80000; // meters — tallest possible column

function aggregateForCompare(data) {
  const cells = {};

  data.forEach((shop) => {
    const latKey = Math.floor(shop.latitude / GRID_SIZE);
    const lngKey = Math.floor(shop.longitude / GRID_SIZE);
    const key = `${latKey}_${lngKey}`;

    if (!cells[key]) {
      cells[key] = {
        lat: (latKey + 0.5) * GRID_SIZE,
        lng: (lngKey + 0.5) * GRID_SIZE,
        count: 0,
        total_purchases: 0,
        total_avg_order: 0,
        n_avg_order: 0,
      };
    }

    const c = cells[key];
    c.count++;
    if (shop.purchases != null) c.total_purchases += Number(shop.purchases);
    if (shop.average_order != null) {
      c.total_avg_order += Number(shop.average_order);
      c.n_avg_order++;
    }
  });

  return Object.values(cells).map((c) => ({
    lat: c.lat,
    lng: c.lng,
    count: c.count,
    total_purchases: c.total_purchases,
    avg_order: c.n_avg_order > 0 ? c.total_avg_order / c.n_avg_order : 0,
  }));
}
// ────────────────────────────────────────────────────────────────────────────

export function useDeckLayers(filteredShops, viewMode, onHover, showPurchases, showAvgOrder, onClickCallback) {
  const layers = computed(() => {
    const data = filteredShops.value.filter(
      (s) => s.latitude != null && s.longitude != null
    );

    // ── 3D Density (HexagonLayer) ──────────────────────────────────────────
    if (viewMode.value === 'hex') {
      const getElevationWeight = (d) => {
        const p = d.purchases;
        return p != null && p > 0 ? Number(p) : 1;
      };
      return [
        new HexagonLayer({
          id: 'hexagon-layer',
          data,
          getPosition: (d) => [d.longitude, d.latitude],
          getElevationWeight,
          radius: 5000,
          elevationScale: 0.5,
          extruded: true,
          pickable: true,
          opacity: 0.8,
          colorRange: [
            [254, 235, 200],
            [253, 190, 133],
            [253, 141, 60],
            [227, 74, 51],
            [166, 54, 3],
            [91, 24, 1],
          ],
          elevationRange: [0, 3000],
          coverage: 0.88,
          onHover: onHover.value,
          onClick: onClickCallback?.value,
        }),
      ];
    }

    // ── Compare mode (two ColumnLayers, one pair per shop) ────────────────
    if (viewMode.value === 'compare') {
      const maxPurchases = Math.max(...data.map((s) => Number(s.purchases) || 0), 1);
      const maxAvgOrder  = Math.max(...data.map((s) => Number(s.average_order) || 0), 1);

      const activeLayers = [];

      // Blue column — purchases per shop (left, or centered when alone)
      if (showPurchases?.value !== false) {
        const offset = showAvgOrder?.value !== false ? -COL_OFFSET : 0;
        activeLayers.push(
          new ColumnLayer({
            id: 'purchases-column',
            data,
            getPosition: (d) => [d.longitude + offset, d.latitude],
            getElevation: (d) => ((Number(d.purchases) || 0) / maxPurchases) * MAX_ELEVATION,
            getFillColor: (d) => {
              const t = (Number(d.purchases) || 0) / maxPurchases;
              return [Math.round(59 + t * 40), Math.round(100 + t * 60), 246, 210];
            },
            radius: COLUMN_RADIUS,
            radiusMinPixels: 3,
            radiusMaxPixels: 8,
            diskResolution: 6,
            extruded: true,
            pickable: true,
            opacity: 0.9,
            onHover: onHover.value,
            onClick: onClickCallback?.value,
          })
        );
      }

      // Amber column — average order per shop (right, or centered when alone)
      if (showAvgOrder?.value !== false) {
        const offset = showPurchases?.value !== false ? COL_OFFSET : 0;
        activeLayers.push(
          new ColumnLayer({
            id: 'avgorder-column',
            data,
            getPosition: (d) => [d.longitude + offset, d.latitude],
            getElevation: (d) => ((Number(d.average_order) || 0) / maxAvgOrder) * MAX_ELEVATION,
            getFillColor: (d) => {
              const t = (Number(d.average_order) || 0) / maxAvgOrder;
              return [245, Math.round(120 + t * 80), Math.round(11 + t * 20), 210];
            },
            radius: COLUMN_RADIUS,
            radiusMinPixels: 3,
            radiusMaxPixels: 8,
            diskResolution: 6,
            extruded: true,
            pickable: true,
            opacity: 0.9,
            onHover: onHover.value,
            onClick: onClickCallback?.value,
          })
        );
      }

      return activeLayers;
    }

    // ── Visited / Points (ScatterplotLayer) ───────────────────────────────
    return [
      new ScatterplotLayer({
        id: 'scatter-layer',
        data,
        getPosition: (d) => [d.longitude, d.latitude],
        getFillColor: shopColor,
        getRadius: 300,
        radiusMinPixels: 4,
        radiusMaxPixels: 14,
        pickable: true,
        opacity: 0.85,
        stroked: true,
        getLineColor: [255, 255, 255, 120],
        lineWidthMinPixels: 1,
        onHover: onHover.value,
        onClick: onClickCallback?.value,
      }),
    ];
  });

  return { layers };
}
