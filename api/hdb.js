import { fetchHdbTransactions } from './_hdb-data.js';
import { extractQuery } from './_utils.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');

  const result = await fetchHdbTransactions(extractQuery(req));
  return res.status(result.status).json(result.body);
}
