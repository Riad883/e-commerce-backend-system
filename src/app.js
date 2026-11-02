import express from 'express';
import { createHealthRouter } from './routes/healthRoutes.js';
import { createOrderRouter } from './routes/orderRoutes.js';
import { createProductRouter } from './routes/productRoutes.js';
import { HttpError } from './utils/HttpError.js';

export function createApp(db) {
  const app = express();
  app.use(express.json({ limit: '100kb' }));

  app.use(createHealthRouter());
  app.use('/api/products', createProductRouter(db));
  app.use('/api/orders', createOrderRouter(db));

  app.use((_req, _res, next) => next(new HttpError(404, 'Route not found.')));

  app.use((error, _req, res, _next) => {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }
    if (error instanceof SyntaxError && 'body' in error) {
      return res.status(400).json({ error: 'Request body must be valid JSON.' });
    }

    console.error(error);
    return res.status(500).json({ error: 'Internal server error.' });
  });

  return app;
}
