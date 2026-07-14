import { ref } from 'vue';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db, auth } from '../firebase/config.js';

// Prefer same-origin Hosting rewrite (/api/...) so the function can stay
// private (avoids allUsers IAM / Domain Restricted Sharing deploy failures).
// Optional VITE_FUNCTIONS_BASE_URL overrides for local/dev against a direct URL.
const FUNCTIONS_BASE_URL = import.meta.env.VITE_FUNCTIONS_BASE_URL || '';

const analisis = ref([]);       // historical crm_insights docs (newest first)
const generando = ref(false);
const error = ref(null);

function analisisCrmUrl() {
  if (FUNCTIONS_BASE_URL) return `${FUNCTIONS_BASE_URL}/generarAnalisisCrm`;
  return '/api/generarAnalisisCrm';
}

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
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(analisisCrmUrl(), {
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
