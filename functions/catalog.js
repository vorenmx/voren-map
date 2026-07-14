/**
 * E-commerce catalog publisher (STUB).
 *
 * The storefront will live in a SEPARATE Firebase project (public trust
 * boundary). This module computes a public-safe product payload from the
 * internal inventory and is where the cross-project write will go once that
 * project exists. Until then it only logs.
 *
 * IMPORTANT: never publish cost, supplier, or margin fields. Only sellable
 * data (name, price, image, available quantity).
 */

/**
 * Sums available quantity (cantidad - reservado) across all warehouses for an
 * item. With a single warehouse this is just that one row.
 */
async function availableQtyForItem(db, itemId) {
  const stockSnap = await db
    .collection('inventory_stock')
    .where('itemId', '==', itemId)
    .get();
  let disponible = 0;
  stockSnap.docs.forEach((d) => {
    const s = d.data();
    disponible += Math.max(0, (Number(s.cantidad) || 0) - (Number(s.reservado) || 0));
  });
  return disponible;
}

/**
 * Builds the public-safe catalog entry for an item, or null if it should not
 * be listed.
 */
export function buildPublicPayload(itemId, item, disponible) {
  if (!item || !item.publicar_ecommerce || item.activo === false) return null;
  return {
    id: itemId,
    sku: item.sku ?? null,
    nombre: item.nombre ?? '',
    precio: Number(item.precio_venta) || 0,
    imagen_url: item.imagen_url ?? null,
    disponible,
    actualizado_en: new Date().toISOString(),
  };
}

/**
 * Computes and (eventually) publishes the catalog entry for an item.
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} itemId
 * @param {object|undefined} item - inventory_items document data (after write)
 */
export async function publishItemToCatalog(db, itemId, item) {
  if (!item) {
    console.log(`publicarCatalogo: item ${itemId} eliminado — pendiente retirar del catalogo`);
    return null;
  }

  const disponible = await availableQtyForItem(db, itemId);
  const payload = buildPublicPayload(itemId, item, disponible);

  if (!payload) {
    console.log(`publicarCatalogo: item ${itemId} no publicable (retirar si existia)`);
    return null;
  }

  // TODO: cross-project write to the e-commerce Firestore, e.g.
  //   const store = getStoreApp();
  //   await store.firestore().collection('catalogo').doc(itemId).set(payload);
  console.log(`publicarCatalogo: [stub] catalogo ${itemId} disponible=${disponible}`, payload);
  return payload;
}
