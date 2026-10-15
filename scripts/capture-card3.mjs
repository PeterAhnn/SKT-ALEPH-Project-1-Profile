import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fixture, kind } from './browser-fixture.mjs';

const f = await fixture();
try {
  await f.register();
  await f.logout();
  const starts = [];
  for (let index = 0; index < 2; index++) {
    const result = await f.post('/api/passkeys/login/options', { name: 'virtual-a' });
    assert.equal(result.status, 200);
    starts.push(result.body);
  }
  assert.notEqual(starts[0].publicKey.challenge, starts[1].publicKey.challenge);
  const sign = options => f.page.evaluate(async optionsJSON => window.SimpleWebAuthnBrowser.startAuthentication({ optionsJSON }), options.publicKey);
  const wrongSignature = await sign(starts[1]);
  const changed = Buffer.from(wrongSignature.response.signature, 'base64url');
  changed[changed.length - 1] ^= 1;
  wrongSignature.response.signature = changed.toString('base64url');
  const rejected = await f.post('/api/passkeys/login/verify', { challengeId: starts[1].challengeId, response: wrongSignature });
  assert.equal(rejected.status, 401);
  const next = (await f.post('/api/passkeys/login/options', { name: 'virtual-a' })).body;
  const response = await sign(next);
  const body = { challengeId: next.challengeId, response };
  const success = await f.post('/api/passkeys/login/verify', body);
  assert.equal(success.status, 200);
  const replay = await f.post('/api/passkeys/login/verify', body);
  assert.equal(replay.status, 400);
  await f.page.reload();
  await f.page.locator('#private-content article').nth(2).waitFor();
  await mkdir('verification/card3', { recursive: true });
  await f.page.locator('#private-space').screenshot({ path: 'verification/card3/logged-in.png' });
  const session = (await f.context.cookies()).find(cookie => cookie.name === 't08-session');
  assert.equal(session.httpOnly, true);
  assert.equal(session.sameSite, 'Strict');
  await f.page.getByRole('button', { name: '로그아웃', exact: true }).click();
  await f.page.getByRole('status').getByText('로그아웃했습니다.', { exact: false }).waitFor();
  assert.equal(await f.page.locator('#private-content').isVisible(), false);
  const stale = await fetch(f.base + '/api/private/items', { headers: { cookie: `t08-session=${session.value}` } });
  const staleBody = await stale.json();
  assert.equal(stale.status, 401);
  assert.equal(await f.page.locator('input[type="password"]').count(), 0);
  await f.page.locator('#private-space').screenshot({ path: 'verification/card3/logged-out.png' });
  await writeFile('verification/card3/authentication-evidence.json', JSON.stringify({ checkedAt: new Date().toISOString(), kind, freshChallenges: starts.map(item => item.publicKey.challenge), records: f.records, staleSession: { request: 'GET /api/private/items', cookie: '[가림]', response: { status: stale.status, body: staleBody } }, cookieFlags: { httpOnly: session.httpOnly, sameSite: session.sameSite, secure: session.secure, note: 'localhost 시험에서는 Secure가 false입니다. HTTPS 운영 쿠키는 Secure입니다.' }, passwordInputCount: 0 }, null, 2));
  console.log('카드 3: 새 질문·정상/틀린 서명·질문 재사용·로그아웃 후 구 세션 401 확인 완료');
} finally { await f.close(); }
