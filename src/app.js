import express from 'express';

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function getProduct(db, id) {
  return db.prepare(
    'SELECT id, name, description, price_cents AS priceCents, stock FROM products WHERE id = ?',
  ).get(id);
}

function getOrder(db, id) {
  const order = db.prepare(
    `SELECT id, customer_email AS customerEmail, total_cents AS totalCents, created_at AS createdAt
     FROM orders WHERE id = ?`,
  ).get(id);

  if (!order) return undefined;

  order.items = db.prepare(
    `SELECT product_id AS productId, product_name AS productName,
            quantity, unit_price_cents AS unitPriceCents
     FROM order_items WHERE order_id = ? ORDER BY id`,
  ).all(id);

  return order;
}

function parseId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function createApp(db) {
  const app = express();
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/products', (_req, res) => {
    const products = db.prepare(
      `SELECT id, name, description, price_cents AS priceCents, stock
       FROM products ORDER BY id`,
    ).all();
    res.json({ products });
  });

  app.get('/api/products/:id', (req, res, next) => {
    const id = parseId(req.params.id);
    if (!id) return next(new HttpError(400, 'Product ID must be a positive integer.'));

    const product = getProduct(db, id);
    if (!product) return next(new HttpError(404, 'Product not found.'));
    res.json({ product });
  });

  app.post('/api/orders', (req, res, next) => {
    const { customerEmail, items } = req.body ?? {};
    if (typeof customerEmail !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      return next(new HttpError(400, 'A valid customerEmail is required.'));
    }
    if (!Array.isArray(items) || items.length === 0) {
      return next(new HttpError(400, 'At least one order item is required.'));
    }

    const quantities = new Map();
    for (const item of items) {
      const productId = parseId(item?.productId);
      if (!productId || !Number.isSafeInteger(item?.quantity) || item.quantity <= 0) {
        return next(new HttpError(400, 'Each item needs a positive productId and quantity.'));
      }
      const quantity = (quantities.get(productId) ?? 0) + item.quantity;
      if (!Number.isSafeInteger(quantity)) {
        return next(new HttpError(400, 'Item quantity is too large.'));
      }
      quantities.set(productId, quantity);
    }

    try {
      const createOrder = db.transaction(() => {
        const orderLines = [];
        let totalCents = 0;

        for (const [productId, quantity] of quantities) {
          const product = getProduct(db, productId);
          if (!product) throw new HttpError(404, `Product ${productId} not found.`);
          if (product.stock < quantity) {
            throw new HttpError(409, `Insufficient stock for ${product.name}.`);
          }

          totalCents += product.priceCents * quantity;
          if (!Number.isSafeInteger(totalCents)) {
            throw new HttpError(400, 'Order total is too large.');
          }
          orderLines.push({ product, quantity });
        }

        const result = db.prepare(
          'INSERT INTO orders (customer_email, total_cents) VALUES (?, ?)',
        ).run(customerEmail.trim(), totalCents);
        const orderId = Number(result.lastInsertRowid);
        const updateStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');
        const insertItem = db.prepare(
          `INSERT INTO order_items
           (order_id, product_id, product_name, quantity, unit_price_cents)
           VALUES (?, ?, ?, ?, ?)`,
        );

        for (const { product, quantity } of orderLines) {
          updateStock.run(quantity, product.id);
          insertItem.run(orderId, product.id, product.name, quantity, product.priceCents);
        }

        return orderId;
      });

      const orderId = createOrder();
      res.status(201).json({ order: getOrder(db, orderId) });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/orders/:id', (req, res, next) => {
    const id = parseId(req.params.id);
    if (!id) return next(new HttpError(400, 'Order ID must be a positive integer.'));

    const order = getOrder(db, id);
    if (!order) return next(new HttpError(404, 'Order not found.'));
    res.json({ order });
  });

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
