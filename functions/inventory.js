/**
 * Inventory (Almacen) server-side integrity.
 *
 * Stock lives in `inventory_stock/{itemId_almacenId}` and is only ever changed
 * as a side effect of an immutable `inventory_movements` ledger entry. Applying
 * a movement runs in a Firestore transaction so client math is never trusted
 * and concurrent movements cannot oversell.
 */

const VALID_TIPOS = new Set(['entrada', 'salida', 'ajuste']);

export function stockDocId(itemId, almacenId) {
  return `${itemId}_${almacenId}`;
}

/**
 * Applies a single inventory movement to the per-warehouse stock row.
 *
 * - entrada: cantidad += movimiento.cantidad
 * - salida:  cantidad -= movimiento.cantidad (no baja de 0)
 * - ajuste:  cantidad  = movimiento.cantidad (set absolute)
 *
 * Also recomputes the `stock_bajo` flag against the item master `stock_minimo`.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {object} mov - inventory_movements document data
 */
export async function applyMovement(db, mov) {
  const { itemId, almacenId, tipo } = mov;
  const cantidad = Number(mov.cantidad);

  if (!itemId || !almacenId) throw new Error('Movimiento sin itemId o almacenId');
  if (!VALID_TIPOS.has(tipo)) throw new Error(`Tipo de movimiento invalido: ${tipo}`);
  if (Number.isNaN(cantidad)) throw new Error('Cantidad invalida');

  const itemRef = db.collection('inventory_items').doc(itemId);
  const stockRef = db.collection('inventory_stock').doc(stockDocId(itemId, almacenId));

  return db.runTransaction(async (tx) => {
    const [itemSnap, stockSnap] = await Promise.all([tx.get(itemRef), tx.get(stockRef)]);

    const stockMinimo = Number(itemSnap.data()?.stock_minimo) || 0;
    const actual = Number(stockSnap.data()?.cantidad) || 0;
    const reservado = Number(stockSnap.data()?.reservado) || 0;

    let nueva;
    if (tipo === 'entrada') nueva = actual + cantidad;
    else if (tipo === 'salida') nueva = Math.max(0, actual - cantidad);
    else nueva = cantidad; // ajuste

    tx.set(
      stockRef,
      {
        itemId,
        almacenId,
        cantidad: nueva,
        reservado,
        stock_bajo: nueva <= stockMinimo,
        actualizado_en: new Date().toISOString(),
      },
      { merge: true }
    );

    return { itemId, almacenId, anterior: actual, nueva };
  });
}
