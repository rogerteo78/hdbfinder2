import { fetchGeocodeData } from './_geocode-data.js';
import { extractQuery } from './_utils.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=604800');

  const result = await fetchGeocodeData(extractQuery(req));
  return res.status(result.status).json(result.body);
}
