import axios from 'axios';
import { GOOGLE_SEARCH_KEYWORDS, CITY_SEARCH_POINTS, GOOGLE_SEARCH_RADIUS, RATE_LIMIT } from '../../config.js';
import { createRateLimiter } from '../utils/rateLimiter.js';
import { log, logProgress } from '../utils/logger.js';

const BASE_URL = 'https://places.googleapis.com/v1/places:searchText';
const SOURCE = 'GOOGLE';

const throttle = createRateLimiter(RATE_LIMIT.GOOGLE_DELAY_MS);

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.googleMapsUri',
  'places.rating',
  'places.userRatingCount',
  'places.businessStatus',
  'places.regularOpeningHours',
  'places.types',
].join(',');

function parseGooglePlace(place) {
  let hours = '';
  if (place.regularOpeningHours?.weekdayDescriptions) {
    hours = place.regularOpeningHours.weekdayDescriptions.join(' | ');
  }

  return {
    source: 'google',
    google_place_id: place.id || '',
    name: place.displayName?.text || '',
    formatted_address: place.formattedAddress || '',
    latitude: place.location?.latitude || null,
    longitude: place.location?.longitude || null,
    phone: place.nationalPhoneNumber || place.internationalPhoneNumber || '',
    website: place.websiteUri || '',
    google_maps_url: place.googleMapsUri || '',
    rating: place.rating || null,
    review_count: place.userRatingCount || 0,
    business_status: place.businessStatus || '',
    business_hours: hours,
    types: (place.types || []).join(', '),
  };
}

async function searchPlaces(keyword, cityPoint, apiKey, pageToken = null) {
  await throttle();

  const body = {
    textQuery: keyword,
    locationBias: {
      circle: {
        center: { latitude: cityPoint.lat, longitude: cityPoint.lng },
        radius: GOOGLE_SEARCH_RADIUS,
      },
    },
    languageCode: 'es',
    maxResultCount: 20,
  };

  if (pageToken) {
    body.pageToken = pageToken;
  }

  try {
    const { data } = await axios.post(BASE_URL, body, {
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': FIELD_MASK + ',nextPageToken',
      },
      timeout: 15000,
    });

    return {
      places: data.places || [],
      nextPageToken: data.nextPageToken || null,
    };
  } catch (err) {
    const status = err.response?.status;
    const msg = err.response?.data?.error?.message || err.message;
    log(SOURCE, `Error searching "${keyword}" near ${cityPoint.name}: [${status}] ${msg}`);
    return { places: [], nextPageToken: null };
  }
}

async function searchWithPagination(keyword, cityPoint, apiKey) {
  const allPlaces = [];
  let pageToken = null;
  let pageNum = 0;
  const maxPages = 3;

  do {
    const result = await searchPlaces(keyword, cityPoint, apiKey, pageToken);
    allPlaces.push(...result.places);
    pageToken = result.nextPageToken;
    pageNum++;

    if (pageToken && pageNum < maxPages) {
      await new Promise(r => setTimeout(r, 2000));
    }
  } while (pageToken && pageNum < maxPages);

  return allPlaces;
}

export async function extractGoogleMapsData(apiKey) {
  log(SOURCE, `Starting extraction for ${CITY_SEARCH_POINTS.length} cities x ${GOOGLE_SEARCH_KEYWORDS.length} keywords`);

  const seenPlaceIds = new Set();
  const allRecords = [];
  const totalTasks = CITY_SEARCH_POINTS.length * GOOGLE_SEARCH_KEYWORDS.length;
  let completedTasks = 0;
  let apiCalls = 0;

  for (const city of CITY_SEARCH_POINTS) {
    for (const keyword of GOOGLE_SEARCH_KEYWORDS) {
      const places = await searchWithPagination(keyword, city, apiKey);
      apiCalls++;

      for (const place of places) {
        if (place.id && !seenPlaceIds.has(place.id)) {
          seenPlaceIds.add(place.id);
          allRecords.push(parseGooglePlace(place));
        }
      }

      completedTasks++;
      if (completedTasks % 25 === 0) {
        logProgress(SOURCE, completedTasks, totalTasks, `| ${allRecords.length} unique places | ~${apiCalls} API calls`);
      }
    }
  }

  log(SOURCE, `Extraction complete: ${allRecords.length} unique places from Google Maps (~${apiCalls} API calls)`);
  return allRecords;
}
