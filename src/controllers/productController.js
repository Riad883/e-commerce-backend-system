import { HttpError } from '../utils/HttpError.js';
import { parseId } from '../utils/parseId.js';

function getProduct(db, id) {
  return db.prepare(
    'SELECT id, name, description, price_cents AS priceCents, stock FROM products WHERE id = ?',
  ).get(id);
}

export function createProductController(db) {
  return {
    listProducts(_req, res) {
      const products = db.prepare(
        `SELECT id, name, description, price_cents AS priceCents, stock
         FROM products ORDER BY id`,
      ).all();
      res.json({ products });
    },

    getProductById(req, res, next) {
      const id = parseId(req.params.id);
      if (!id) return next(new HttpError(400, 'Product ID must be a positive integer.'));

      const product = getProduct(db, id);
      if (!product) return next(new HttpError(404, 'Product not found.'));
      res.json({ product });
    },
  };
}
