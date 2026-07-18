/**
 * E-commerce catalog publisher.
 *
 * The storefront lives in a SEPARATE Firebase project (public trust boundary).
 * Cloud Functions in voren-map write to vorencommx `catalogo/{itemId}` using
 * Application Default Credentials (the Functions runtime SA). That SA must have
 * Cloud Datastore User (or equivalent) on vorencommx — no JSON private key needed.
 *
 * Optional fallback: if opts.storeServiceAccount is a full service-account JSON
 * (project_id + private_key + client_email), that cert is used instead (local/dev).
 *
 * IMPORTANT: never publish cost, supplier, or margin fields. Only sellable
 * data (name, price, image, available quantity, product copy).
 */

import admin from 'firebase-admin';

const STORE_APP_NAME = 'vorencommx-store';
const DEFAULT_STORE_PROJECT_ID = 'vorencommx';

/**
 * Sums available quantity (cantidad - reservado) across all warehouses for an
 * item. With a single warehouse this is just that one row.
 */
export async function availableQtyForItem(db, itemId) {
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
    grupo: item.grupo ?? item.categoria ?? null,
    categoria: item.categoria ?? item.grupo ?? null,
    especificacion: item.especificacion ?? null,
    funcionalidad: item.funcionalidad ?? null,
    medidas: item.medidas ?? null,
    compatibilidad: item.compatibilidad ?? null,
    comentarios: item.comentarios ?? null,
    descripcion: item.descripcion ?? null,
    precio: Number(item.precio_venta) || 0,
    imagen_url: item.imagen_url ?? null,
    disponible,
    actualizado_en: new Date().toISOString(),
  };
}

/**
 * Optional JSON service-account override (dev / legacy). Returns null if the
 * string is missing, `{}`, or incomplete.
 */
function credentialFromJson(serviceAccountJson) {
  if (!serviceAccountJson || !String(serviceAccountJson).trim()) return null;
  let cred;
  try {
    cred = JSON.parse(serviceAccountJson);
  } catch {
    return null;
  }
  if (!cred.project_id || !cred.private_key || !cred.client_email) return null;
  return cred;
}

/**
 * Firestore handle for the storefront project (vorencommx).
 *
 * Prefer ADC (Cloud Functions compute SA + cross-project IAM). Optionally
 * accept a full service-account JSON via opts.storeServiceAccount.
 *
 * @param {{ storeServiceAccount?: string, storeProjectId?: string }} [opts]
 */
export function getStoreFirestore(opts = {}) {
  const cred = credentialFromJson(opts.storeServiceAccount);
  const projectId =
    cred?.project_id ||
    opts.storeProjectId ||
    process.env.STORE_PROJECT_ID ||
    DEFAULT_STORE_PROJECT_ID;

  let app;
  try {
    app = admin.app(STORE_APP_NAME);
  } catch {
    app = admin.initializeApp(
      {
        credential: cred
          ? admin.credential.cert(cred)
          : admin.credential.applicationDefault(),
        projectId,
      },
      STORE_APP_NAME
    );
  }
  return app.firestore();
}

/**
 * Writes or deletes the public catalog doc in the storefront project.
 */
async function writeToStore(storeDb, itemId, payload) {
  const ref = storeDb.collection('catalogo').doc(itemId);
  if (!payload) {
    await ref.delete().catch(() => {});
    return { action: 'deleted' };
  }
  await ref.set(payload, { merge: true });
  return { action: 'upserted', disponible: payload.disponible };
}

/**
 * Computes and publishes the catalog entry for an item.
 * @param {FirebaseFirestore.Firestore} db - internal (voren-map) Firestore
 * @param {string} itemId
 * @param {object|undefined} item - inventory_items document data (after write)
 * @param {{ storeServiceAccount?: string, storeProjectId?: string }} [opts]
 */
export async function publishItemToCatalog(db, itemId, item, opts = {}) {
  if (!item) {
    try {
      const storeDb = getStoreFirestore(opts);
      await writeToStore(storeDb, itemId, null);
      console.log(`publicarCatalogo: item ${itemId} retirado del catalogo`);
    } catch (err) {
      console.error(`publicarCatalogo: failed to remove ${itemId}:`, err.message);
    }
    return null;
  }

  const disponible = await availableQtyForItem(db, itemId);
  const payload = buildPublicPayload(itemId, item, disponible);

  if (!payload) {
    try {
      const storeDb = getStoreFirestore(opts);
      await writeToStore(storeDb, itemId, null);
      console.log(`publicarCatalogo: item ${itemId} no publicable — retirado del catalogo`);
    } catch (err) {
      console.error(`publicarCatalogo: failed to unpublish ${itemId}:`, err.message);
    }
    return null;
  }

  try {
    const storeDb = getStoreFirestore(opts);
    const result = await writeToStore(storeDb, itemId, payload);
    console.log(`publicarCatalogo: ${result.action} ${itemId}`, result);
  } catch (err) {
    // Cross-project IAM missing / Firestore not enabled → log, don't crash the trigger.
    console.error(
      `publicarCatalogo: write failed for ${itemId} (check vorencommx IAM for compute SA):`,
      err.message
    );
    console.log(`publicarCatalogo: [fallback log] disponible=${disponible}`, payload);
  }
  return payload;
}

/**
 * Re-publishes catalog availability after a stock change for the given itemId.
 */
export async function republishStockChange(db, itemId, opts = {}) {
  if (!itemId) return null;
  const itemSnap = await db.collection('inventory_items').doc(itemId).get();
  const item = itemSnap.exists ? itemSnap.data() : null;
  return publishItemToCatalog(db, itemId, item, opts);
}
