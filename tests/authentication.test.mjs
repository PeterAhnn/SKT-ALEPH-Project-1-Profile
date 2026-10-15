import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { isoCBOR } from '@simplewebauthn/server/helpers';
import { createApp, tokenHash } from '../server/app.mjs';
import { authRoutes } from '../server/auth.mjs';
import { emptyState, LocalStore } from '../server/store.mjs';

function authenticator(userId) {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = publicKey.export({ format: 'jwk' });
  const key = isoCBOR.encode(new Map([[1, 2], [3, -7], [-1, 1], [-2, Buffer.from(jwk.x, 'base64url')], [-3, Buffer.from(jwk.y, 'base64url')]]));
  const id = randomBytes(32).toString('base64url');
  return {
    credential: { id, userId, name: '합성 인증기', publicKey: Buffer.from(key).toString('base64url'), counter: 0, transports: ['internal'], createdAt: new Date().toISOString() },
    assertion(challenge, { origin = 'http://localhost:8008', rpID = 'localhost', counter = 1, flags = 0x05, wrongSignature = false, userHandle = userId } = {}) {
      const count = Buffer.alloc(4); count.writeUInt32BE(counter);
      const authData = Buffer.concat([createHash('sha256').update(rpID).digest(), Buffer.from([flags]), count]);
      const clientData = Buffer.from(JSON.stringify({ type: 'webauthn.get', challenge, origin }));
      const signed = Buffer.concat([authData, createHash('sha256').update(clientData).digest()]);
      const signature = sign('sha256', signed, privateKey);
      if (wrongSignature) signature[signature.length - 1] ^= 0x01;
      return { id, rawId: id, type: 'public-key', clientExtensionResults: {}, response: { authenticatorData: authData.toString('base64url'), clientDataJSON: clientData.toString('base64url'), signature: signature.toString('base64url'), userHandle: Buffer.from(userHandle).toString('base64url') } };
    },
  };
}

