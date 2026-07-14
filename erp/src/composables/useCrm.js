import { ref } from 'vue';
import {
  collection, collectionGroup, doc, getDocs, setDoc, addDoc, serverTimestamp, query, where,
} from 'firebase/firestore';
import { db, auth } from '../firebase/config.js';

export const ETAPAS = [
  { id: 'nuevo', label: 'Nuevo' },
  { id: 'contactado', label: 'Contactado' },
  { id: 'calificado', label: 'Calificado' },
  { id: 'propuesta', label: 'Propuesta' },
  { id: 'negociacion', label: 'Negociación' },
  { id: 'ganado', label: 'Ganado' },
  { id: 'perdido', label: 'Perdido' },
];

// Une varios teléfonos (tienda + informes) y elimina duplicados por sus
// últimos 10 dígitos, conservando el formato original de cada número.
export function combinarTelefonos(...valores) {
  const out = [];
  const vistos = new Set();
  for (const v of valores.flat(Infinity)) {
    const s = String(v ?? '').trim();
    if (!s) continue;
    const clave = s.replace(/\D/g, '').slice(-10) || s.toLowerCase();
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    out.push(s);
  }
  return out;
}

// Extrae los teléfonos/WhatsApp capturados en un informe (campo negocio).
export function telefonosDeInforme(negocio) {
  return combinarTelefonos(negocio?.telefonos, negocio?.whatsapp);
}

export const TIPO_NEGOCIO = {
  taller: 'Taller',
  refaccionaria: 'Refaccionaría',
  ambos: 'Ambos',
  otro: 'Otro',
};

// Clasifica el negocio como taller, refaccionaria o ambos. Prioriza el
// shop_type ya calculado en el pipeline de datos; si no existe, infiere a
// partir del nombre y las categorías de Google (types/scian_description).
export function clasificarTipo(lead) {
  const st = String(lead?.shop_type || '').toLowerCase();
  if (st === 'both') return 'ambos';
  if (st === 'repair') return 'taller';
  if (st === 'parts') return 'refaccionaria';

  const text = [lead?.name, lead?.company_name, lead?.types, lead?.scian_description, lead?.primaryType]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (!text) return 'otro';

  const esTaller = /(reparaci|taller|servicio|mecanic|mecánic|repair|motoserv|moto\s*servicio)/.test(text);
  const esRefa = /(refaccion|refaccionar|repuesto|\bpartes?\b|accesorio|\bparts\b)/.test(text);

  if (esTaller && esRefa) return 'ambos';
  if (esRefa) return 'refaccionaria';
  if (esTaller) return 'taller';
  return 'otro';
}

const leads = ref([]);
const cargando = ref(false);
let cargado = false;

export function useCrm() {
  async function fetchLeads(force = false) {
    if (cargado && !force) return;
    // Only show the blocking spinner on the very first load; background
    // refreshes keep the current board visible while data updates.
    const firstLoad = leads.value.length === 0;
    if (firstLoad) cargando.value = true;
    try {
      // Leads = visited stores marked as successful visits (they carry scores).
      const q = query(collection(db, 'visited_stores'), where('visited_status', '==', 'visita_exitosa'));
      const snap = await getDocs(q);
      leads.value = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          pipeline_stage: data.pipeline_stage || 'nuevo',
        };
      });
      cargado = true;
    } finally {
      cargando.value = false;
    }
  }

  async function cambiarEtapa(leadId, etapa) {
    await setDoc(
      doc(db, 'visited_stores', leadId),
      { pipeline_stage: etapa, crm_updated_at: new Date().toISOString() },
      { merge: true }
    );
    const l = leads.value.find((x) => x.id === leadId);
    if (l) l.pipeline_stage = etapa;
  }

  async function actualizarLead(leadId, campos) {
    const payload = { ...campos, crm_updated_at: new Date().toISOString() };
    if (campos.crm_owner_email) payload.crm_owner_email = String(campos.crm_owner_email).toLowerCase().trim();
    await setDoc(doc(db, 'visited_stores', leadId), payload, { merge: true });
    const l = leads.value.find((x) => x.id === leadId);
    if (l) Object.assign(l, payload);
  }

  async function guardarPrimeraVisita(leadId, datos) {
    const primera_visita = {
      ...datos,
      actualizado_por: auth.currentUser?.email?.toLowerCase() ?? null,
      actualizado_en: new Date().toISOString(),
    };
    await setDoc(
      doc(db, 'visited_stores', leadId),
      { primera_visita, crm_updated_at: new Date().toISOString() },
      { merge: true }
    );
    const l = leads.value.find((x) => x.id === leadId);
    if (l) l.primera_visita = primera_visita;
    return primera_visita;
  }

  // Resumen por lead en una sola consulta collectionGroup:
  // { [leadId]: { count, telefonos: [...] } }.
  async function fetchInformesResumen() {
    const snap = await getDocs(collectionGroup(db, 'informes'));
    const map = {};
    snap.forEach((d) => {
      const leadId = d.ref.parent.parent?.id;
      if (!leadId) return;
      const data = d.data();
      const entry = map[leadId] || (map[leadId] = { count: 0, telefonos: [], fechas: [] });
      entry.count += 1;
      entry.telefonos.push(...telefonosDeInforme(data.negocio));
      if (data.fecha) entry.fechas.push(data.fecha);
    });
    for (const k of Object.keys(map)) {
      map[k].telefonos = combinarTelefonos(map[k].telefonos);
      map[k].fechas = [...new Set(map[k].fechas)].sort();
    }
    return map;
  }

  async function fetchInformes(leadId) {
    const snap = await getDocs(collection(db, 'visited_stores', leadId, 'informes'));
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));
  }

  async function fetchActividades(leadId) {
    const snap = await getDocs(collection(db, 'visited_stores', leadId, 'actividades'));
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.fecha?.seconds || 0) - (a.fecha?.seconds || 0));
  }

  async function registrarActividad(leadId, tipo, nota) {
    await addDoc(collection(db, 'visited_stores', leadId, 'actividades'), {
      tipo,
      nota: nota || '',
      usuarioEmail: auth.currentUser?.email?.toLowerCase() ?? null,
      fecha: serverTimestamp(),
    });
    await setDoc(
      doc(db, 'visited_stores', leadId),
      { crm_updated_at: new Date().toISOString() },
      { merge: true }
    );
  }

  return { leads, cargando, fetchLeads, cambiarEtapa, actualizarLead, guardarPrimeraVisita, fetchInformesResumen, fetchInformes, fetchActividades, registrarActividad };
}
