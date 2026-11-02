# Express E-commerce API

A small Express and SQLite backend with a seeded product catalog and a checkout
flow that validates stock and stores orders persistently.

## Run locally

Requires Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
```

The API listens on `http://localhost:3000`. The SQLite database is created at
`data/store.db` and seeded with sample products on first run. Set `PORT` to
change the port or `STORE_DB_PATH` to choose another database file.

Run tests with `npm test`.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Check that the API is running |
| `GET` | `/api/products` | List products |
| `GET` | `/api/products/:id` | Get a product |
| `POST` | `/api/orders` | Place an order |
| `GET` | `/api/orders/:id` | Get an order and its items |

Prices and totals are integer cents. To place an order, send:

```json
{
  "customerEmail": "shopper@example.com",
  "items": [
    { "productId": 1, "quantity": 2 }
  ]
}
```

Checkout deducts inventory and creates the order in a single SQLite transaction.
The response includes the order ID, total in cents, and item price snapshots.

This is a starter project, not a production-ready store: it does not include
authentication, payment processing, shipping, or administrative product
management.
