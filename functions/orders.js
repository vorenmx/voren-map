/**
 * Ecommerce → ERP order ingestion.
 *
 * Storefront (vorencommx) POSTs a paid order here. We create:
 *   1. orders/{ecommerce_order_id}  — sale record for the ERP Pedidos view
 *   2. inventory_movements/eo_{orderId}_{itemId} — salida per line (idempotent)
 *
 * The existing aplicarMovimientoInventario trigger then decrements stock.
 */

import { FieldValue, Timestamp } from 'firebase-admin/firestore';

const DEFAULT_ALMACEN = 'principal';
const ECOMMERCE_USER = 'ecommerce@voren.com.mx';

/**
 * Validate and normalize the inbound order body.
 * Expected shape:
 * {
 *   orderId: string,
 *   customer?: { nombre?, email?, telefono?, direccion? },
 *   items: [{ sku, cantidad, precio? }],
 *   total?: number,
 *   currency?: string,
 *   paidAt?: string,
 *   meta?: object
 * }
 */
export function normalizeOrderPayload(body) {
  if (!body || typeof body !== 'object') throw new Error('Body inválido');
  const orderId = String(body.orderId || body.id || '').trim();
  if (!orderId) throw new Error('Falta orderId');

  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (rawItems.length === 0) throw new Error('Pedido sin items');

  const items = rawItems.map((it, idx) => {
    const sku = String(it.sku || '').trim();
    const cantidad = Number(it.cantidad ?? it.quantity);
    if (!sku) throw new Error(`Item[${idx}] sin sku`);
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      throw new Error(`Item[${idx}] cantidad inválida`);
    }
    return {
      sku,
      cantidad,
      precio: Number(it.precio ?? it.price) || 0,
      nombre: it.nombre || it.name || null,
    };
  });

  const customer = body.customer && typeof body.customer === 'object'
    ? {
        nombre: body.customer.nombre || body.customer.name || null,
        email: body.customer.email || null,
        telefono: body.customer.telefono || body.customer.phone || null,
        direccion: body.customer.direccion || body.customer.address || null,
      }
    : null;

  return {
    orderId,
    customer,
    items,
    total: body.total != null ? Number(body.total) : null,
    currency: body.currency || 'MXN',
    paidAt: body.paidAt || null,
    meta: body.meta && typeof body.meta === 'object' ? body.meta : null,
    almacenId: body.almacenId || DEFAULT_ALMACEN,
  };
}

function movementId(orderId, itemId) {
  const safeOrder = String(orderId).replace(/[\/\\]/g, '_');
  const safeItem = String(itemId).replace(/[\/\\]/g, '_');
  return `eo_${safeOrder}_${safeItem}`;
}

/**
 * Idempotent ingest: if the order doc already exists, return it without
 * creating duplicate movements.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {object} payload - from normalizeOrderPayload
 */
export async function ingestOrder(db, payload) {
  const orderRef = db.collection('orders').doc(payload.orderId);
  const existing = await orderRef.get();
  if (existing.exists) {
    return { orderId: payload.orderId, status: 'already_exists', order: existing.data() };
  }

  const lineItems = [];
  for (const it of payload.items) {
    let itemSnap = await db.collection('inventory_items').doc(it.sku).get();
    if (!itemSnap.exists) {
      const q = await db
        .collection('inventory_items')
        .where('sku', '==', it.sku)
        .limit(1)
        .get();
      if (q.empty) {
        throw new Error(`SKU no encontrado en inventario: ${it.sku}`);
      }
      itemSnap = q.docs[0];
    }
    const data = itemSnap.data();
    const itemId = itemSnap.id;
    const precio = it.precio || Number(data.precio_venta) || 0;
    lineItems.push({
      sku: it.sku,
      itemId,
      nombre: it.nombre || data.nombre || it.sku,
      cantidad: it.cantidad,
      precio,
      subtotal: Math.round(precio * it.cantidad * 100) / 100,
    });
  }

  const computedTotal = lineItems.reduce((s, li) => s + li.subtotal, 0);
  const total =
    payload.total != null && Number.isFinite(payload.total)
      ? payload.total
      : computedTotal;

  const movementIds = lineItems.map((li) => movementId(payload.orderId, li.itemId));
  const nowIso = new Date().toISOString();

  const orderDoc = {
    source: 'ecommerce',
    orderId: payload.orderId,
    customer: payload.customer,
    items: lineItems,
    total,
    currency: payload.currency,
    estado: 'pagado',
    almacenId: payload.almacenId,
    paidAt: payload.paidAt || nowIso,
    meta: payload.meta,
    movementIds,
    creado_en: nowIso,
    actualizado_en: nowIso,
  };

  const batch = db.batch();
  batch.create(orderRef, orderDoc);

  for (const li of lineItems) {
    const movRef = db
      .collection('inventory_movements')
      .doc(movementId(payload.orderId, li.itemId));
    batch.create(movRef, {
      itemId: li.itemId,
      almacenId: payload.almacenId,
      tipo: 'salida',
      cantidad: li.cantidad,
      motivo: 'Venta ecommerce',
      referencia: payload.orderId,
      usuarioEmail: ECOMMERCE_USER,
      fecha: Timestamp.now(),
      origen: 'ecommerce',
      creado_en: FieldValue.serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (err) {
    if (err.code === 6 || /ALREADY_EXISTS|already exists/i.test(err.message || '')) {
      const again = await orderRef.get();
      return { orderId: payload.orderId, status: 'already_exists', order: again.data() };
    }
    throw err;
  }

  return { orderId: payload.orderId, status: 'created', order: orderDoc, movementIds };
}