async function setup(t, { afterConsume } = {}) {
  const state = emptyState();
  const keyA = authenticator('synthetic-user-a'); const keyB = authenticator('synthetic-user-b');
  state.users['synthetic-user-a'] = { id: 'synthetic-user-a', name: 'synthetic-a', items: [1, 2, 3] };
  state.users['synthetic-user-b'] = { id: 'synthetic-user-b', name: 'synthetic-b', items: [4, 5, 6] };
  state.credentials[keyA.credential.id] = keyA.credential; state.credentials[keyB.credential.id] = keyB.credential;
  const localStore = new LocalStore({ state });
  const store = afterConsume ? { async transact(action) {
    const result = await localStore.transact(action);
    if (result?.challenge?.type === 'authentication' && result.credential) await afterConsume(localStore);
    return result;
  } } : localStore;
  const server = createServer(createApp({ store, authRoutes }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body, cookie = '', origin = 'http://localhost:8008') => fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', origin, cookie }, body: JSON.stringify(body) });
  const options = async (name = 'synthetic-a', cookie = '') => {
    const response = await post('/api/passkeys/login/options', { name }, cookie);
    return { status: response.status, cookie: response.headers.get('set-cookie')?.split(';')[0], ...await response.json() };
  };
  return { base, post, options, keyA, keyB, store };
}

const snapshot = store => store.transact(state => structuredClone(state));

test('로그인 질문은 매번 새로 발급되며 본인 패스키만 허용한다', async t => {
  const { options, store, keyA } = await setup(t);
  const first = await options(); const second = await options();
  assert.equal(first.status, 200); assert.equal(second.status, 200);
  assert.notEqual(first.publicKey.challenge, second.publicKey.challenge);
  assert.deepEqual(first.publicKey.allowCredentials.map(credential => credential.id), [keyA.credential.id]);
  assert.equal(first.publicKey.userVerification, 'required');
  const state = await snapshot(store);
  assert.equal(state.challenges[first.challengeId].challenge, first.publicKey.challenge);
  assert.ok(state.challenges[first.challengeId].expiresAt <= Date.now() + 300000);
  assert.equal((await options('missing-user')).status, 401);
});

test('정상 EC 서명만 로그인하며 사용한 질문은 재사용할 수 없다', async t => {
  const { options, post, keyA, store, base } = await setup(t);
  const challenge = await options();
  const body = { challengeId: challenge.challengeId, response: keyA.assertion(challenge.publicKey.challenge) };
  const login = await post('/api/passkeys/login/verify', body, challenge.cookie);
  assert.equal(login.status, 200); assert.equal((await login.json()).authenticated, true);
  const session = login.headers.get('set-cookie').split(';')[0];
  assert.match(login.headers.get('set-cookie'), /HttpOnly; SameSite=Strict; Max-Age=1800/);
  const state = await snapshot(store);
  assert.equal(state.credentials[keyA.credential.id].counter, 1);
  assert.equal(state.credentials[keyA.credential.id].authVersion, 1);
  assert.equal(Object.hasOwn(state.sessions, tokenHash(session.split('=')[1])), true);
  assert.equal((await fetch(base + '/api/private/items', { headers: { cookie: session } })).status, 200);
  assert.equal((await post('/api/passkeys/login/verify', body, challenge.cookie)).status, 400);
});

for (const variation of [
  { label: '변조한 서명', change: { wrongSignature: true } },
  { label: '다른 사이트', change: { origin: 'https://elsewhere.example' } },
  { label: '다른 RP ID', change: { rpID: 'elsewhere.example' } },
  { label: '사용자 확인 없음', change: { flags: 0x01 } },
  { label: '사용자 존재 없음', change: { flags: 0x04 } },
  { label: '다른 계정 식별자', change: { userHandle: 'synthetic-user-b' } },
]) test(`로그인 검증은 ${variation.label} 응답을 거절하고 질문을 소비한다`, async t => {
  const { options, post, keyA, store } = await setup(t);
  const challenge = await options();
  const body = { challengeId: challenge.challengeId, response: keyA.assertion(challenge.publicKey.challenge, variation.change) };
  assert.equal((await post('/api/passkeys/login/verify', body, challenge.cookie)).status, 401);
  assert.equal((await post('/api/passkeys/login/verify', body, challenge.cookie)).status, 400);
  const state = await snapshot(store); assert.equal(Object.keys(state.sessions).length, 0);
  assert.equal(state.credentials[keyA.credential.id].counter, 0);
});

test('남의 패스키·질문 변조·다른 브라우저·만료·나쁜 HTTP 출처를 거절한다', async t => {
  const { options, post, keyA, keyB, store } = await setup(t);
  const otherKey = await options();
  assert.equal((await post('/api/passkeys/login/verify', { challengeId: otherKey.challengeId, response: keyB.assertion(otherKey.publicKey.challenge) }, otherKey.cookie)).status, 401);
  const wrongChallenge = await options();
  assert.equal((await post('/api/passkeys/login/verify', { challengeId: wrongChallenge.challengeId, response: keyA.assertion('wrong-challenge') }, wrongChallenge.cookie)).status, 401);
  const bound = await options();
  const boundBody = { challengeId: bound.challengeId, response: keyA.assertion(bound.publicKey.challenge) };
  assert.equal((await post('/api/passkeys/login/verify', boundBody, 't08-flow=other-browser')).status, 403);
  assert.ok((await snapshot(store)).challenges[bound.challengeId]);
  assert.equal((await post('/api/passkeys/login/verify', boundBody, bound.cookie, 'https://elsewhere.example')).status, 403);
  await store.transact(state => { state.challenges[bound.challengeId].expiresAt = Date.now() - 1; });
  assert.equal((await post('/api/passkeys/login/verify', boundBody, bound.cookie)).status, 400);
  assert.equal((await snapshot(store)).challenges[bound.challengeId], undefined);
});

test('새 로그인은 기존 세션을 폐기하고 로그아웃은 구 세션과 대기 질문을 무효화한다', async t => {
  const { options, post, keyA, store, base } = await setup(t);
  const first = await options();
  const login1 = await post('/api/passkeys/login/verify', { challengeId: first.challengeId, response: keyA.assertion(first.publicKey.challenge) }, first.cookie);
  const session1 = login1.headers.get('set-cookie').split(';')[0];
  const second = await options('synthetic-a', session1);
  const login2 = await post('/api/passkeys/login/verify', { challengeId: second.challengeId, response: keyA.assertion(second.publicKey.challenge, { counter: 2 }) }, `${second.cookie}; ${session1}`);
  assert.equal(login2.status, 200);
  const session2 = login2.headers.get('set-cookie').split(';')[0];
  assert.equal((await fetch(base + '/api/private/items', { headers: { cookie: session1 } })).status, 401);
  const pending = await options('synthetic-a', session2);
  const logout = await post('/api/logout', {}, `${pending.cookie}; ${session2}`);
  assert.equal(logout.status, 200); assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal((await fetch(base + '/api/private/items', { headers: { cookie: session2 } })).status, 401);
  assert.equal((await post('/api/passkeys/login/verify', { challengeId: pending.challengeId, response: keyA.assertion(pending.publicKey.challenge, { counter: 3 }) }, pending.cookie)).status, 400);
  assert.equal(Object.keys((await snapshot(store)).sessions).length, 0);
});

test('감소하거나 같은 서명 카운터와 삭제된 키를 거절한다', async t => {
  const { options, post, keyA, store } = await setup(t);
  await store.transact(state => { state.credentials[keyA.credential.id].counter = 4; });
  const stale = await options();
  assert.equal((await post('/api/passkeys/login/verify', { challengeId: stale.challengeId, response: keyA.assertion(stale.publicKey.challenge, { counter: 4 }) }, stale.cookie)).status, 401);
  const deleted = await options();
  await store.transact(state => { delete state.credentials[keyA.credential.id]; });
  assert.equal((await post('/api/passkeys/login/verify', { challengeId: deleted.challengeId, response: keyA.assertion(deleted.publicKey.challenge, { counter: 5 }) }, deleted.cookie)).status, 401);
});

test('동일 질문의 동시 검증은 한 번만 세션을 만든다', async t => {
  const { options, post, keyA, store } = await setup(t);
  const challenge = await options();
  const body = { challengeId: challenge.challengeId, response: keyA.assertion(challenge.publicKey.challenge) };
  const responses = await Promise.all([post('/api/passkeys/login/verify', body, challenge.cookie), post('/api/passkeys/login/verify', body, challenge.cookie)]);
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 400]);
  assert.equal(Object.keys((await snapshot(store)).sessions).length, 1);
});

