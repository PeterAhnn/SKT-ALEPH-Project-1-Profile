import { createServer } from 'node:http';
import { createApp } from './server/app.mjs';
import { authRoutes } from './server/auth.mjs';
import { PgStore } from './server/pg-store.mjs';

const port = Number(process.env.PORT || 8008);
const store = process.env.T08_DATABASE_URL ? new PgStore({ connectionString: process.env.T08_DATABASE_URL, ca: process.env.T08_DATABASE_CA }) : undefined;
createServer(createApp({ store, authRoutes })).listen(port, '127.0.0.1', () => console.log(`소개 페이지: http://localhost:${port}`));
