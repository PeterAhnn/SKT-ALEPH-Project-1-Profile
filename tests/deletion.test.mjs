import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { isoCBOR } from '@simplewebauthn/server/helpers';
import { createApp, tokenHash } from '../server/app.mjs';
import { authRoutes } from '../server/auth.mjs';
import { emptyState, LocalStore } from '../server/store.mjs';

function authenticator(userId, name) {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = publicKey.export({ format: 'jwk' });
  const cose = isoCBOR.encode(new Map([[1, 2], [3, -7], [-1, 1], [-2, Buffer.from(jwk.x, 'base64url')], [-3, Buffer.from(jwk.y, 'base64url')]]));
  const credentialId = randomBytes(32); const id = credentialId.toString('base64url');
  const clientData = (type, challenge) => Buffer.from(JSON.stringify({ type, challenge, origin: 'http://localhost:8008' }));
  return {
    credential: { id, userId, name, publicKey: Buffer.from(cose).toString('base64url'), counter: 0, transports: ['internal'], createdAt: new Date().toISOString() },
    assertion(challenge) {
      const counter = Buffer.alloc(4); counter.writeUInt32BE(1);
      const authData = Buffer.concat([createHash('sha256').update('localhost').digest(), Buffer.from([0x05]), counter]);
      const data = clientData('webauthn.get', challenge);
      const signature = sign('sha256', Buffer.concat([authData, createHash('sha256').update(data).digest()]), privateKey);
      return { id, rawId: id, type: 'public-key', clientExtensionResults: {}, response: { authenticatorData: authData.toString('base64url'), clientDataJSON: data.toString('base64url'), signature: signature.toString('base64url'), userHandle: Buffer.from(userId).toString('base64url') } };
    },
    registration(challenge) {
      const length = Buffer.alloc(2); length.writeUInt16BE(credentialId.length);
      const authData = Buffer.concat([createHash('sha256').update('localhost').digest(), Buffer.from([0x45]), Buffer.alloc(4), Buffer.alloc(16), length, credentialId, cose]);
      const attestation = isoCBOR.encode(new Map([['fmt', 'none'], ['authData', authData], ['attStmt', new Map()]]));
      return { id, rawId: id, type: 'public-key', clientExtensionResults: {}, response: { clientDataJSON: clientData('webauthn.create', challenge).toString('base64url'), attestationObject: Buffer.from(attestation).toString('base64url'), transports: ['internal'] } };
    },
  };
}

