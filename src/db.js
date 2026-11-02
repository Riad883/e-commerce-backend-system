import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import Database from 'better-sqlite3';

const schema = `
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
    stock INTEGER NOT NULL CHECK (stock >= 0),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY,
    customer_email TEXT NOT NULL,
    total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id),
    product_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0)
  );
`;

const starterProducts = [
  ['Canvas Tote', 'A sturdy everyday cotton tote.', 1800, 25],
  ['Ceramic Mug', 'A handmade stoneware coffee mug.', 2400, 15],
  ['Desk Planter', 'A small ceramic planter for your desk.', 3200, 10],
];

export function createDatabase(path = process.env.STORE_DB_PATH ?? './data/store.db') {
  const databasePath = path === ':memory:' ? path : resolve(path);

  if (databasePath !== ':memory:') {
    mkdirSync(dirname(databasePath), { recursive: true });
  }

  const db = new Database(databasePath);
  db.pragma('journal_mode = WAL');
  db.exec(schema);

  const productCount = db.prepare('SELECT COUNT(*) AS count FROM products').get().count;
  if (productCount === 0) {
    const insertProduct = db.prepare(
      'INSERT INTO products (name, description, price_cents, stock) VALUES (?, ?, ?, ?)',
    );
    const seedProducts = db.transaction(() => {
      for (const product of starterProducts) {
        insertProduct.run(...product);
      }
    });
    seedProducts();
  }

  return db;
}
