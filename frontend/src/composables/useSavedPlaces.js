import { ref } from 'vue';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '../firebase/config.js';

const savedPlaces = ref([]);
let fetched = false;

export function useSavedPlaces() {
  async function fetchSavedPlaces() {
    if (fetched) return;
    try {
      const snapshot = await getDocs(collection(db, 'saved_places'));
      savedPlaces.value = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      fetched = true;
    } catch (e) {
      console.error('Failed to fetch saved_places:', e);
    }
  }

  // Derive a stable document ID from place_id or coordinates
  function placeDocId(place) {
    if (place.place_id) return place.place_id;
    return `${String(place.lat).replace('.', '_')}_${String(place.lng).replace('.', '_')}`;
  }

  async function savePlace(place, description) {
    const id = placeDocId(place);
    const payload = {
      userId: auth.currentUser?.uid ?? null,
      name: place.name || '',
      description: description || '',
      formatted_address: place.formatted_address || '',
      lat: place.lat,
      lng: place.lng,
      place_id: place.place_id || null,
      savedAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'saved_places', id), payload);
    savedPlaces.value = [
      ...savedPlaces.value.filter((p) => p.id !== id),
      { id, ...payload },
    ];
    return id;
  }

  async function updateDescription(id, description) {
    const existing = savedPlaces.value.find((p) => p.id === id);
    if (!existing) return;
    const updated = { ...existing, description };
    await setDoc(doc(db, 'saved_places', id), updated);
    savedPlaces.value = savedPlaces.value.map((p) => (p.id === id ? { ...p, description } : p));
  }

  async function deletePlace(id) {
    await deleteDoc(doc(db, 'saved_places', id));
    savedPlaces.value = savedPlaces.value.filter((p) => p.id !== id);
  }

  function getSaved(place) {
    const id = placeDocId(place);
    return savedPlaces.value.find((p) => p.id === id) ?? null;
  }

  return { savedPlaces, fetchSavedPlaces, savePlace, updateDescription, deletePlace, getSaved, placeDocId };
}
