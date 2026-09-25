import { fetchWithRetry, computeMedian } from './_utils.js';

const HDB_RESOURCE_ID = 'd_8b84c4ee58e3cfc0ece0d773c8ca6abc';

/**
 * Retrieves, normalizes, and summarizes official HDB resale transaction data.
 * This is shared by the HTTP route and the MCP tools so both read the same upstream.
 */
export async function fetchHdbTransactions(query = {}) {
  try {
    const limit = Math.min(Math.max(Number(query.limit) || 100, 1), 1000);
    const offset = Math.max(Number(query.offset) || 0, 0);
    const sort = query.sort || 'month desc';
    const town = typeof query.town === 'string' ? query.town.trim() : '';
    const flatType = typeof query.flat_type === 'string' ? query.flat_type.trim() : '';
    const month = typeof query.month === 'string' ? query.month.trim() : '';
    const q = typeof query.q === 'string' ? query.q.trim() : '';

    const url = new URL('https://data.gov.sg/api/action/datastore_search');
    url.searchParams.set('resource_id', HDB_RESOURCE_ID);
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

    const headers = {};
    if (typeof process.env.DATA_GOV_SG_API_KEY === 'string' && process.env.DATA_GOV_SG_API_KEY.trim() !== '') {
      headers['x-api-key'] = process.env.DATA_GOV_SG_API_KEY.trim();
    }

    const upstreamRes = await fetchWithRetry(url.toString(), { headers });

    if (!upstreamRes.ok) {
      if (upstreamRes.status === 429) {
        return {
          status: 429,
          body: { error: 'data.gov.sg rate limit exceeded (429 Too Many Requests).' }
        };
      }
      return {
        status: upstreamRes.status,
        body: {
          error: `data.gov.sg upstream returned status ${upstreamRes.status}: ${
            upstreamRes.statusText || 'Request failed'
          }.`
        }
      };
    }

    const data = await upstreamRes.json();
    const rawRecords = Array.isArray(data?.result?.records) ? data.result.records : [];
    const validRecords = [];
    const prices = [];
    const psms = [];

    for (const row of rawRecords) {
      const resale_price = Number(row.resale_price);
      const floor_area_sqm = Number(row.floor_area_sqm);

      if (
        !Number.isFinite(resale_price) ||
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

    const median_price = computeMedian(prices);
    const median_psm = computeMedian(psms);
    const count = validRecords.length;
    const min_price = count > 0 ? Math.min(...prices) : 0;
    const max_price = count > 0 ? Math.max(...prices) : 0;
    const average_price = count > 0 ? Math.round(prices.reduce((sum, price) => sum + price, 0) / count) : 0;

    return {
      status: 200,
      body: {
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
      }
    };
  } catch (err) {
    return {
      status: 500,
      body: {
        error: `Internal server error while processing HDB request: ${err?.message || 'Unknown error'}`
      }
    };
  }
}
