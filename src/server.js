import { createApp } from './app.js';
import { createDatabase } from './db.js';

const db = createDatabase();
const app = createApp(db);
const port = Number(process.env.PORT ?? 3000);

const server = app.listen(port, () => {
  console.log(`E-commerce API listening on port ${port}`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
