// Shared backend utilities for data.gov.sg and OneMap API integration

// In-memory token cache for OneMap
let cachedOneMapToken = null;
let oneMapTokenExpiry = 0; // Timestamp ms

// In-memory geocode cache to avoid repeated geocoding requests
const geocodeCache = new Map();

// Helper: HTTP fetch with 429 backoff and retry
export async function fetchWithRetry(url, options = {}, backoffMs = 1200) {
  let res = await fetch(url, options);
  if (res.status === 429) {
    // Back off and retry once
    await new Promise((resolve) => setTimeout(resolve, backoffMs));
    res = await fetch(url, options);
  }
  return res;
}

// Queue for throttling geocoding requests to OneMap
const MAX_CONCURRENT_GEOCODE = 3;
let activeGeocodes = 0;
const geocodeQueue = [];

function processGeocodeQueue() {
  while (activeGeocodes < MAX_CONCURRENT_GEOCODE && geocodeQueue.length > 0) {
    const item = geocodeQueue.shift();
    if (!item) break;
    activeGeocodes++;
    setTimeout(async () => {
      try {
        const res = await item.fn();
        item.resolve(res);
      } catch (err) {
        item.reject(err);
      } finally {
        activeGeocodes--;
        processGeocodeQueue();
      }
    }, 150);
  }
}

export function enqueueGeocode(fn) {
  return new Promise((resolve, reject) => {
    geocodeQueue.push({ fn, resolve, reject });
    processGeocodeQueue();
  });
}

// OneMap search geocoding logic
export async function searchOneMap(searchVal) {
  const normalizedSearch = String(searchVal || '').trim();
  if (!normalizedSearch) {
    return { status: 400, error: "Search value must not be empty." };
  }

  const cacheKey = normalizedSearch.toUpperCase();
  if (geocodeCache.has(cacheKey)) {
    return { status: 200, data: geocodeCache.get(cacheKey) };
  }

  const searchUrl = `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encodeURIComponent(
    normalizedSearch
  )}&returnGeom=Y&getAddrDetails=Y&pageNum=1`;

  // Step 1: Call Search without a token
  // If we already hold an unexpired cached token, we can pass it if previously authenticated;
  // but per instruction: call Search without a token. Only if OneMap answers 401/403, obtain a token and retry once.
  let headers = {};
  const now = Date.now();
  if (cachedOneMapToken && oneMapTokenExpiry > now) {
    headers['Authorization'] = `Bearer ${cachedOneMapToken}`;
  }

  let res = await fetchWithRetry(searchUrl, { headers });

  // If 401 or 403, authenticate and retry once
  if (res.status === 401 || res.status === 403) {
    const email = process.env.ONEMAP_EMAIL;
    const password = process.env.ONEMAP_PASSWORD;

    if (!email || !password) {
      return {
        status: 503,
        error: "OneMap authentication credentials are not configured on the server."
      };
    }

    // Obtain token from OneMap authentication endpoint
    const tokenRes = await fetchWithRetry('https://www.onemap.gov.sg/api/auth/post/getToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!tokenRes.ok) {
      return {
        status: tokenRes.status,
        error: `OneMap token authentication failed with status ${tokenRes.status}.`
      };
    }

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return {
        status: 502,
        error: "OneMap did not return an access token."
      };
    }

    cachedOneMapToken = tokenData.access_token;
    // JWT token is valid for 3 days (72 hours). Buffer by 1 hour.
    let expiryMs = 71 * 60 * 60 * 1000;
    if (tokenData.expiry_timestamp) {
      const parsed = Date.parse(tokenData.expiry_timestamp);
      if (!Number.isNaN(parsed) && parsed > Date.now()) {
        expiryMs = Math.max(60000, parsed - Date.now() - 60000);
      }
    }
    oneMapTokenExpiry = Date.now() + expiryMs;

    // Retry Search once with token
    res = await fetchWithRetry(searchUrl, {
      headers: { Authorization: `Bearer ${cachedOneMapToken}` }
    });
  }

  // AFTER every fetch, check response.ok before reading the body
  if (!res.ok) {
    return {
      status: res.status,
      error: `OneMap Search upstream returned status ${res.status}: ${res.statusText || 'Request failed'}.`
    };
  }

  const rawJson = await res.json();
  const rawResults = Array.isArray(rawJson?.results) ? rawJson.results : [];
  const parsedResults = [];

  for (const item of rawResults) {
    const lat = Number(item.LATITUDE);
    const lng = Number(item.LONGITUDE);

    // Never emit NaN or null as a coordinate
    if (
      typeof lat !== 'number' ||
      Number.isNaN(lat) ||
      !Number.isFinite(lat) ||
      typeof lng !== 'number' ||
      Number.isNaN(lng) ||
      !Number.isFinite(lng)
    ) {
      continue;
    }

    const xVal = Number(item.X);
    const yVal = Number(item.Y);

    parsedResults.push({
      searchVal: String(item.SEARCHVAL || ''),
      block: String(item.BLK_NO || ''),
      roadName: String(item.ROAD_NAME || ''),
      building: String(item.BUILDING || ''),
      address: String(item.ADDRESS || ''),
      postal: String(item.POSTAL || ''),
      latitude: lat,
      longitude: lng,
      x: Number.isFinite(xVal) ? xVal : undefined,
      y: Number.isFinite(yVal) ? yVal : undefined
    });
  }

  const payload = {
    found: parsedResults.length,
    totalNumPages: Number(rawJson?.totalNumPages) || 1,
    pageNum: Number(rawJson?.pageNum) || 1,
    results: parsedResults
  };

  // Cache clean results in memory
  geocodeCache.set(cacheKey, payload);

  return { status: 200, data: payload };
}

// Compute median safely without emitting NaN or null
export function computeMedian(numbers) {
  if (!Array.isArray(numbers) || numbers.length === 0) {
    return 0;
  }
  const valid = numbers.filter((n) => typeof n === 'number' && Number.isFinite(n) && !Number.isNaN(n));
  if (valid.length === 0) return 0;
  valid.sort((a, b) => a - b);
  const mid = Math.floor(valid.length / 2);
  if (valid.length % 2 === 1) {
    return valid[mid];
  }
  return Math.round((valid[mid - 1] + valid[mid]) / 2);
}

// Universal query parameter extractor for Express and Vercel
export function extractQuery(req) {
  if (req.query && typeof req.query === 'object' && Object.keys(req.query).length > 0) {
    return req.query;
  }
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    return Object.fromEntries(url.searchParams.entries());
  } catch {
    return {};
  }
}
