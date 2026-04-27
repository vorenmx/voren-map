/**
 * Odoo JSON-2 API client for Firebase Cloud Functions.
 *
 * Odoo 19+ exposes a REST API at /json/2/{model}/{method}.
 * Authentication uses a Bearer API key — no separate auth/uid step needed.
 *
 * Docs: https://www.odoo.com/documentation/19.0/developer/reference/external_api.html
 */

import axios from 'axios';
import { mapToOdooLead, getStateName } from './fieldMap.js';

/**
 * Sends a JSON-2 request to Odoo.
 * @param {object} config  - { url, db, apiKey }
 * @param {string} model   - Odoo model technical name, e.g. 'crm.lead'
 * @param {string} method  - ORM method name, e.g. 'search', 'create', 'write'
 * @param {object} body    - Named method arguments as a plain JSON object
 * @returns {Promise<any>} Parsed JSON response from Odoo
 */
async function odooPost(config, model, method, body) {
  const url = `${config.url}/json/2/${model}/${method}`;
  const res = await axios.post(url, body, {
    headers: {
      'Authorization': `bearer ${config.apiKey}`,
      'X-Odoo-Database': config.db,
      'Content-Type': 'application/json; charset=utf-8',
      'User-Agent': 'voren-map-integration',
    },
    timeout: 30000,
    validateStatus: null, // handle all status codes manually
  });

  if (res.status !== 200) {
    const detail = res.data?.message || JSON.stringify(res.data);
    throw new Error(`Odoo ${res.status} on ${model}/${method}: ${detail}`);
  }

  return res.data;
}

/**
 * Looks up the Odoo state_id for a Mexican state name.
 * Returns null if not found (omitted fields are ignored by Odoo on create/write).
 */
async function resolveStateId(config, stateName) {
  if (!stateName) return null;
  const ids = await odooPost(config, 'res.country.state', 'search', {
    domain: [['name', 'ilike', stateName], ['country_id', '=', 156]],
    limit: 1,
  });
  return Array.isArray(ids) && ids.length > 0 ? ids[0] : null;
}

/**
 * Creates or updates a CRM lead in Odoo for the given shop.
 *
 * - Searches for an existing lead with x_voren_shop_id == shopId.
 * - If found: updates it with fresh field values.
 * - If not found: creates a new lead.
 *
 * @param {object} config   - { url, db, apiKey }
 * @param {string} shopId
 * @param {object} visited  - visited_stores document data
 * @param {object} shop     - shops document data
 * @returns {Promise<{leadId: number, action: 'created'|'updated'}>}
 */
export async function createOrUpdateLead(config, shopId, visited, shop) {
  const leadValues = mapToOdooLead(shopId, visited, shop);

  // Resolve state_id (many2one) from the shop's state name
  const stateName = getStateName(shop);
  if (stateName) {
    const stateId = await resolveStateId(config, stateName);
    if (stateId) leadValues.state_id = stateId;
  }

  // Check for an existing lead with this shop's Firestore ID
  const existingIds = await odooPost(config, 'crm.lead', 'search', {
    domain: [['x_voren_shop_id', '=', shopId]],
    limit: 1,
  });

  let leadId;
  let action;

  if (Array.isArray(existingIds) && existingIds.length > 0) {
    leadId = existingIds[0];
    await odooPost(config, 'crm.lead', 'write', {
      ids: [leadId],
      vals: leadValues,
    });
    action = 'updated';
  } else {
    const created = await odooPost(config, 'crm.lead', 'create', {
      vals_list: [leadValues],
    });
    leadId = Array.isArray(created) ? created[0] : created;
    action = 'created';
  }

  if (!leadId) throw new Error('Odoo returned no lead ID after create/write');
  return { leadId, action };
}
