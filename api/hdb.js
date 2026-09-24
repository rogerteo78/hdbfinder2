import { fetchWithRetry, computeMedian, extractQuery } from './_utils.js';

export default async function handler(req, res) {
  // Set cache headers as required:
  // Cache-Control: s-maxage=3600, stale-while-revalidate=86400
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');

  try {
    const query = extractQuery(req);
    const limit = Math.min(Math.max(Number(query.limit) || 100, 1), 1000);
    const offset = Math.max(Number(query.offset) || 0, 0);
    const sort = query.sort || 'month desc';
    const town = typeof query.town === 'string' ? query.town.trim() : '';
    const flatType = typeof query.flat_type === 'string' ? query.flat_type.trim() : '';
    const month = typeof query.month === 'string' ? query.month.trim() : '';
    const q = typeof query.q === 'string' ? query.q.trim() : '';

    const url = new URL('https://data.gov.sg/api/action/datastore_search');
    url.searchParams.set('resource_id', 'd_8b84c4ee58e3cfc0ece0d773c8ca6abc');
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('sort', sort);

    const filters = {};
    if (town) filters.town = town.toUpperCase();
    if (flatType) filters.flat_type = flatType.toUpperCase();
    if (month) filters.month = month;
    if (Object.keys(filters).length > 0) {
      url.searchParams.set('filters', JSON.stringify(filters));
    }
    if (q) {
      url.searchParams.set('q', q);
    }

    // data.gov.sg: if process.env.DATA_GOV_SG_API_KEY is set and non-empty, send it as the header x-api-key;
    // if not, call without it. Never send an empty or "undefined" header.
    const headers = {};
    if (typeof process.env.DATA_GOV_SG_API_KEY === 'string' && process.env.DATA_GOV_SG_API_KEY.trim() !== '') {
      headers['x-api-key'] = process.env.DATA_GOV_SG_API_KEY.trim();
    }

    // AFTER every fetch, check response.ok before reading the body; on a non-2xx reply return
    // the upstream status and a one-line reason in your own JSON. On 429, back off and retry once, then return 429 to the client.
    let upstreamRes = await fetchWithRetry(url.toString(), { headers });

    if (!upstreamRes.ok) {
      if (upstreamRes.status === 429) {
        return res.status(429).json({
          error: "data.gov.sg rate limit exceeded (429 Too Many Requests)."
        });
      }
      return res.status(upstreamRes.status).json({
        error: `data.gov.sg upstream returned status ${upstreamRes.status}: ${upstreamRes.statusText || 'Request failed'}.`
      });
    }

    const data = await upstreamRes.json();
    const rawRecords = Array.isArray(data?.result?.records) ? data.result.records : [];
    const validRecords = [];
    const prices = [];
    const psms = [];

    // Parse resale_price and floor_area_sqm as numbers; skip rows that fail to parse.
    // Never emit NaN or null as a price or coordinate.
    for (const row of rawRecords) {
      const resale_price = Number(row.resale_price);
      const floor_area_sqm = Number(row.floor_area_sqm);

      if (
        typeof resale_price !== 'number' ||
        Number.isNaN(resale_price) ||
        !Number.isFinite(resale_price) ||
        typeof floor_area_sqm !== 'number' ||
        Number.isNaN(floor_area_sqm) ||
        !Number.isFinite(floor_area_sqm)
      ) {
        continue;
      }

      const price_per_sqm = floor_area_sqm > 0 ? Math.round(resale_price / floor_area_sqm) : 0;

      validRecords.push({
        _id: row._id,
        month: String(row.month || ''),
        town: String(row.town || ''),
        flat_type: String(row.flat_type || ''),
        block: String(row.block || ''),
        street_name: String(row.street_name || ''),
        storey_range: String(row.storey_range || ''),
        floor_area_sqm,
        flat_model: String(row.flat_model || ''),
        lease_commence_date: String(row.lease_commence_date || ''),
        remaining_lease: String(row.remaining_lease || ''),
        resale_price,
        price_per_sqm
      });

      prices.push(resale_price);
      psms.push(price_per_sqm);
    }

    // Compute median ourselves:
    const median_price = computeMedian(prices);
    const median_psm = computeMedian(psms);
    const count = validRecords.length;

    let min_price = 0;
    let max_price = 0;
    let average_price = 0;

    if (count > 0) {
      min_price = Math.min(...prices);
      max_price = Math.max(...prices);
      const sum = prices.reduce((acc, p) => acc + p, 0);
      average_price = Math.round(sum / count);
    }

    // Ensure all statistics are never NaN or null
    return res.status(200).json({
      success: true,
      total: Number(data?.result?.total) || count,
      limit,
      offset,
      count,
      median_price: Number.isFinite(median_price) ? median_price : 0,
      average_price: Number.isFinite(average_price) ? average_price : 0,
      min_price: Number.isFinite(min_price) ? min_price : 0,
      max_price: Number.isFinite(max_price) ? max_price : 0,
      median_psm: Number.isFinite(median_psm) ? median_psm : 0,
      records: validRecords
    });
  } catch (err) {
    return res.status(500).json({
      error: `Internal server error while processing HDB request: ${err?.message || 'Unknown error'}`
    });
  }
}
