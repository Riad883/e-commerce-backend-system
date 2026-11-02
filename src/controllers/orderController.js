import { HttpError } from '../utils/HttpError.js';
import { parseId } from '../utils/parseId.js';

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

export function createOrderController(db) {
  return {
    createOrder(req, res, next) {
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
        const createOrderTransaction = db.transaction(() => {
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

        const orderId = createOrderTransaction();
        res.status(201).json({ order: getOrder(db, orderId) });
      } catch (error) {
        next(error);
      }
    },

    getOrderById(req, res, next) {
      const id = parseId(req.params.id);
      if (!id) return next(new HttpError(400, 'Order ID must be a positive integer.'));

      const order = getOrder(db, id);
      if (!order) return next(new HttpError(404, 'Order not found.'));
      res.json({ order });
    },
  };
}
