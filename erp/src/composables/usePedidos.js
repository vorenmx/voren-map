import { ref } from 'vue';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase/config.js';

const pedidos = ref([]);
const cargando = ref(false);
let cargado = false;

export function usePedidos() {
  async function fetchPedidos(force = false) {
    if (cargado && !force) return;
    cargando.value = true;
    try {
      let snap;
      try {
        snap = await getDocs(query(collection(db, 'orders'), orderBy('creado_en', 'desc')));
      } catch {
        // Fallback if index missing / empty: unsorted client-side.
        snap = await getDocs(collection(db, 'orders'));
      }
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      rows.sort((a, b) => String(b.creado_en || '').localeCompare(String(a.creado_en || '')));
      pedidos.value = rows;
      cargado = true;
    } finally {
      cargando.value = false;
    }
  }

  return { pedidos, cargando, fetchPedidos };
}
