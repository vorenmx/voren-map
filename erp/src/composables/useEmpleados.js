import { ref } from 'vue';
import {
  collection, doc, getDocs, setDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config.js';

const empleados = ref([]);
const cargando = ref(false);
let cargado = false;

export function useEmpleados() {
  async function fetchEmpleados(force = false) {
    if (cargado && !force) return;
    cargando.value = true;
    try {
      const snap = await getDocs(collection(db, 'empleados'));
      empleados.value = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      cargado = true;
    } finally {
      cargando.value = false;
    }
  }

  async function guardarEmpleado(emp) {
    const email = String(emp.email || '').toLowerCase().trim();
    if (!email) throw new Error('El email es obligatorio');
    const payload = {
      email,
      nombre: emp.nombre ?? email,
      rol: emp.rol ?? 'lectura',
      equipo: emp.equipo ?? null,
      gerenteEmail: emp.gerenteEmail ? String(emp.gerenteEmail).toLowerCase().trim() : null,
      territorio: emp.territorio ?? null,
      activo: emp.activo !== false,
      actualizado_en: serverTimestamp(),
    };
    if (!emp.id) payload.fechaIngreso = serverTimestamp();
    await setDoc(doc(db, 'empleados', email), payload, { merge: true });
    await fetchEmpleados(true);
  }

  /**
   * Derives per-rep activity from visited_stores joined on visitedByEmail /
   * crm_owner_email. Returns a map keyed by email.
   */
  async function actividadPorVendedor() {
    const snap = await getDocs(collection(db, 'visited_stores'));
    const acc = new Map();
    snap.docs.forEach((d) => {
      const v = d.data();
      const email = String(v.crm_owner_email || v.visitedByEmail || '').toLowerCase();
      if (!email) return;
      if (!acc.has(email)) {
        acc.set(email, { email, visitas: 0, exitosas: 0, scores: [], ultimaVisita: null });
      }
      const a = acc.get(email);
      a.visitas += 1;
      if (v.visited_status === 'visita_exitosa') a.exitosas += 1;
      if (typeof v.score_general === 'number') a.scores.push(v.score_general);
      const ts = v.statusAt?.toDate?.() || v.visitedAt?.toDate?.() || null;
      if (ts && (!a.ultimaVisita || ts > a.ultimaVisita)) a.ultimaVisita = ts;
    });
    const out = new Map();
    for (const [email, a] of acc) {
      out.set(email, {
        email,
        visitas: a.visitas,
        exitosas: a.exitosas,
        tasaExito: a.visitas ? Math.round((a.exitosas / a.visitas) * 100) : 0,
        promedioScore: a.scores.length
          ? Math.round((a.scores.reduce((x, y) => x + y, 0) / a.scores.length) * 10) / 10
          : null,
        ultimaVisita: a.ultimaVisita,
      });
    }
    return out;
  }

  return { empleados, cargando, fetchEmpleados, guardarEmpleado, actividadPorVendedor };
}
