/**
 * Maps a Firestore visited_stores document + shops document to an Odoo crm.lead payload.
 *
 * @param {string} shopId  - Firestore document ID (used as x_voren_shop_id)
 * @param {object} visited - Data from visited_stores/{shopId}
 * @param {object} shop    - Data from shops/{shopId}
 * @returns {object} Odoo crm.lead field values ready for create/write
 */
export function mapToOdooLead(shopId, visited, shop) {
  const arr = (v) => (Array.isArray(v) ? v : v ? [v] : []);
  const str = (v) => (v != null && v !== '' ? v : null);
  const num = (v) => (v != null && !Number.isNaN(Number(v)) ? v : null);

  // Firestore Timestamps have a toDate() method; plain Date objects and ISO strings work too.
  const toOdooDate = (v) => {
    if (!v) return null;
    try {
      const d = typeof v.toDate === 'function' ? v.toDate() : new Date(v);
      if (isNaN(d.getTime())) return null;
      return d.toISOString().slice(0, 10); // YYYY-MM-DD
    } catch {
      return null;
    }
  };

  return {
    // ── Standard CRM lead fields ─────────────────────────────
    name: shop.name || shop.company_name || shopId,
    partner_name: shop.name || shop.company_name || shopId,
    phone: str(shop.phone),
    email_from: str(shop.email),
    website: str(shop.website),
    street: str(shop.formatted_address || shop.street),
    city: str(shop.municipality),
    country_id: 156, // Mexico — fixed
    // state_id is resolved dynamically in odooClient by looking up shop.state

    // ── Custom Voren fields ───────────────────────────────────
    x_voren_shop_id: shopId,
    x_shop_type: str(shop.shop_type),
    x_score_general: num(visited.score_general),
    x_score_pains: num(visited.score_pains),
    x_score_probabilidad: num(visited.score_probabilidad),
    x_score_satisfaccion: num(visited.score_satisfaccion),
    x_tamano_tienda: str(visited.tamano_tienda),
    x_credito: str(visited.credito),
    x_metodo_pago: str(arr(visited.metodo_pago).join(', ')),
    x_entrega: str(visited.entrega),
    x_principal_proveedor: str(arr(visited.principal_proveedor).join(', ')),
    x_contacto_personal: str(visited.contacto_personal),
    x_comentarios: str(visited.comentarios),
    x_visitado_por: str(visited.visitedByEmail),
    x_fuente_datos: str(shop.source),
    x_google_maps_url: str(shop.google_maps_url),
    x_purchases: num(shop.purchases),
    x_average_order: num(shop.average_order),
    x_fecha_visita: toOdooDate(visited.visitedAt),
  };
}

/**
 * Returns the state name from a shop document, used to look up state_id in Odoo.
 * @param {object} shop
 * @returns {string|null}
 */
export function getStateName(shop) {
  return shop.state || null;
}
