import { enqueueGeocode, searchOneMap, extractQuery } from './_utils.js';

export default async function handler(req, res) {
  // Set cache headers as required:
  // Cache-Control: s-maxage=604800
  res.setHeader('Cache-Control', 's-maxage=604800');

  try {
    const query = extractQuery(req);

    // Support multiple parameters: address, q, searchVal, or block + street
    let address = query.address || query.q || query.searchVal || '';
    if (!address && query.block && query.street) {
      address = `${query.block} ${query.street}`;
    }

    // Also support batch geocoding if requested via query.addresses
    const batchAddresses = query.addresses;

    if (batchAddresses && typeof batchAddresses === 'string') {
      const addressList = batchAddresses
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean)
        .slice(0, 20); // Cap batch at 20 addresses to stay well within rate limits

      if (addressList.length === 0) {
        return res.status(400).json({ error: "Batch addresses parameter must not be empty." });
      }

      const results = {};
      const errors = [];

      for (const addr of addressList) {
        try {
          const outcome = await enqueueGeocode(() => searchOneMap(addr));
          if (outcome.status === 200 && outcome.data?.results?.length > 0) {
            results[addr] = outcome.data.results[0];
          } else if (outcome.status >= 400 && outcome.status !== 404) {
            errors.push({ address: addr, status: outcome.status, error: outcome.error });
          }
        } catch (err) {
          errors.push({ address: addr, error: err?.message || 'Geocoding failed' });
        }
      }

      return res.status(200).json({
        success: true,
        count: Object.keys(results).length,
        results,
        errors: errors.length > 0 ? errors : undefined
      });
    }

    if (!address || !address.trim()) {
      return res.status(400).json({
        error: "Address parameter ('address' or 'q') is required."
      });
    }

    // Geocode single address throttled through the concurrency queue
    const outcome = await enqueueGeocode(() => searchOneMap(address));

    if (outcome.status !== 200) {
      return res.status(outcome.status).json({
        error: outcome.error || `Geocoding request failed with status ${outcome.status}.`
      });
    }

    return res.status(200).json(outcome.data);
  } catch (err) {
    return res.status(500).json({
      error: `Internal server error while geocoding: ${err?.message || 'Unknown error'}`
    });
  }
}
