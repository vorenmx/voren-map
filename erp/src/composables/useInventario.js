import { ref } from 'vue';
import {
  collection, doc, getDoc, getDocs, setDoc, addDoc, serverTimestamp,
  query, where,
} from 'firebase/firestore';
import { db, auth } from '../firebase/config.js';

const ALMACEN_DEFAULT = 'principal';

const items = ref([]);
const stock = ref(new Map());     // itemId_almacenId -> stock doc
const almacenes = ref([]);
const cargando = ref(false);
let cargado = false;

function stockId(itemId, almacenId) { return `${itemId}_${almacenId}`; }

export function useInventario() {
  async function fetchInventario(force = false) {
    if (cargado && !force) return;
    cargando.value = true;
    try {
      const [itemsSnap, stockSnap, almSnap] = await Promise.all([
        getDocs(collection(db, 'inventory_items')),
        getDocs(collection(db, 'inventory_stock')),
        getDocs(collection(db, 'almacenes')),
      ]);
      items.value = itemsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const m = new Map();
      stockSnap.docs.forEach((d) => m.set(d.id, { id: d.id, ...d.data() }));
      stock.value = m;
      almacenes.value = almSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (almacenes.value.length === 0) {
        await setDoc(doc(db, 'almacenes', ALMACEN_DEFAULT), {
          nombre: 'Almacén principal', ubicacion: '', activo: true,
        }, { merge: true });
        almacenes.value = [{ id: ALMACEN_DEFAULT, nombre: 'Almacén principal', activo: true }];
      }
      cargado = true;
    } finally {
      cargando.value = false;
    }
  }

  function stockDe(itemId, almacenId = ALMACEN_DEFAULT) {
    const s = stock.value.get(stockId(itemId, almacenId));
    return {
      cantidad: s?.cantidad ?? 0,
      reservado: s?.reservado ?? 0,
      disponible: Math.max(0, (s?.cantidad ?? 0) - (s?.reservado ?? 0)),
      stock_bajo: s?.stock_bajo ?? false,
    };
  }

  async function guardarItem(item) {
    const payload = {
      sku: item.sku ?? null,
      codigos_barras: Array.isArray(item.codigos_barras)
        ? item.codigos_barras.filter(Boolean)
        : (item.codigos_barras ? [item.codigos_barras] : []),
      nombre: item.nombre ?? '',
      categoria: item.categoria ?? null,
      descripcion: item.descripcion ?? null,
      unidad: item.unidad ?? 'pza',
      costo_unitario: Number(item.costo_unitario) || 0,
      precio_venta: Number(item.precio_venta) || 0,
      stock_minimo: Number(item.stock_minimo) || 0,
      activo: item.activo !== false,
      publicar_ecommerce: !!item.publicar_ecommerce,
      imagen_url: item.imagen_url ?? null,
      actualizado_en: serverTimestamp(),
    };
    const ref = item.id ? doc(db, 'inventory_items', item.id) : doc(collection(db, 'inventory_items'));
    await setDoc(ref, payload, { merge: true });
    await fetchInventario(true);
    return ref.id;
  }

  /** Creates a movement; the Cloud Function updates stock atomically. */
  async function registrarMovimiento({ itemId, almacenId = ALMACEN_DEFAULT, tipo, cantidad, motivo, referencia }) {
    await addDoc(collection(db, 'inventory_movements'), {
      itemId,
      almacenId,
      tipo,
      cantidad: Number(cantidad),
      motivo: motivo ?? null,
      referencia: referencia ?? null,
      usuarioEmail: auth.currentUser?.email?.toLowerCase() ?? null,
      fecha: serverTimestamp(),
    });
  }

  async function buscarPorCodigo(codigo) {
    const c = String(codigo).trim();
    if (!c) return null;
    const local = items.value.find((i) => (i.codigos_barras || []).includes(c) || i.sku === c);
    if (local) return local;
    const q = query(collection(db, 'inventory_items'), where('codigos_barras', 'array-contains', c));
    const snap = await getDocs(q);
    if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() };
    return null;
  }

  async function historialMovimientos(itemId) {
    const q = query(collection(db, 'inventory_movements'), where('itemId', '==', itemId));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.fecha?.seconds || 0) - (a.fecha?.seconds || 0));
  }

  return {
    items, stock, almacenes, cargando, ALMACEN_DEFAULT,
    fetchInventario, stockDe, guardarItem, registrarMovimiento,
    buscarPorCodigo, historialMovimientos,
  };
}
