import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LocalStore, UnavailableStore } from './store.mjs';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
export const tokenHash = token => createHash('sha256').update(token).digest('hex');
export function httpError(status, message) { return Object.assign(new Error(message), { status }); }
export function cookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').map(part => part.trim().split(/=(.*)/s).slice(0, 2)).filter(pair => pair.length === 2));
}
export function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', Vary: 'Cookie', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(body));
}
export async function readJson(req) {
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) throw httpError(415, 'JSON 형식으로 요청해 주세요.');
  let raw = '';
  for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 131072) throw httpError(413, '요청이 너무 큽니다.'); }
  try { const value = JSON.parse(raw); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(); return value; }
  catch { throw httpError(400, '요청 내용을 확인해 주세요.'); }
}
export function requireSameOrigin(req, config) {
  if (req.headers.origin !== config.origin || req.headers['sec-fetch-site'] === 'cross-site') throw httpError(403, '이 사이트에서 시작한 요청만 허용합니다.');
}
export function currentUser(req, state, config) {
  const token = cookies(req)[config.sessionCookie];
  const session = token && state.sessions[tokenHash(token)];
  if (!session || session.expiresAt <= Date.now() || !state.users[session.userId]) throw httpError(401, '패스키로 로그인해 주세요.');
  return state.users[session.userId];
}

export function createApp({ store, origin = process.env.T08_ORIGIN || 'http://localhost:8008', production = process.env.NODE_ENV === 'production', authRoutes } = {}) {
  const url = new URL(origin);
  if (production && url.protocol !== 'https:') throw new Error('운영 주소에는 HTTPS가 필요합니다.');
  const config = { origin: url.origin, rpID: url.hostname, production, sessionCookie: production ? '__Host-t08-session' : 't08-session', flowCookie: production ? '__Host-t08-flow' : 't08-flow' };
  store ||= production ? new UnavailableStore() : new LocalStore({ path: resolve(projectRoot, 'data/t08-state.json') });
  const publicFiles = new Map([
    ['/', ['index.html', 'text/html; charset=utf-8']],
    ['/index.html', ['index.html', 'text/html; charset=utf-8']],
    ['/assets/private.css', ['assets/private.css', 'text/css; charset=utf-8']],
    ['/assets/private.mjs', ['assets/private.mjs', 'text/javascript; charset=utf-8']],
    ['/assets/webauthn.js', ['node_modules/@simplewebauthn/browser/dist/bundle/index.umd.min.js', 'text/javascript; charset=utf-8']],
  ]);
  return async function handler(req, res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'publickey-credentials-create=(self), publickey-credentials-get=(self)');
    try {
      const requestUrl = new URL(req.url, config.origin);
      const path = requestUrl.pathname;
      if (path === '/api/session' && req.method === 'GET') {
        const result = await store.transact(state => {
          try { const user = currentUser(req, state, config); return { authenticated: true, user: { id: user.id, name: user.name } }; }
          catch (error) { if (error.status !== 401) throw error; return { authenticated: false }; }
        });
        return json(res, 200, result);
      }
      if (path.startsWith('/api/private/') && req.method === 'GET') {
        const result = await store.transact(state => {
          const user = currentUser(req, state, config);
          const account = /^\/api\/private\/accounts\/([^/]+)\/items$/.exec(path);
          if (account && account[1] !== user.id) throw httpError(403, '다른 계정의 비공개 자료는 볼 수 없습니다.');
          if (path !== '/api/private/items' && !account) throw httpError(404, '요청한 자료를 찾을 수 없습니다.');
          // Ownership comes exclusively from the authenticated server-side session.
          return { owner: user.id, synthetic: true, items: user.items };
        });
        return json(res, 200, result);
      }
      if (authRoutes && await authRoutes({ req, res, path, config, store })) return;
      if (path.startsWith('/api/')) throw httpError(404, '요청한 기능을 찾을 수 없습니다.');
      const file = publicFiles.get(path);
      if (!file || !['GET', 'HEAD'].includes(req.method)) throw httpError(404, '페이지를 찾을 수 없습니다.');
      const content = await readFile(resolve(projectRoot, file[0]));
      res.writeHead(200, { 'Content-Type': file[1], 'Cache-Control': 'no-cache' });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch (error) {
      if (!res.headersSent) json(res, error.status || 500, { error: error.status ? error.message : '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.' });
      else res.end();
    }
  };
}
