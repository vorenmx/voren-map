/**
 * SKU catalog importer: CSV (Storage) → inventory_items.
 *
 * Expected columns (Spanish header from Voren SKU sheet):
 *   SKU Interno, Grupo, Producto, Especificación, Funcionalidad,
 *   Medidas, Compatibilidad, Comentarios Técnicos y de Venta, Imagen
 *
 * Document ID = SKU Interno (stable natural key). Price/stock are NOT in the
 * CSV — set them later in the ERP Almacén screen (or via movements).
 */

import Papa from 'papaparse';

const BATCH_SIZE = 400;

/** Pick first non-empty value among candidate header names (encoding-safe). */
function cell(row, ...names) {
  for (const name of names) {
    if (row[name] != null && String(row[name]).trim() !== '') return String(row[name]).trim();
  }
  // Fallback: match by normalized key (handles mojibake / BOM)
  const keys = Object.keys(row);
  for (const name of names) {
    const want = name.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
    const hit = keys.find((k) => k.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '') === want);
    if (hit && row[hit] != null && String(row[hit]).trim() !== '') return String(row[hit]).trim();
  }
  return '';
}

export function mapSkuRow(row) {
  const sku = cell(row, 'SKU Interno', 'SKU', 'sku');
  if (!sku) return null;

  const nombre = cell(row, 'Producto', 'Nombre', 'nombre') || sku;
  const grupo = cell(row, 'Grupo', 'Categoria', 'Categoría', 'categoria') || null;
  const especificacion = cell(row, 'Especificación', 'Especificacion', 'especificacion') || null;
  const funcionalidad = cell(row, 'Funcionalidad', 'funcionalidad') || null;
  const medidas = cell(row, 'Medidas', 'medidas') || null;
  const compatibilidad = cell(row, 'Compatibilidad', 'compatibilidad') || null;
  const comentarios = cell(
    row,
    'Comentarios Técnicos y de Venta',
    'Comentarios Tecnicos y de Venta',
    'comentarios'
  ) || null;
  const imagen_url = cell(row, 'Imagen', 'imagen_url', 'Imagen URL') || null;

  // Build a short description from the richest available text for ERP list views.
  const descripcionParts = [especificacion, funcionalidad].filter(Boolean);
  const descripcion = descripcionParts.length ? descripcionParts.join(' — ') : null;

  return {
    sku,
    nombre,
    categoria: grupo,
    grupo,
    especificacion,
    funcionalidad,
    medidas,
    compatibilidad,
    comentarios,
    descripcion,
    imagen_url,
    unidad: 'pza',
    activo: true,
    // Default on so the storefront can list them once price/stock are set.
    // Cost/price stay 0 until an admin fills them in ERP.
    publicar_ecommerce: true,
    codigos_barras: [sku],
  };
}

/**
 * Parses CSV text and upserts inventory_items keyed by SKU.
 * Does not overwrite precio_venta / costo_unitario / stock_minimo if already set.
 */
export async function importSkuCsv(db, csvText, { clearFirst = false } = {}) {
  const { data: rows, errors } = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
  });
  if (errors.length > 0) {
    console.warn('importInventory parse warnings:', errors.slice(0, 5));
  }

  const mapped = rows.map(mapSkuRow).filter(Boolean);
  const bySku = new Map();
  for (const doc of mapped) bySku.set(doc.sku, doc);

  if (clearFirst) {
    console.log('Clearing inventory_items…');
    const existing = await db.collection('inventory_items').listDocuments();
    for (let i = 0; i < existing.length; i += BATCH_SIZE) {
      const batch = db.batch();
      existing.slice(i, i + BATCH_SIZE).forEach((ref) => batch.delete(ref));
      await batch.commit();
    }
  }

  // Preserve pricing fields on re-import when the doc already exists.
  const existingSnap = await db.collection('inventory_items').get();
  const existingBySku = new Map();
  existingSnap.forEach((d) => {
    const s = d.data()?.sku || d.id;
    if (s) existingBySku.set(s, { id: d.id, data: d.data() });
  });

  const entries = [...bySku.entries()];
  let written = 0;
  let created = 0;
  let updated = 0;

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = entries.slice(i, i + BATCH_SIZE);
    for (const [sku, doc] of chunk) {
      const prev = existingBySku.get(sku);
      const ref = db.collection('inventory_items').doc(sku);
      const payload = {
        ...doc,
        actualizado_en: new Date().toISOString(),
        importado_en: new Date().toISOString(),
      };
      if (prev?.data) {
        // Keep commercial fields already set in ERP.
        if (prev.data.precio_venta != null) payload.precio_venta = prev.data.precio_venta;
        else payload.precio_venta = 0;
        if (prev.data.costo_unitario != null) payload.costo_unitario = prev.data.costo_unitario;
        else payload.costo_unitario = 0;
        if (prev.data.stock_minimo != null) payload.stock_minimo = prev.data.stock_minimo;
        else payload.stock_minimo = 0;
        if (prev.data.publicar_ecommerce != null) {
          payload.publicar_ecommerce = prev.data.publicar_ecommerce;
        }
        if (prev.data.activo != null) payload.activo = prev.data.activo;
        if (Array.isArray(prev.data.codigos_barras) && prev.data.codigos_barras.length) {
          // Merge barcodes; always include SKU.
          const set = new Set([sku, ...prev.data.codigos_barras.filter(Boolean)]);
          payload.codigos_barras = [...set];
        }
        updated++;
      } else {
        payload.precio_venta = 0;
        payload.costo_unitario = 0;
        payload.stock_minimo = 0;
        created++;
      }
      batch.set(ref, payload, { merge: true });
    }
    await batch.commit();
    written += chunk.length;
    console.log(`importInventory: written ${written}/${entries.length}`);
  }

  return {
    parsed: rows.length,
    written: entries.length,
    created,
    updated,
    skipped: rows.length - mapped.length,
  };
}
