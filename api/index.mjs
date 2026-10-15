import { createApp } from '../server/app.mjs';
import { authRoutes } from '../server/auth.mjs';
import { PgStore } from '../server/pg-store.mjs';

let handler;
export default async function api(req, res) {
  if (!process.env.T08_ORIGIN || !process.env.T08_DATABASE_URL) {
    res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ error: '비공개 공간을 준비하고 있습니다. 잠시 후 다시 시도해 주세요.' }));
    return;
  }
  try {
    handler ||= createApp({ origin: process.env.T08_ORIGIN, production: true, authRoutes, store: new PgStore({ connectionString: process.env.T08_DATABASE_URL, ca: process.env.T08_DATABASE_CA, production: true }) });
    await handler(req, res);
  } catch {
    if (!res.headersSent) res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ error: '비공개 공간을 준비하고 있습니다. 잠시 후 다시 시도해 주세요.' }));
  }
}
