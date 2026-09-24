import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import hdbHandler from './api/hdb.js';
import geocodeHandler from './api/geocode.js';
import healthHandler from './api/health.js';
import chatHandler from './api/chat.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // JSON body parser
  app.use(express.json());

  // Register API routes importing the shared handler logic
  app.get('/api/hdb', hdbHandler);
  app.get('/api/geocode', geocodeHandler);
  app.get('/api/health', healthHandler);
  app.post('/api/chat', chatHandler);

  // Development: Mount Vite middlewares for SPA
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production: serve built static files from dist
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Singapore HDB Resale Explorer server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
