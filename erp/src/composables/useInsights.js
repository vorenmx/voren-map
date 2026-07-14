import { ref } from 'vue';
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  addDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '../firebase/config.js';

const semanal = ref([]);
const acumulado = ref([]);
const generando = ref(false);
const error = ref(null);

const JOB_TIMEOUT_MS = 6 * 60 * 1000;

async function fetchColeccion(nombre) {
  const q = query(collection(db, nombre), orderBy('generadoEn', 'desc'), limit(30));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

function waitForJob(jobRef) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      unsub();
      reject(new Error('Tiempo de espera agotado. Intenta de nuevo.'));
    }, JOB_TIMEOUT_MS);

    const unsub = onSnapshot(
      jobRef,
      (snap) => {
        const data = snap.data();
        if (!data) return;
        if (data.status === 'done') {
          clearTimeout(timer);
          unsub();
          resolve();
        } else if (data.status === 'error') {
          clearTimeout(timer);
          unsub();
          reject(new Error(data.error || 'Error al generar análisis'));
        }
      },
      (err) => {
        clearTimeout(timer);
        unsub();
        reject(err);
      }
    );
  });
}

export function useInsights() {
  async function fetchSemanal() {
    semanal.value = await fetchColeccion('crm_semanal');
  }

  async function fetchAcumulado() {
    acumulado.value = await fetchColeccion('crm_acumulado');
  }

  async function fetchAnalisis() {
    await Promise.all([fetchSemanal(), fetchAcumulado()]);
  }

  async function generarAnalisis() {
    error.value = null;
    generando.value = true;
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Debes iniciar sesión');

      // Firestore job queue: avoids HTTP/IAM issues with private Cloud Functions
      // under Domain Restricted Sharing (Hosting rewrites cannot invoke them).
      const jobRef = await addDoc(collection(db, 'crm_analysis_jobs'), {
        status: 'pending',
        requestedBy: user.email?.toLowerCase() ?? null,
        requestedAt: serverTimestamp(),
      });

      await waitForJob(jobRef);
      await fetchAnalisis();
    } catch (e) {
      error.value = e.message;
    } finally {
      generando.value = false;
    }
  }

  return {
    semanal,
    acumulado,
    generando,
    error,
    fetchSemanal,
    fetchAcumulado,
    fetchAnalisis,
    generarAnalisis,
  };
}
