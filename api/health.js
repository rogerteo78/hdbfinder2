export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  return res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'singapore-hdb-resale-explorer',
    apis: {
      hdb: '/api/hdb',
      geocode: '/api/geocode',
      chat: '/api/chat',
      health: '/api/health'
    }
  });
}