test('검증 중 키가 삭제되면 정상 서명이어도 최종 세션 발급을 거절한다', async t => {
  const { options, post, keyA, store } = await setup(t, { afterConsume: localStore => localStore.transact(state => {
    for (const [id, credential] of Object.entries(state.credentials)) if (credential.userId === 'synthetic-user-a') delete state.credentials[id];
  }) });
  const challenge = await options();
  assert.equal((await post('/api/passkeys/login/verify', { challengeId: challenge.challengeId, response: keyA.assertion(challenge.publicKey.challenge) }, challenge.cookie)).status, 401);
  assert.equal(Object.keys((await snapshot(store)).sessions).length, 0);
});

test('서로 다른 질문을 동시에 검증해도 카운터 0 인증기의 중복 세션 발급을 차단한다', async t => {
  let release; let consumed = 0;
  const barrier = new Promise(resolve => { release = resolve; });
  const { options, post, keyA, store } = await setup(t, { afterConsume: async () => {
    consumed += 1; if (consumed === 2) release(); await barrier;
  } });
  const first = await options(); const second = await options();
  const responses = await Promise.all([first, second].map(challenge => post('/api/passkeys/login/verify', { challengeId: challenge.challengeId, response: keyA.assertion(challenge.publicKey.challenge, { counter: 0 }) }, challenge.cookie)));
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 401]);
  assert.equal(Object.keys((await snapshot(store)).sessions).length, 1);
});

test('서명 검증 중 로그아웃하면 정상 서명이어도 세션이 생기지 않는다', async t => {
  let performLogout;
  const { options, post, keyA, store } = await setup(t, { afterConsume: () => performLogout() });
  const challenge = await options();
  performLogout = async () => { assert.equal((await post('/api/logout', {}, challenge.cookie)).status, 200); };
  assert.equal((await post('/api/passkeys/login/verify', { challengeId: challenge.challengeId, response: keyA.assertion(challenge.publicKey.challenge) }, challenge.cookie)).status, 401);
  assert.equal(Object.keys((await snapshot(store)).sessions).length, 0);
});
