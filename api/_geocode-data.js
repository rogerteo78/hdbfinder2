import { enqueueGeocode, searchOneMap } from './_utils.js';

/**
 * Resolves one or more addresses through OneMap while preserving the existing route response format.
 * The MCP endpoint calls this function directly instead of sending an HTTP request back to this app.
 */
export async function fetchGeocodeData(query = {}) {
  try {
    let address = query.address || query.q || query.searchVal || '';
    if (!address && query.block && query.street) {
      address = `${query.block} ${query.street}`;
    }

    const batchAddresses = query.addresses;
    const addressList = Array.isArray(batchAddresses)
      ? batchAddresses.map((item) => String(item).trim()).filter(Boolean).slice(0, 20)
      : typeof batchAddresses === 'string'
        ? batchAddresses.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 20)
        : null;

    if (addressList) {
      if (addressList.length === 0) {
        return {
          status: 400,
          body: { error: 'Batch addresses parameter must not be empty.' }
        };
      }

      const results = {};
      const errors = [];

      for (const item of addressList) {
        try {
          const outcome = await enqueueGeocode(() => searchOneMap(item));
          if (outcome.status === 200 && outcome.data?.results?.length > 0) {
            results[item] = outcome.data.results[0];
          } else if (outcome.status >= 400 && outcome.status !== 404) {
            errors.push({ address: item, status: outcome.status, error: outcome.error });
          }
        } catch (err) {
          errors.push({ address: item, status: 500, error: err?.message || 'Geocoding failed' });
        }
      }

      return {
        status: 200,
        body: {
          success: true,
          count: Object.keys(results).length,
          results,
          errors: errors.length > 0 ? errors : undefined
        }
      };
    }

    if (!address || !String(address).trim()) {
      return {
        status: 400,
        body: { error: "Address parameter ('address' or 'q') is required." }
      };
    }

    const outcome = await enqueueGeocode(() => searchOneMap(address));
    if (outcome.status !== 200) {
      return {
        status: outcome.status,
        body: { error: outcome.error || `Geocoding request failed with status ${outcome.status}.` }
      };
    }

    return { status: 200, body: outcome.data };
  } catch (err) {
    return {
      status: 500,
      body: { error: `Internal server error while geocoding: ${err?.message || 'Unknown error'}` }
    };
  }
}
