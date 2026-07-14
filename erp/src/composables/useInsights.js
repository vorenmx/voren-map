import { ref } from 'vue';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db, auth } from '../firebase/config.js';

const FUNCTIONS_BASE_URL = import.meta.env.VITE_FUNCTIONS_BASE_URL || '';

const analisis = ref([]);       // historical crm_insights docs (newest first)
const generando = ref(false);
const error = ref(null);

export function useInsights() {
  async function fetchAnalisis() {
    const q = query(collection(db, 'crm_insights'), orderBy('generadoEn', 'desc'), limit(30));
    const snap = await getDocs(q);
    analisis.value = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  async function generarAnalisis() {
    error.value = null;
    generando.value = true;
    try {
      if (!FUNCTIONS_BASE_URL) {
        throw new Error('VITE_FUNCTIONS_BASE_URL no está configurado.');
      }
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${FUNCTIONS_BASE_URL}/generarAnalisisCrm`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Error ${res.status}`);
      }
      await fetchAnalisis();
    } catch (e) {
      error.value = e.message;
    } finally {
      generando.value = false;
    }
  }

  return { analisis, generando, error, fetchAnalisis, generarAnalisis };
}
