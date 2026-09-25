import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { fetchHdbTransactions } from './_hdb-data.js';
import { fetchGeocodeData } from './_geocode-data.js';

const READ_ONLY_ANNOTATIONS = { readOnlyHint: true, openWorldHint: true };
const HDB_UPSTREAM = 'data.gov.sg HDB resale flat prices datastore';
const GEOCODE_UPSTREAM = 'OneMap Search API';

function toolResult(result) {
  return {
    content: [{ type: 'text', text: JSON.stringify(result) }]
  };
}

function upstreamError(upstream, status) {
  return {
    isError: true,
    content: [{ type: 'text', text: `${upstream} request failed with upstream status ${status}.` }]
  };
}

function monthWithinLookback(month, months) {
  if (!/^\d{4}-\d{2}$/.test(month)) return false;

  const [year, monthNumber] = month.split('-').map(Number);
  const now = new Date();
  const currentMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const firstIncludedMonth = new Date(
    Date.UTC(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth() - (months - 1), 1)
  );
  const transactionMonth = new Date(Date.UTC(year, monthNumber - 1, 1));

  return transactionMonth >= firstIncludedMonth && transactionMonth <= currentMonth;
}

function rankAffordableTowns(records, budget, months) {
  const towns = new Map();

  for (const record of records) {
    if (record.resale_price > budget || !monthWithinLookback(record.month, months)) continue;

    const key = record.town || 'UNKNOWN';
    const existing = towns.get(key) || { town: key, transaction_count: 0, total_price: 0, prices: [] };
    existing.transaction_count += 1;
    existing.total_price += record.resale_price;
    existing.prices.push(record.resale_price);
    towns.set(key, existing);
  }

  return [...towns.values()]
    .map((town) => ({
      town: town.town,
      transaction_count: town.transaction_count,
      median_price: median(town.prices),
      average_price: Math.round(town.total_price / town.transaction_count),
      lowest_price: Math.min(...town.prices)
    }))
    .sort(
      (left, right) =>
        left.median_price - right.median_price ||
        left.average_price - right.average_price ||
        right.transaction_count - left.transaction_count ||
        left.town.localeCompare(right.town)
    )
    .slice(0, 20);
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function registerTools(server) {
  server.registerTool(
    'goat6_find_affordable_towns',
    {
      description:
        'Returns a ranked list of up to 20 Singapore HDB towns whose recent transactions meet a price budget and flat type. It reads official resale records from the data.gov.sg HDB resale flat prices datastore. Use it when an agent needs a quick affordability comparison across towns; it does not provide current listings or purchase advice.',
      inputSchema: {
        budget: z
          .number()
          .finite()
          .nonnegative()
          .describe('Maximum resale price in Singapore dollars; accepts a non-negative finite number.'),
        flat_type: z
          .string()
          .trim()
          .min(1)
          .describe('HDB flat type to match, such as 3 ROOM, 4 ROOM, or 5 ROOM; accepts one non-empty string.'),
        months: z
          .number()
          .int()
          .min(1)
          .max(120)
          .describe('Recent calendar-month lookback; accepts an integer from 1 through 120 inclusive.')
      },
      annotations: READ_ONLY_ANNOTATIONS
    },
    async ({ budget, flat_type, months }) => {
      const response = await fetchHdbTransactions({ limit: 1000, flat_type, sort: 'month desc' });
      if (response.status !== 200) {
        return upstreamError(HDB_UPSTREAM, response.status);
      }

      return toolResult({
        towns: rankAffordableTowns(response.body.records, budget, months),
        source: HDB_UPSTREAM,
        fetched_at: new Date().toISOString()
      });
    }
  );

  server.registerTool(
    'goat6_recent_transactions',
    {
      description:
        'Returns up to 20 recent HDB resale blocks that match a price budget, flat type, and optional town. It reads official resale records from the data.gov.sg HDB resale flat prices datastore. Use it when an agent needs examples of recent matching transactions; it does not include property condition, listing availability, or buyer eligibility.',
      inputSchema: {
        budget: z
          .number()
          .finite()
          .nonnegative()
          .describe('Maximum resale price in Singapore dollars; accepts a non-negative finite number.'),
        flat_type: z
          .string()
          .trim()
          .min(1)
          .describe('HDB flat type to match, such as 3 ROOM, 4 ROOM, or 5 ROOM; accepts one non-empty string.'),
        town: z
          .string()
          .trim()
          .min(1)
          .optional()
          .describe('Optional Singapore HDB town to match; accepts one non-empty string when supplied.')
      },
      annotations: READ_ONLY_ANNOTATIONS
    },
    async ({ budget, flat_type, town }) => {
      const response = await fetchHdbTransactions({ limit: 1000, flat_type, town, sort: 'month desc' });
      if (response.status !== 200) {
        return upstreamError(HDB_UPSTREAM, response.status);
      }

      const blocks = response.body.records
        .filter((record) => record.resale_price <= budget)
        .slice(0, 20);

      return toolResult({
        blocks,
        source: HDB_UPSTREAM,
        fetched_at: new Date().toISOString()
      });
    }
  );

  server.registerTool(
    'goat6_geocode',
    {
      description:
        'Returns OneMap coordinates and normalized address details for up to 10 supplied Singapore addresses. It reads live place-search results from the OneMap Search API. Use it when an agent needs map-ready locations for known addresses; it does not calculate routes, travel times, or nearby amenities.',
      inputSchema: {
        addresses: z
          .array(
            z
              .string()
              .trim()
              .min(1)
              .describe('One Singapore address or place-search string; accepts one non-empty string.')
          )
          .min(1)
          .max(10)
          .describe('Addresses to geocode; accepts an array containing from 1 through 10 non-empty strings.')
      },
      annotations: READ_ONLY_ANNOTATIONS
    },
    async ({ addresses }) => {
      const response = await fetchGeocodeData({ addresses });
      if (response.status !== 200) {
        return upstreamError(GEOCODE_UPSTREAM, response.status);
      }

      const failed = Array.isArray(response.body.errors) ? response.body.errors[0] : null;
      if (failed) {
        return upstreamError(GEOCODE_UPSTREAM, failed.status || 500);
      }

      const locations = Object.entries(response.body.results || {})
        .slice(0, 10)
        .map(([address, location]) => ({ address, ...location }));

      return toolResult({
        locations,
        source: GEOCODE_UPSTREAM,
        fetched_at: new Date().toISOString()
      });
    }
  );
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method not allowed' },
      id: null
    });
  }

  const server = new McpServer({ name: 'goat6-server', version: '1.0.0' });
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  });
  let closed = false;

  const closeResources = async () => {
    if (closed) return;
    closed = true;
    await Promise.allSettled([transport.close(), server.close()]);
  };

  res.once('close', () => {
    void closeResources();
  });

  try {
    registerTools(server);
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch {
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null
      });
    }
    await closeResources();
  }
}
