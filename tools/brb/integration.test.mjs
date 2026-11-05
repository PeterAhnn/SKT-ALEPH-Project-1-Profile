import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createApp, tokenHash } from '../../server/app.mjs';
import { emptyState, LocalStore } from '../../server/store.mjs';
import { authRoutes } from '../../server/auth.mjs';
import { careerPublicFiles } from '../bra/public-files.mjs';

// 실제 .env·DB를 읽지 않는다. HTTP 증거를 기존 verification 파일에 쓰지 않는다.
async function setup(t, { state = emptyState(), routes, store } = {}) {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const memory = store ?? new LocalStore({ state });
  server.on('request', createApp({ store: memory, origin, production: false, authRoutes: routes }));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeIdleConnections(); }));
  return { origin, store: memory };
}

test('BR-B 공개 앱과 기존 대표작 파일은 로그인·DB 접근 없이 원본 그대로 응답한다', async t => {
  const { origin } = await setup(t, { store: { async transact() { throw new Error('공개 요청이 인증 저장소에 접근했습니다.'); } } });
  for (const [file, type] of careerPublicFiles) {
    const response = await fetch(`${origin}/career/${file}`);
    assert.equal(response.status, 200, file);
    assert.equal(response.headers.get('content-type'), type, file);
    const expected = await readFile(new URL(`../../career/${file}`, import.meta.url));
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), expected, file);
  }
  const app = await fetch(`${origin}/career/apps/login-policy/`);
  assert.equal(app.status, 200);
  assert.match(await app.text(), /로그인 요청 제한 정책 비교/);
  const head = await fetch(`${origin}/career/apps/login-policy/engine.mjs`, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
});

test('대표작 연결·앱의 논문·실행 안내 링크가 로컬 HTTP에서 끊기지 않는다', async t => {
  const { origin } = await setup(t);
  const career = await fetch(`${origin}/career/`).then(response => response.text());
  assert.match(career, /href="\.\/apps\/login-policy\/"/);
  for (const pathname of ['/career/', '/career/apps/login-policy/']) {
    const pageUrl = `${origin}${pathname}`;
    const html = await fetch(pageUrl).then(response => response.text());
    const links = [...html.matchAll(/(?:href|src)="([^"]+)"/gu)]
      .map(match => new URL(match[1], pageUrl))
      .filter(link => link.origin === origin);
    for (const link of links) {
      const response = await fetch(link, { method: 'HEAD' });
      assert.equal(response.status, 200, `${pathname} → ${link.pathname}`);
    }
  }
});

test('앱 경로를 추가해도 서버 소스·계정 DB·원자료·비밀 파일은 공개되지 않는다', async t => {
  const { origin } = await setup(t);
  for (const pathname of [
    '/.env', '/server/app.mjs', '/server/store.mjs', '/data/t08-state.json',
    '/tools/bra/input/rituals.json', '/tools/brb/prepare-data.py', '/package.json',
    '/career/apps/login-policy/.env', '/career/apps/login-policy/data/t08-state.json',
    '/career/apps/login-policy/data/requests.csv', '/career/apps/login-policy/../data.json',
  ]) {
    const response = await fetch(`${origin}${pathname}`);
    assert.equal(response.status, 404, pathname);
  }
  const write = await fetch(`${origin}/career/apps/login-policy/data/paper-data.json`, { method: 'POST', body: '{}' });
  assert.equal(write.status, 404);
});

test('T01 공개 원문과 T08 비로그인 차단·서버 세션 기준 자료 격리를 보존한다', async t => {
  const state = emptyState();
  const marker = 'BRB-INTEGRATION-SYNTHETIC-PRIVATE';
  state.users['synthetic-a'] = { id: 'synthetic-a', name: '합성 사용자 A', items: [{ id: 1, title: marker }] };
  state.users['synthetic-b'] = { id: 'synthetic-b', name: '합성 사용자 B', items: [{ id: 2, title: '별도 합성 자료' }] };
  state.sessions[tokenHash('brb-synthetic-session')] = { userId: 'synthetic-a', expiresAt: Date.now() + 60000 };
  const { origin } = await setup(t, { state });
  const baseline = await readFile(new URL('../../contracts/profile-baseline.html', import.meta.url), 'utf8');
  const publicHtml = await fetch(origin).then(response => response.text());
  const restored = publicHtml.replace(/<!-- T08 ADDITION START -->[\s\S]*?<!-- T08 ADDITION END -->\r?\n?/gu, '');
  assert.equal(restored.replace(/\r\n/gu, '\n'), baseline.replace(/\r\n/gu, '\n'));
  assert.ok(!publicHtml.includes(marker));
  assert.deepEqual(await fetch(`${origin}/api/session`).then(response => response.json()), { authenticated: false });
  assert.equal((await fetch(`${origin}/api/private/items`)).status, 401);
  const headers = { cookie: 't08-session=brb-synthetic-session' };
  const own = await fetch(`${origin}/api/private/items?userId=synthetic-b`, { headers }).then(response => response.json());
  assert.equal(own.owner, 'synthetic-a');
  assert.deepEqual(own.items, state.users['synthetic-a'].items);
  assert.equal((await fetch(`${origin}/api/private/accounts/synthetic-b/items`, { headers })).status, 403);
});

test('T08 패스키 경로·교차 출처 거부와 BR-A 자료 HTTP 응답을 유지한다', async t => {
  const { origin } = await setup(t, { routes: authRoutes });
  const forbidden = await fetch(`${origin}/api/passkeys/login/options`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://cross-origin.invalid' },
    body: JSON.stringify({ name: '합성계정' }),
  });
  assert.equal(forbidden.status, 403);
  const unknown = await fetch(`${origin}/api/passkeys/login/options`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify({ name: 'brb-synthetic-missing-user' }),
  });
  assert.equal(unknown.status, 401);
  const redirect = await fetch(`${origin}/career`, { redirect: 'manual' });
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.get('location'), '/career/');
  const expected = await readFile(new URL('../../career/data.json', import.meta.url), 'utf8');
  assert.equal(await fetch(`${origin}/career/data.json`).then(response => response.text()), expected);
});
