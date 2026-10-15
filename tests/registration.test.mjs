import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash, generateKeyPairSync, randomBytes } from 'node:crypto';
import { isoCBOR } from '@simplewebauthn/server/helpers';
import { createApp, tokenHash } from '../server/app.mjs';
import { authRoutes } from '../server/auth.mjs';
import { emptyState, LocalStore } from '../server/store.mjs';

async function setup(t, state = emptyState(), { afterConsume } = {}) {
  const localStore = new LocalStore({ state });
  const store = afterConsume ? { async transact(action) {
    const result = await localStore.transact(action);
    if (result?.challenge?.type === 'registration') await afterConsume(result.challenge);
    return result;
  } } : localStore;
  const server = createServer(createApp({ store, authRoutes }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body, cookie = '', origin = 'http://localhost:8008') => fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', origin, cookie }, body: JSON.stringify(body) });
  return { base, store, post };
}

const getCookie = response => response.headers.get('set-cookie').split(';')[0];
const snapshot = store => store.transact(state => structuredClone(state));

// Synthetic authenticator data passes the real library; no verifier is replaced.
function syntheticRegistration(challenge, { origin = 'http://localhost:8008', rpID = 'localhost', verified = true } = {}) {
  const { publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = publicKey.export({ format: 'jwk' });
  const cose = isoCBOR.encode(new Map([[1, 2], [3, -7], [-1, 1], [-2, Buffer.from(jwk.x, 'base64url')], [-3, Buffer.from(jwk.y, 'base64url')]]));
  const credentialId = randomBytes(32);
  const length = Buffer.alloc(2); length.writeUInt16BE(credentialId.length);
  const authData = Buffer.concat([createHash('sha256').update(rpID).digest(), Buffer.from([verified ? 0x45 : 0x41]), Buffer.alloc(4), Buffer.alloc(16), length, credentialId, cose]);
  const attestation = isoCBOR.encode(new Map([['fmt', 'none'], ['authData', authData], ['attStmt', new Map()]]));
  const id = credentialId.toString('base64url');
  return { id, rawId: id, type: 'public-key', clientExtensionResults: {}, response: { clientDataJSON: Buffer.from(JSON.stringify({ type: 'webauthn.create', challenge, origin })).toString('base64url'), attestationObject: Buffer.from(attestation).toString('base64url'), transports: ['internal'] } };
}

test('등록 질문은 새로 생성·보관되고 취소 후 계정과 공개키가 남지 않는다', async t => {
  const { post, store } = await setup(t);
  const first = await post('/api/passkeys/register/options', { name: 'synthetic-a', credentialName: '연습 기기' });
  const cookie = getCookie(first);
  const options1 = await first.json();
  const second = await post('/api/passkeys/register/options', { name: 'synthetic-a', credentialName: '연습 기기' }, cookie);
  const options2 = await second.json();
  assert.equal(first.status, 200); assert.equal(second.status, 200);
  assert.notEqual(options1.publicKey.challenge, options2.publicKey.challenge);
  let state = await snapshot(store);
  assert.equal(state.challenges[options1.challengeId].challenge, options1.publicKey.challenge);
  assert.ok(state.challenges[options1.challengeId].expiresAt <= Date.now() + 300000);
  assert.equal(Object.keys(state.users).length, 0); assert.equal(Object.keys(state.credentials).length, 0);
  assert.equal((await post('/api/passkeys/register/cancel', { challengeId: options1.challengeId }, cookie)).status, 200);
  state = await snapshot(store);
  assert.equal(state.challenges[options1.challengeId], undefined);
  assert.equal(Object.keys(state.users).length, 0); assert.equal(Object.keys(state.credentials).length, 0);
});

test('잘못된 등록 응답은 실제 라이브러리에서 거절되고 질문을 재사용할 수 없다', async t => {
  const { post, store } = await setup(t);
  const start = await post('/api/passkeys/register/options', { name: 'synthetic-a', credentialName: '연습 기기' });
  const cookie = getCookie(start); const { challengeId } = await start.json();
  const body = { challengeId, response: { id: 'invalid', rawId: 'invalid', type: 'public-key', response: { clientDataJSON: 'invalid', attestationObject: 'invalid' } } };
  assert.equal((await post('/api/passkeys/register/verify', body, cookie)).status, 401);
  assert.equal((await post('/api/passkeys/register/verify', body, cookie)).status, 400);
  const state = await snapshot(store);
  assert.equal(Object.keys(state.challenges).length, 0); assert.equal(Object.keys(state.users).length, 0);
});

test('등록 질문은 브라우저에 결합되고 잘못된 출처와 만료를 거절한다', async t => {
  const { post, store } = await setup(t);
  assert.equal((await post('/api/passkeys/register/options', { name: 'synthetic-a', credentialName: '연습 기기' }, '', 'https://elsewhere.example')).status, 403);
  const start = await post('/api/passkeys/register/options', { name: 'synthetic-a', credentialName: '연습 기기' });
  const cookie = getCookie(start); const options = await start.json();
  assert.equal((await post('/api/passkeys/register/cancel', { challengeId: options.challengeId }, 't08-flow=unrelated')).status, 403);
  assert.equal((await post('/api/passkeys/register/verify', { challengeId: options.challengeId, response: {} }, 't08-flow=unrelated')).status, 403);
  await store.transact(state => { state.challenges[options.challengeId].expiresAt = Date.now() - 1; });
  assert.equal((await post('/api/passkeys/register/verify', { challengeId: options.challengeId, response: {} }, cookie)).status, 400);
  assert.equal((await snapshot(store)).challenges[options.challengeId], undefined);
});

test('합성 인증기의 정상 등록은 공개키만 저장하며 현재 계정만 패스키를 추가한다', async t => {
  const { post, store, base } = await setup(t);
  const start = await post('/api/passkeys/register/options', { name: 'synthetic-a', credentialName: '첫 연습 기기' });
  const flow = getCookie(start); const options = await start.json();
  const response = syntheticRegistration(options.publicKey.challenge);
  const registered = await post('/api/passkeys/register/verify', { challengeId: options.challengeId, response }, flow);
  assert.equal(registered.status, 200);
  assert.match(registered.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
  const session = getCookie(registered); const body = await registered.json();
  assert.equal(body.registered, true);
  let state = await snapshot(store);
  assert.equal(state.users[body.user.id].items.length, 3);
  assert.ok(state.credentials[response.id].publicKey);
  assert.equal(Object.keys(state.credentials[response.id]).some(key => /private|password/i.test(key)), false);
  assert.equal(Object.keys(state.sessions).length, 1);
  assert.equal(Object.hasOwn(state.sessions, tokenHash(session.split('=')[1])), true);
  const list = await fetch(base + '/api/passkeys', { headers: { cookie: session } });
  const listed = await list.json(); assert.equal(listed.credentials[0].name, '첫 연습 기기');
  assert.equal(listed.credentials[0].publicKey, state.credentials[response.id].publicKey);
  assert.equal((await fetch(base + '/api/passkeys')).status, 401);
  assert.equal((await post('/api/passkeys/register/options', { name: 'synthetic-a', credentialName: '공격자' })).status, 409);
  assert.equal((await post('/api/passkeys/register/options', { name: 'synthetic-b', credentialName: '다른 계정' }, session)).status, 403);
  const next = await post('/api/passkeys/register/options', { name: 'synthetic-a', credentialName: '두 번째 연습 기기' }, `${flow}; ${session}`);
  const nextOptions = await next.json(); assert.equal(next.status, 200);
  assert.equal(nextOptions.publicKey.excludeCredentials[0].id, response.id);
  const second = await post('/api/passkeys/register/verify', { challengeId: nextOptions.challengeId, response: syntheticRegistration(nextOptions.publicKey.challenge) }, `${flow}; ${session}`);
  assert.equal(second.status, 200);
  state = await snapshot(store);
  assert.equal(Object.keys(state.users).length, 1); assert.equal(Object.keys(state.credentials).length, 2);
  assert.equal(Object.keys(state.sessions).length, 1);
});

for (const variation of [
  { label: '다른 질문', alter: () => ({ challenge: 'wrong-challenge' }) },
  { label: '다른 사이트', alter: () => ({ origin: 'https://elsewhere.example' }) },
  { label: '다른 RP ID', alter: () => ({ rpID: 'elsewhere.example' }) },
  { label: '사용자 확인 없음', alter: () => ({ verified: false }) },
]) test(`등록 검증: ${variation.label} 응답을 거절한다`, async t => {
  const { post, store } = await setup(t);
  const start = await post('/api/passkeys/register/options', { name: 'synthetic-a', credentialName: '검증 연습' });
  const cookie = getCookie(start); const options = await start.json(); const change = variation.alter();
  const response = syntheticRegistration(change.challenge || options.publicKey.challenge, change);
  assert.equal((await post('/api/passkeys/register/verify', { challengeId: options.challengeId, response }, cookie)).status, 401);
  const state = await snapshot(store); assert.equal(Object.keys(state.users).length, 0); assert.equal(Object.keys(state.credentials).length, 0);
});

for (const action of ['logout', 'cancel']) test(`최초 등록 검증 중 ${action === 'logout' ? '로그아웃' : '취소'}하면 계정·패스키·세션이 생기지 않는다`, async t => {
  let revoke;
  const { post, store } = await setup(t, emptyState(), { afterConsume: () => revoke() });
  const start = await post('/api/passkeys/register/options', { name: 'synthetic-a', credentialName: '검증 중 취소 시험' });
  const cookie = getCookie(start); const options = await start.json();
  revoke = async () => {
    const result = await post(action === 'logout' ? '/api/logout' : '/api/passkeys/register/cancel', action === 'logout' ? {} : { challengeId: options.challengeId }, cookie);
    assert.equal(result.status, 200);
  };
  const result = await post('/api/passkeys/register/verify', { challengeId: options.challengeId, response: syntheticRegistration(options.publicKey.challenge) }, cookie);
  assert.equal(result.status, 401);
  const state = await snapshot(store);
  for (const records of [state.users, state.credentials, state.sessions]) assert.equal(Object.keys(records).length, 0);
});

for (const action of ['logout', 'cancel']) test(`다른 브라우저의 ${action === 'logout' ? '로그아웃' : '취소'} 요청은 검증 중인 최초 등록에 영향을 주지 않는다`, async t => {
  let revokeElsewhere;
  const { post, store } = await setup(t, emptyState(), { afterConsume: () => revokeElsewhere() });
  const start = await post('/api/passkeys/register/options', { name: 'synthetic-a', credentialName: '브라우저 격리 시험' });
  const cookie = getCookie(start); const options = await start.json();
  revokeElsewhere = async () => {
    assert.equal((await post(action === 'logout' ? '/api/logout' : '/api/passkeys/register/cancel', action === 'logout' ? {} : { challengeId: options.challengeId }, `t08-flow=${randomBytes(32).toString('base64url')}`)).status, 200);
  };
  const result = await post('/api/passkeys/register/verify', { challengeId: options.challengeId, response: syntheticRegistration(options.publicKey.challenge) }, cookie);
  assert.equal(result.status, 200); assert.equal(Object.keys((await snapshot(store)).users).length, 1);
});

for (const action of ['logout', 'cancel']) test(`${action === 'logout' ? '로그아웃' : '취소'} 뒤 새로 시작한 등록은 정상 완료할 수 있다`, async t => {
  const { post } = await setup(t);
  const start = await post('/api/passkeys/register/options', { name: 'synthetic-a', credentialName: '첫 시도' });
  const cookie = getCookie(start); const first = await start.json();
  await post(action === 'logout' ? '/api/logout' : '/api/passkeys/register/cancel', action === 'logout' ? {} : { challengeId: first.challengeId }, cookie);
  const restart = await post('/api/passkeys/register/options', { name: 'synthetic-a', credentialName: '새 시도' }, cookie);
  assert.equal(restart.status, 200); const restarted = await restart.json();
  const result = await post('/api/passkeys/register/verify', { challengeId: restarted.challengeId, response: syntheticRegistration(restarted.publicKey.challenge) }, getCookie(restart));
  assert.equal(result.status, 200);
});
