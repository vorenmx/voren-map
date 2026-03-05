import axios from 'axios';
import { MEXICO_STATES, DENUE_KEYWORDS, RATE_LIMIT } from '../../config.js';
import { createRateLimiter } from '../utils/rateLimiter.js';
import { log, logProgress } from '../utils/logger.js';

const BASE_URL = 'https://www.inegi.org.mx/app/api/denue/v1/consulta';
const PAGE_SIZE = 2000;
const SOURCE = 'DENUE';

const throttle = createRateLimiter(RATE_LIMIT.DENUE_DELAY_MS);

function parseDenueRecord(raw) {
  return {
    source: 'denue',
    denue_id: raw.Id,
    name: raw.Nombre || '',
    company_name: raw.Razon_social || '',
    scian_description: raw.Clase_actividad || '',
    employee_range: raw.Estrato || '',
    road_type: raw.Tipo_vialidad || '',
    street: raw.Calle || '',
    street_number: raw.Num_Exterior || '',
    interior_number: raw.Num_Interior || '',
    neighborhood: raw.Colonia || '',
    zip: raw.CP || '',
    location_full: raw.Ubicacion || '',
    phone: raw.Telefono || '',
    email: raw.Correo_e || '',
    website: raw.Sitio_internet || '',
    establishment_type: raw.Tipo || '',
    longitude: parseFloat(raw.Longitud) || null,
    latitude: parseFloat(raw.Latitud) || null,
  };
}

function parseLocation(locationFull) {
  if (!locationFull) return { locality: '', municipality: '', state: '' };
  const parts = locationFull.split(',').map(s => s.trim());
  return {
    locality: parts[0] || '',
    municipality: parts[1] || '',
    state: parts[2] || '',
  };
}

async function fetchPage(keyword, stateCode, start, end, token) {
  const url = `${BASE_URL}/BuscarEntidad/${encodeURIComponent(keyword)}/${stateCode}/${start}/${end}/${token}`;
  await throttle();

  try {
    const { data } = await axios.get(url, { timeout: 30000 });
    if (!Array.isArray(data)) return [];
    return data;
  } catch (err) {
    if (err.response?.status === 404 || err.response?.status === 204) {
      return [];
    }
    log(SOURCE, `Error fetching ${keyword} state=${stateCode} [${start}-${end}]: ${err.message}`);
    return [];
  }
}

async function fetchAllForStateAndKeyword(keyword, stateCode, stateName, token) {
  const results = [];
  let start = 1;
  let hasMore = true;

  while (hasMore) {
    const end = start + PAGE_SIZE - 1;
    const page = await fetchPage(keyword, stateCode, start, end, token);

    if (page.length === 0) {
      hasMore = false;
    } else {
      results.push(...page);
      if (page.length < PAGE_SIZE) {
        hasMore = false;
      } else {
        start = end + 1;
      }
    }
  }

  if (results.length > 0) {
    log(SOURCE, `  "${keyword}" in ${stateName}: ${results.length} establishments`);
  }
  return results;
}

export async function extractDenueData(token) {
  log(SOURCE, `Starting extraction for ${MEXICO_STATES.length} states x ${DENUE_KEYWORDS.length} keywords`);

  const seenIds = new Set();
  const allRecords = [];
  const totalTasks = MEXICO_STATES.length * DENUE_KEYWORDS.length;
  let completedTasks = 0;

  for (const state of MEXICO_STATES) {
    for (const keyword of DENUE_KEYWORDS) {
      const rawResults = await fetchAllForStateAndKeyword(keyword, state.code, state.name, token);

      for (const raw of rawResults) {
        if (raw.Id && !seenIds.has(raw.Id)) {
          seenIds.add(raw.Id);
          const record = parseDenueRecord(raw);
          const loc = parseLocation(record.location_full);
          record.locality = loc.locality;
          record.municipality = loc.municipality;
          record.state = loc.state;
          allRecords.push(record);
        }
      }

      completedTasks++;
      if (completedTasks % 10 === 0) {
        logProgress(SOURCE, completedTasks, totalTasks, `| ${allRecords.length} unique records so far`);
      }
    }
  }

  log(SOURCE, `Extraction complete: ${allRecords.length} unique establishments from DENUE`);
  return allRecords;
}
