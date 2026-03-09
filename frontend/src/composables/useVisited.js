import { ref } from 'vue';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config.js';

const visitedIds = ref(new Set());
const visitedShops = ref([]);
let fetched = false;

export function useVisited() {
  async function fetchVisited() {
    if (fetched) return;
    try {
      const snapshot = await getDocs(collection(db, 'visited_stores'));
      const ids = new Set();
      const docs = [];
      snapshot.docs.forEach((d) => {
        ids.add(d.id);
        docs.push({ id: d.id, ...d.data() });
      });
      visitedIds.value = ids;
      visitedShops.value = docs;
      fetched = true;
    } catch (e) {
      console.error('Failed to fetch visited_stores:', e);
    }
  }

  async function markVisited(shop) {
    const id = shop.id;
    if (!id) return;
    const payload = {
      shopId: id,
      name: shop.name || shop.company_name || '',
      shop_type: shop.shop_type || null,
      source: shop.source || null,
      latitude: shop.latitude ?? null,
      longitude: shop.longitude ?? null,
      formatted_address: shop.formatted_address || null,
      street: shop.street || null,
      municipality: shop.municipality || null,
      state: shop.state || null,
      phone: shop.phone || null,
      website: shop.website || null,
      rating: shop.rating ?? null,
      review_count: shop.review_count ?? null,
      purchases: shop.purchases ?? null,
      average_order: shop.average_order ?? null,
      google_maps_url: shop.google_maps_url || null,
      visitedAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'visited_stores', id), payload);
    visitedIds.value = new Set([...visitedIds.value, id]);
    visitedShops.value = [...visitedShops.value.filter((s) => s.id !== id), { id, ...payload }];
  }

  async function unmarkVisited(shop) {
    const id = shop.id;
    if (!id) return;
    await deleteDoc(doc(db, 'visited_stores', id));
    const next = new Set(visitedIds.value);
    next.delete(id);
    visitedIds.value = next;
    visitedShops.value = visitedShops.value.filter((s) => s.id !== id);
  }

  async function toggleVisited(shop) {
    if (visitedIds.value.has(shop.id)) {
      await unmarkVisited(shop);
    } else {
      await markVisited(shop);
    }
  }

  return { visitedIds, visitedShops, fetchVisited, toggleVisited, markVisited, unmarkVisited };
}