async function setup(t, { afterConsume } = {}) {
  const state = emptyState();
  const key1 = authenticator('synthetic-a-id', '첫 합성 패스키'); const key2 = authenticator('synthetic-a-id', '예비 합성 패스키'); const otherKey = authenticator('synthetic-b-id', '다른 합성 계정');
  state.users['synthetic-a-id'] = { id: 'synthetic-a-id', name: 'synthetic-a', items: ['가상 자료 A1', '가상 자료 A2', '가상 자료 A3'] };
  state.users['synthetic-b-id'] = { id: 'synthetic-b-id', name: 'synthetic-b', items: ['가상 자료 B1', '가상 자료 B2', '가상 자료 B3'] };
  for (const key of [key1, key2, otherKey]) state.credentials[key.credential.id] = key.credential;
  const tokens = { first: randomBytes(32).toString('base64url'), firstOther: randomBytes(32).toString('base64url'), backup: randomBytes(32).toString('base64url'), other: randomBytes(32).toString('base64url') };
  for (const [name, token] of Object.entries(tokens)) state.sessions[tokenHash(token)] = { userId: name === 'other' ? 'synthetic-b-id' : 'synthetic-a-id', credentialId: name === 'backup' ? key2.credential.id : name === 'other' ? otherKey.credential.id : key1.credential.id, expiresAt: Date.now() + 60000 };
  const sessions = Object.fromEntries(Object.entries(tokens).map(([name, token]) => [name, `t08-session=${token}`]));
  const localStore = new LocalStore({ state });
  const store = afterConsume ? { async transact(action) {
    const result = await localStore.transact(action);
    if (result?.challenge) await afterConsume(result.challenge);
    return result;
  } } : localStore;
  const server = createServer(createApp({ store, authRoutes }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const mutate = (method, path, body, cookie, origin = 'http://localhost:8008') => fetch(base + path, { method, headers: { 'content-type': 'application/json', origin, cookie: cookie || '' }, body: JSON.stringify(body) });
  const post = (path, body, cookie, origin) => mutate('POST', path, body, cookie, origin);
  const remove = (id, cookie = sessions.backup, origin) => mutate('DELETE', `/api/passkeys/${id}`, {}, cookie, origin);
  const options = async (cookie, name = 'synthetic-a') => {
    const response = await post('/api/passkeys/login/options', { name }, cookie);
    return { status: response.status, cookie: response.headers.get('set-cookie')?.split(';')[0], ...await response.json() };
  };
  const privateStatus = async cookie => (await fetch(base + '/api/private/items', { headers: { cookie } })).status;
  return { base, store, key1, key2, otherKey, sessions, post, remove, options, privateStatus };
}

const snapshot = store => store.transact(state => structuredClone(state));

test('패스키 2개 중 하나를 삭제하면 해당 키 세션만 종료하고 남은 키로 로그인한다', async t => {
  const { base, store, key1, key2, sessions, remove, options, post, privateStatus } = await setup(t);
  const before = await snapshot(store);
  const list = await fetch(base + '/api/passkeys', { headers: { cookie: sessions.first } });
  assert.equal((await list.json()).credentials.length, 2);
  const pending = await options(sessions.first);
  const response = await remove(key1.credential.id, sessions.first);
  assert.equal(response.status, 200);
  assert.deepEqual(Object.fromEntries(Object.entries(await response.json()).filter(([key]) => key !== 'message')), { deleted: true, remaining: 1, loggedOut: true });
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal(await privateStatus(sessions.first), 401); assert.equal(await privateStatus(sessions.firstOther), 401);
  assert.equal(await privateStatus(sessions.backup), 200); assert.equal(await privateStatus(sessions.other), 200);
  assert.equal((await post('/api/passkeys/login/verify', { challengeId: pending.challengeId, response: key1.assertion(pending.publicKey.challenge) }, pending.cookie)).status, 400);
  const deletedAttempt = await options();
  assert.deepEqual(deletedAttempt.publicKey.allowCredentials.map(credential => credential.id), [key2.credential.id]);
  assert.equal((await post('/api/passkeys/login/verify', { challengeId: deletedAttempt.challengeId, response: key1.assertion(deletedAttempt.publicKey.challenge) }, deletedAttempt.cookie)).status, 401);
  const remainingAttempt = await options();
  const login = await post('/api/passkeys/login/verify', { challengeId: remainingAttempt.challengeId, response: key2.assertion(remainingAttempt.publicKey.challenge) }, remainingAttempt.cookie);
  assert.equal(login.status, 200); assert.equal(await privateStatus(login.headers.get('set-cookie').split(';')[0]), 200);
  const after = await snapshot(store);
  assert.deepEqual(after.users['synthetic-b-id'], before.users['synthetic-b-id']);
  assert.equal(Object.keys(after.credentials).length, 2);
});

test('다른 계정·없는 키·이미 삭제된 키·비로그인·다른 출처의 삭제를 거절한다', async t => {
  const { remove, key1, otherKey, sessions, store, privateStatus } = await setup(t);
  assert.equal((await remove(otherKey.credential.id)).status, 403);
  assert.equal((await remove('missing-key')).status, 404);
  assert.equal((await remove(key1.credential.id, '')).status, 401);
  assert.equal((await remove(key1.credential.id, sessions.backup, 'https://elsewhere.example')).status, 403);
  const response = await remove(key1.credential.id);
  assert.equal(response.status, 200); assert.equal((await response.json()).loggedOut, false);
  assert.equal(response.headers.get('set-cookie'), null);
  assert.equal(await privateStatus(sessions.backup), 200);
  assert.equal((await remove(key1.credential.id)).status, 404);
  assert.ok((await snapshot(store)).credentials[otherKey.credential.id]);
});

test('마지막 키 삭제 후 모든 본인 세션을 종료하며 계정·자료를 남기고 로그인·재등록을 막는다', async t => {
  const { remove, key1, key2, sessions, post, options, privateStatus, store } = await setup(t);
  await remove(key1.credential.id);
  const response = await remove(key2.credential.id);
  assert.equal(response.status, 200);
  const body = await response.json(); assert.equal(body.remaining, 0); assert.equal(body.loggedOut, true);
  assert.match(body.message, /다시 로그인할 수 없습니다/); assert.match(body.message, /복구 수단은 없습니다/);
  for (const cookie of [sessions.first, sessions.firstOther, sessions.backup]) assert.equal(await privateStatus(cookie), 401);
  assert.equal(await privateStatus(sessions.other), 200);
  assert.equal((await options()).status, 401);
  assert.equal((await post('/api/passkeys/register/options', { name: 'synthetic-a', credentialName: '복구 시도' })).status, 409);
  const state = await snapshot(store); assert.equal(state.users['synthetic-a-id'].items.length, 3);
  assert.equal(Object.values(state.sessions).filter(session => session.userId === 'synthetic-a-id').length, 0);
});

test('키 삭제 중 검증하던 다른 예비 키의 로그인도 이전 질문이면 차단한다', async t => {
  let deleteDuringVerification;
  const { key1, key2, sessions, remove, options, post, store } = await setup(t, { afterConsume: challenge => challenge.type === 'authentication' && deleteDuringVerification() });
  deleteDuringVerification = async () => { assert.equal((await remove(key1.credential.id, sessions.backup)).status, 200); };
  const attempt = await options();
  assert.equal((await post('/api/passkeys/login/verify', { challengeId: attempt.challengeId, response: key2.assertion(attempt.publicKey.challenge) }, attempt.cookie)).status, 401);
  assert.ok((await snapshot(store)).credentials[key2.credential.id]);
});

test('마지막 키 삭제 중 진행하던 등록으로 계정이 다시 열리지 않는다', async t => {
  let deleteDuringVerification;
  const { key1, key2, sessions, remove, post, store } = await setup(t, { afterConsume: challenge => challenge.type === 'registration' && deleteDuringVerification() });
  await remove(key1.credential.id, sessions.backup);
  const start = await post('/api/passkeys/register/options', { name: 'synthetic-a', credentialName: '등록 중 삭제 시험' }, sessions.backup);
  const flow = start.headers.get('set-cookie').split(';')[0]; const attempt = await start.json();
  deleteDuringVerification = async () => { assert.equal((await remove(key2.credential.id, sessions.backup)).status, 200); };
  const newKey = authenticator('synthetic-a-id', '등록 중인 새 키');
  const result = await post('/api/passkeys/register/verify', { challengeId: attempt.challengeId, response: newKey.registration(attempt.publicKey.challenge) }, `${flow}; ${sessions.backup}`);
  assert.equal(result.status, 401);
  const state = await snapshot(store);
  assert.equal(Object.values(state.credentials).filter(credential => credential.userId === 'synthetic-a-id').length, 0);
  assert.equal(Object.values(state.sessions).filter(session => session.userId === 'synthetic-a-id').length, 0);
});
