import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';
import { createDatabase } from '../src/db.js';

let db;
let server;
let baseUrl;

before(async () => {
  db = createDatabase(':memory:');
  server = createApp(db).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  db.close();
});

test('lists the seeded product catalog', async () => {
  const response = await fetch(`${baseUrl}/api/products`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.products.length, 3);
  assert.equal(body.products[0].priceCents, 1800);
});

test('creates an order, reduces stock, and returns it by ID', async () => {
  const response = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      customerEmail: 'shopper@example.com',
      items: [{ productId: 1, quantity: 2 }],
    }),
  });
  const { order } = await response.json();

  assert.equal(response.status, 201);
  assert.equal(order.totalCents, 3600);
  assert.equal(order.items[0].quantity, 2);

  const productResponse = await fetch(`${baseUrl}/api/products/1`);
  assert.equal((await productResponse.json()).product.stock, 23);

  const orderResponse = await fetch(`${baseUrl}/api/orders/${order.id}`);
  assert.equal((await orderResponse.json()).order.customerEmail, 'shopper@example.com');
});

test('rejects orders that exceed stock without partially changing inventory', async () => {
  const response = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      customerEmail: 'shopper@example.com',
      items: [
        { productId: 1, quantity: 1 },
        { productId: 2, quantity: 16 },
      ],
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 409);
  assert.match(body.error, /Insufficient stock/);
  const productResponse = await fetch(`${baseUrl}/api/products/1`);
  assert.equal((await productResponse.json()).product.stock, 23);
});

test('validates order input and reports missing products', async () => {
  const invalidResponse = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ customerEmail: 'invalid', items: [] }),
  });
  assert.equal(invalidResponse.status, 400);

  const missingResponse = await fetch(`${baseUrl}/api/products/999`);
  assert.equal(missingResponse.status, 404);
});
