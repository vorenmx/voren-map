import { ref } from 'vue';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  serverTimestamp,
  arrayUnion,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db, auth } from '../firebase/config.js';

// ── Shared singleton state ──────────────────────────────────
const visitedIds       = ref(new Set());  // shops where status === 'visitada'
const visitedStatusMap = ref(new Map()); // shopId → visited_status string
const visitedShops     = ref([]);
let fetched = false;

export function useVisited() {

  // ── Fetch ──────────────────────────────────────────────────
  async function fetchVisited() {
    if (fetched) return;
    try {
      const snapshot = await getDocs(collection(db, 'visited_stores'));
      const vIds  = new Set();
      const vsMap = new Map();
      const docs  = [];

      snapshot.docs.forEach((d) => {
        const data = { id: d.id, ...d.data() };
        docs.push(data);
        if (data.status === 'visitada') {
          vIds.add(d.id);
          if (data.visited_status) vsMap.set(d.id, data.visited_status);
        }
      });

      visitedIds.value       = vIds;
      visitedStatusMap.value = vsMap;
      visitedShops.value     = docs;
      fetched = true;
    } catch (e) {
      console.error('Failed to fetch visited_stores:', e);
    }
  }

  // ── Exclusive visited-status select ────────────────────────
  // visited_status: 'visita_exitosa' | 'cerrada' | 'cerrada_permanentemente'
  // Selecting the active one deselects it (→ no_visitada).
  async function setExclusiveStatus(shop, visitedStatus) {
    const id = shop.id;
    if (!id) return;

    const currentVStatus     = visitedStatusMap.value.get(id);
    const isCurrentlyVisited = visitedIds.value.has(id);
    const alreadySet         = isCurrentlyVisited && currentVStatus === visitedStatus;

    if (alreadySet) {
      // Deselect
      await setDoc(doc(db, 'visited_stores', id), {
        userId:         auth.currentUser?.uid ?? null,
        status:         'no_visitada',
        visited_status: null,
        statusAt:       serverTimestamp(),
      }, { merge: true });

      const newVIds = new Set(visitedIds.value);
      newVIds.delete(id);
      visitedIds.value = newVIds;

      const newMap = new Map(visitedStatusMap.value);
      newMap.delete(id);
      visitedStatusMap.value = newMap;

      _upsertLocal(id, { status: 'no_visitada', visited_status: null });
    } else {
      // New selection — also record visitedAt if this is the first-ever visit
      const existingDoc = visitedShops.value.find((s) => s.id === id);
      const isFirstVisit = !existingDoc?.visitedAt;

      const shopMeta = isFirstVisit ? {
        userId:            auth.currentUser?.uid ?? null,
        shopId:            id,
        name:              shop.name              || shop.company_name || '',
        shop_type:         shop.shop_type         ?? null,
        source:            shop.source            ?? null,
        latitude:          shop.latitude          ?? null,
        longitude:         shop.longitude         ?? null,
        formatted_address: shop.formatted_address ?? null,
        street:            shop.street            ?? null,
        municipality:      shop.municipality      ?? null,
        state:             shop.state             ?? null,
        phone:             shop.phone             ?? null,
        website:           shop.website           ?? null,
        rating:            shop.rating            ?? null,
        review_count:      shop.review_count      ?? null,
        purchases:         shop.purchases         ?? null,
        average_order:     shop.average_order     ?? null,
        google_maps_url:   shop.google_maps_url   ?? null,
        visitedAt:         serverTimestamp(),
      } : {};

      const payload = {
        ...shopMeta,
        status:         'visitada',
        visited_status: visitedStatus,
        statusAt:       serverTimestamp(),
      };

      await setDoc(doc(db, 'visited_stores', id), payload, { merge: true });

      visitedIds.value = new Set([...visitedIds.value, id]);

      const newMap = new Map(visitedStatusMap.value);
      newMap.set(id, visitedStatus);
      visitedStatusMap.value = newMap;

      _upsertLocal(id, payload);
    }
  }

  // ── Survey ─────────────────────────────────────────────────
  async function updateSurvey(shopId, field, value) {
    if (!shopId) return;
    const logEntry = {
      field,
      value: value === null ? null : String(value),
      ts: Timestamp.now().toDate().toISOString(),
    };
    const payload = {
      userId:          auth.currentUser?.uid ?? null,
      [field]:         value,
      surveyLog:       arrayUnion(logEntry),
      surveyUpdatedAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'visited_stores', shopId), payload, { merge: true });
    const prevLog = Array.isArray(visitedShops.value.find((s) => s.id === shopId)?.surveyLog)
      ? visitedShops.value.find((s) => s.id === shopId).surveyLog
      : [];
    _upsertLocal(shopId, { [field]: value, surveyLog: [...prevLog, logEntry] });
  }

  // ── Migration v2: normalize docs to new status model ───────
  // Old model used: status='closed'|'permanently_closed', visitedAt present
  // New model uses: status='visitada'|'no_visitada', visited_status='visita_exitosa'|'cerrada'|'cerrada_permanentemente'
  async function migrateToNewStatusModel() {
    const KEY = 'status_model_v2_migrated';
    if (localStorage.getItem(KEY)) return;
    try {
      const snapshot = await getDocs(collection(db, 'visited_stores'));
      const batch = writeBatch(db);
      let count = 0;

      snapshot.docs.forEach((d) => {
        const data = d.data();
        // Already on new model
        if (data.status === 'visitada' || data.status === 'no_visitada') return;

        let newStatus       = 'no_visitada';
        let newVisitedStatus = null;

        if (data.status === 'closed') {
          newStatus        = 'visitada';
          newVisitedStatus = 'cerrada';
        } else if (data.status === 'permanently_closed') {
          newStatus        = 'visitada';
          newVisitedStatus = 'cerrada_permanentemente';
        } else if (data.visitedAt) {
          newStatus        = 'visitada';
          newVisitedStatus = 'visita_exitosa';
        }

        batch.set(doc(db, 'visited_stores', d.id), {
          userId:         auth.currentUser?.uid ?? null,
          status:         newStatus,
          visited_status: newVisitedStatus,
        }, { merge: true });
        count++;
      });

      if (count > 0) await batch.commit();
      localStorage.setItem(KEY, 'true');
      fetched = false;
      await fetchVisited();
      console.log(`Migration v2: updated ${count} docs`);
    } catch (e) {
      console.error('Migration v2 failed:', e);
    }
  }

  // ── Legacy: migrate from shop_statuses collection ──────────
  async function migrateFromShopStatuses() {
    const KEY = 'shop_statuses_migrated_v1';
    if (localStorage.getItem(KEY)) return;
    try {
      const snapshot = await getDocs(collection(db, 'shop_statuses'));
      if (snapshot.empty) {
        localStorage.setItem(KEY, 'true');
        return;
      }
      const batch = writeBatch(db);
      snapshot.docs.forEach((d) => {
        const { status, statusAt } = d.data();
        let newVisitedStatus = 'visita_exitosa';
        if (status === 'closed')              newVisitedStatus = 'cerrada';
        if (status === 'permanently_closed')  newVisitedStatus = 'cerrada_permanentemente';
        batch.set(doc(db, 'visited_stores', d.id), {
          userId:         auth.currentUser?.uid ?? null,
          status:         'visitada',
          visited_status: newVisitedStatus,
          statusAt,
        }, { merge: true });
      });
      await batch.commit();
      localStorage.setItem(KEY, 'true');
      fetched = false;
      await fetchVisited();
      console.log(`Migrated ${snapshot.size} docs from shop_statuses`);
    } catch (e) {
      console.error('shop_statuses migration failed:', e);
    }
  }

  // ── Internal ───────────────────────────────────────────────
  function _upsertLocal(id, patch) {
    const existing = visitedShops.value.find((s) => s.id === id);
    if (existing) {
      visitedShops.value = visitedShops.value.map((s) =>
        s.id === id ? { ...s, ...patch } : s
      );
    } else {
      visitedShops.value = [...visitedShops.value, { id, ...patch }];
    }
  }

  return {
    visitedIds,
    visitedStatusMap,
    visitedShops,
    fetchVisited,
    setExclusiveStatus,
    updateSurvey,
    migrateFromShopStatuses,
    migrateToNewStatusModel,
  };
}
