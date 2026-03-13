/**
 * Compatibility shim — all shop data now lives in visited_stores.
 * Re-exports from useVisited so existing imports continue to work.
 */
import { computed } from 'vue';
import { useVisited } from './useVisited.js';

export function useShopStatus() {
  const { visitedStatusMap, visitedShops } = useVisited();

  // Derive closed/permanentlyClosed sets from visitedStatusMap for any
  // components that still import these (e.g. App.vue filteredShops).
  const closedIds = computed(() => {
    const s = new Set();
    for (const [id, vs] of visitedStatusMap.value) {
      if (vs === 'cerrada') s.add(id);
    }
    return s;
  });

  const permanentlyClosedIds = computed(() => {
    const s = new Set();
    for (const [id, vs] of visitedStatusMap.value) {
      if (vs === 'cerrada_permanentemente') s.add(id);
    }
    return s;
  });

  return {
    closedIds,
    permanentlyClosedIds,
    statusDocs:    visitedShops,
    fetchStatuses: () => {},
    toggleStatus:  () => {},
    clearStatus:   () => {},
  };
}
