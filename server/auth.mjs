import { randomBytes, randomUUID } from 'node:crypto';
import { generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse } from '@simplewebauthn/server';
import { cookies, currentUser, httpError, json, readJson, requireSameOrigin, tokenHash } from './app.mjs';

const CHALLENGE_LIFETIME = 5 * 60 * 1000;
const SESSION_LIFETIME = 30 * 60 * 1000;
const ALGORITHMS = [-7, -257, -8];

function cookieValue(name, value, config, lifetime) {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(lifetime / 1000)}${config.production ? '; Secure' : ''}`;
}

function validateName(value) {
  if (typeof value !== 'string' || !/^[a-z0-9_-]{3,32}$/.test(value)) throw httpError(400, '가상 계정 별칭은 소문자 영문·숫자·밑줄·붙임표 3~32자로 입력해 주세요.');
  return value;
}

function validateCredentialName(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 60 || /[\u0000-\u001f\u007f]/.test(value)) throw httpError(400, '패스키 이름은 1~60자로 입력해 주세요.');
  return value.trim();
}

function optionalUser(req, state, config) {
  try { return currentUser(req, state, config); }
  catch (error) { if (error.status === 401) return null; throw error; }
}

function syntheticItems(name) {
  return [
    { id: randomUUID(), title: '가상 프로젝트 메모', body: `${name}의 합성 자료입니다. 종이비행기 분류 도구의 화면을 준비합니다.` },
    { id: randomUUID(), title: '가상 관심 목록', body: `${name}의 합성 자료입니다. 가상 연구실 달빛 1호와 별빛 2호를 비교합니다.` },
    { id: randomUUID(), title: '가상 연습 회고', body: `${name}의 합성 자료입니다. 오늘은 예제 자료로 패스키 동작을 연습했습니다.` },
  ];
}

function setRecord(records, key, value) {
  Object.defineProperty(records, key, { value, enumerable: true, writable: true, configurable: true });
}

const cancellationKey = (flowHash, challengeId) => `cancelled-registration:${flowHash}:${tokenHash(challengeId)}`;

async function registrationOptions(req, res, config, store) {
  requireSameOrigin(req, config);
  const body = await readJson(req);
  const credentialName = validateCredentialName(body.credentialName);
  const existingFlow = cookies(req)[config.flowCookie];
  let flow = typeof existingFlow === 'string' && /^[A-Za-z0-9_-]{43}$/.test(existingFlow) ? existingFlow : randomBytes(32).toString('base64url');
  const result = await store.transact(async state => {
    if (state.rates[`revoked-flow:${tokenHash(flow)}`]) flow = randomBytes(32).toString('base64url');
    const user = optionalUser(req, state, config);
    const name = validateName(body.name ?? user?.name);
    if (user && user.name !== name) throw httpError(403, '로그인한 본인 계정에만 패스키를 추가할 수 있습니다.');
    if (!user && Object.values(state.users).some(account => account.name === name)) throw httpError(409, '이미 있는 별칭입니다. 기존 패스키로 로그인한 뒤 추가해 주세요.');
    const now = Date.now();
    for (const [id, challenge] of Object.entries(state.challenges)) if (challenge.expiresAt <= now) delete state.challenges[id];
    for (const [key, entry] of Object.entries(state.rates)) if ((key.startsWith('revoked-flow:') || key.startsWith('cancelled-registration:')) && entry.expiresAt <= now) delete state.rates[key];
    if (Object.keys(state.challenges).length >= 1000) throw httpError(503, '등록 요청이 많습니다. 잠시 후 다시 시도해 주세요.');
    const userId = user?.id || randomUUID();
    const credentials = Object.values(state.credentials).filter(credential => credential.userId === userId);
    const publicKey = await generateRegistrationOptions({
      rpName: '내 소개 페이지 · 비공개 공간', rpID: config.rpID,
      userName: name, userDisplayName: name, userID: new TextEncoder().encode(userId),
      timeout: CHALLENGE_LIFETIME, attestationType: 'none',
      supportedAlgorithmIDs: ALGORITHMS,
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
      excludeCredentials: credentials.map(credential => ({ id: credential.id, transports: credential.transports })),
    });
    const challengeId = randomUUID();
    state.challenges[challengeId] = {
      id: challengeId, type: 'registration', challenge: publicKey.challenge,
      flowHash: tokenHash(flow), userId, name, credentialName,
      isNew: !user, sessionHash: user ? tokenHash(cookies(req)[config.sessionCookie]) : null,
      authEpoch: user?.authEpoch || 0,
      createdAt: now, expiresAt: now + CHALLENGE_LIFETIME,
    };
    return { challengeId, publicKey };
  });
  res.setHeader('Set-Cookie', cookieValue(config.flowCookie, flow, config, CHALLENGE_LIFETIME));
  json(res, 200, result);
}

async function consumeRegistration(req, body, config, store) {
  const flow = cookies(req)[config.flowCookie];
  if (typeof body.challengeId !== 'string' || !flow) throw httpError(400, '등록 질문을 먼저 받아 주세요.');
  // Commit consumption before verification: invalid proofs must not restore the challenge.
  const result = await store.transact(state => {
    const challenge = Object.hasOwn(state.challenges, body.challengeId) && state.challenges[body.challengeId];
    if (!challenge || challenge.type !== 'registration') return { error: 400, message: '등록 질문을 이미 사용했거나 찾을 수 없습니다. 다시 시작해 주세요.' };
    if (challenge.flowHash !== tokenHash(flow)) return { error: 403, message: '등록을 시작한 브라우저에서 다시 시도해 주세요.' };
    delete state.challenges[body.challengeId];
    if (challenge.expiresAt <= Date.now()) return { error: 400, message: '등록 질문이 만료되었습니다. 다시 시작해 주세요.' };
    if (state.rates[`revoked-flow:${challenge.flowHash}`] || state.rates[cancellationKey(challenge.flowHash, challenge.id)]) return { error: 401, message: '취소된 등록입니다. 다시 시작해 주세요.' };
    if (!challenge.isNew) {
      const user = optionalUser(req, state, config);
      const session = cookies(req)[config.sessionCookie];
      if (!user || user.id !== challenge.userId || !session || tokenHash(session) !== challenge.sessionHash) return { error: 401, message: '기존 패스키로 다시 로그인한 뒤 추가해 주세요.' };
    }
    return { challenge };
  });
  if (result.error) throw httpError(result.error, result.message);
  return result.challenge;
}

async function registrationVerify(req, res, config, store) {
  requireSameOrigin(req, config);
  const body = await readJson(req);
  const challenge = await consumeRegistration(req, body, config, store);
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body.response, expectedChallenge: challenge.challenge,
      expectedOrigin: config.origin, expectedRPID: config.rpID,
      requireUserPresence: true, requireUserVerification: true, supportedAlgorithmIDs: ALGORITHMS,
    });
  } catch { throw httpError(401, '패스키 등록 응답을 확인하지 못했습니다. 다시 등록해 주세요.'); }
  if (!verification.verified) throw httpError(401, '패스키 등록 응답을 확인하지 못했습니다.');
  const { credential, credentialDeviceType, credentialBackedUp, aaguid } = verification.registrationInfo;
  const token = randomBytes(32).toString('base64url');
  const user = await store.transact(state => {
    if (challenge.expiresAt <= Date.now()) throw httpError(400, '등록 질문이 만료되었습니다. 다시 시작해 주세요.');
    if (state.rates[`revoked-flow:${challenge.flowHash}`] || state.rates[cancellationKey(challenge.flowHash, challenge.id)]) throw httpError(401, '취소된 등록입니다. 다시 시작해 주세요.');
    if (Object.hasOwn(state.credentials, credential.id)) throw httpError(409, '이미 등록된 패스키입니다.');
    if (challenge.isNew) {
      if (Object.values(state.users).some(account => account.name === challenge.name)) throw httpError(409, '이미 있는 별칭입니다. 다른 가상 별칭으로 다시 시작해 주세요.');
      state.users[challenge.userId] = { id: challenge.userId, name: challenge.name, synthetic: true, createdAt: new Date().toISOString(), items: syntheticItems(challenge.name) };
    } else {
      const authenticated = currentUser(req, state, config);
      if (authenticated.id !== challenge.userId || tokenHash(cookies(req)[config.sessionCookie]) !== challenge.sessionHash) throw httpError(403, '로그인한 본인 계정에만 패스키를 추가할 수 있습니다.');
      if ((authenticated.authEpoch || 0) !== (challenge.authEpoch || 0)) throw httpError(401, '패스키 목록이 바뀌었습니다. 등록을 다시 시작해 주세요.');
    }
    const account = state.users[challenge.userId];
    setRecord(state.credentials, credential.id, {
      id: credential.id, userId: account.id, name: challenge.credentialName,
      createdAt: new Date().toISOString(), publicKey: Buffer.from(credential.publicKey).toString('base64url'),
      counter: credential.counter, transports: credential.transports || [],
      deviceType: credentialDeviceType, backedUp: credentialBackedUp, aaguid,
    });
    const previousToken = cookies(req)[config.sessionCookie];
    if (previousToken) delete state.sessions[tokenHash(previousToken)];
    state.sessions[tokenHash(token)] = { userId: account.id, credentialId: credential.id, expiresAt: Date.now() + SESSION_LIFETIME };
    return { id: account.id, name: account.name };
  });
  res.setHeader('Set-Cookie', cookieValue(config.sessionCookie, token, config, SESSION_LIFETIME));
  json(res, 200, { registered: true, user });
}

async function registrationCancel(req, res, config, store) {
  requireSameOrigin(req, config);
  const body = await readJson(req);
  const flow = cookies(req)[config.flowCookie];
  if (typeof body.challengeId !== 'string' || !flow) throw httpError(400, '취소할 등록 질문을 확인해 주세요.');
  await store.transact(state => {
    const challenge = Object.hasOwn(state.challenges, body.challengeId) && state.challenges[body.challengeId];
    if (challenge && (challenge.type !== 'registration' || challenge.flowHash !== tokenHash(flow))) throw httpError(403, '등록을 시작한 브라우저에서 취소해 주세요.');
    if (challenge) delete state.challenges[body.challengeId];
    // This flow-specific marker also reaches an already-consumed proof under verification.
    state.rates[cancellationKey(tokenHash(flow), body.challengeId)] = { expiresAt: Date.now() + CHALLENGE_LIFETIME };
  });
  json(res, 200, { cancelled: true, message: '등록 취소 요청을 처리했습니다. 완료 전 등록은 저장하지 않습니다.' });
}

async function authenticationOptions(req, res, config, store) {
  requireSameOrigin(req, config);
  const { name: inputName } = await readJson(req);
  const name = validateName(inputName);
  // A new browser flow also avoids reviving an attempt revoked by logout.
  const flow = randomBytes(32).toString('base64url');
  const result = await store.transact(async state => {
    const user = Object.values(state.users).find(account => account.name === name);
    const credentials = user && Object.values(state.credentials).filter(credential => credential.userId === user.id);
    if (!user || !credentials.length) throw httpError(401, '이 계정에서 사용할 수 있는 패스키가 없습니다. 별칭과 등록 상태를 확인해 주세요.');
    const now = Date.now();
    for (const [id, challenge] of Object.entries(state.challenges)) if (challenge.expiresAt <= now) delete state.challenges[id];
    for (const [key, entry] of Object.entries(state.rates)) if (key.startsWith('revoked-flow:') && entry.expiresAt <= now) delete state.rates[key];
    if (Object.keys(state.challenges).length >= 1000) throw httpError(503, '로그인 요청이 많습니다. 잠시 후 다시 시도해 주세요.');
    const publicKey = await generateAuthenticationOptions({
      rpID: config.rpID, timeout: CHALLENGE_LIFETIME, userVerification: 'required',
      allowCredentials: credentials.map(credential => ({ id: credential.id, transports: credential.transports })),
    });
    const challengeId = randomUUID();
    const session = cookies(req)[config.sessionCookie];
    state.challenges[challengeId] = {
      id: challengeId, type: 'authentication', challenge: publicKey.challenge,
      userId: user.id, flowHash: tokenHash(flow), sessionHash: session ? tokenHash(session) : null,
      authEpoch: user.authEpoch || 0,
      createdAt: now, expiresAt: now + CHALLENGE_LIFETIME,
    };
    return { challengeId, publicKey };
  });
  res.setHeader('Set-Cookie', cookieValue(config.flowCookie, flow, config, CHALLENGE_LIFETIME));
  json(res, 200, result);
}

async function consumeAuthentication(req, body, config, store) {
  const flow = cookies(req)[config.flowCookie];
  if (typeof body.challengeId !== 'string' || !flow) throw httpError(400, '로그인 질문을 먼저 받아 주세요.');
  const result = await store.transact(state => {
    const challenge = Object.hasOwn(state.challenges, body.challengeId) && state.challenges[body.challengeId];
    if (!challenge || challenge.type !== 'authentication') return { error: 400, message: '로그인 질문을 이미 사용했거나 찾을 수 없습니다. 다시 시작해 주세요.' };
    if (challenge.flowHash !== tokenHash(flow)) return { error: 403, message: '로그인을 시작한 브라우저에서 다시 시도해 주세요.' };
    delete state.challenges[body.challengeId];
    if (challenge.expiresAt <= Date.now()) return { error: 400, message: '로그인 질문이 만료되었습니다. 다시 시작해 주세요.' };
    if (state.rates[`revoked-flow:${challenge.flowHash}`]) return { error: 401, message: '취소된 로그인입니다. 다시 시작해 주세요.' };
    const credentialId = body.response?.id;
    const credential = typeof credentialId === 'string' && Object.hasOwn(state.credentials, credentialId) && state.credentials[credentialId];
    if (!credential || credential.userId !== challenge.userId || !state.users[challenge.userId]) return { error: 401, message: '이 계정에 등록된 패스키로 로그인해 주세요.' };
    const userHandle = body.response?.response?.userHandle;
    if (userHandle && userHandle !== Buffer.from(challenge.userId).toString('base64url')) return { error: 401, message: '패스키의 계정 정보를 확인하지 못했습니다.' };
    return { challenge, credential: structuredClone(credential) };
  });
  if (result.error) throw httpError(result.error, result.message);
  return result;
}

async function authenticationVerify(req, res, config, store) {
  requireSameOrigin(req, config);
  const body = await readJson(req);
  // Consumption is committed independently of signature verification and session creation.
  const { challenge, credential } = await consumeAuthentication(req, body, config, store);
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body.response, expectedChallenge: challenge.challenge,
      expectedOrigin: config.origin, expectedRPID: config.rpID, requireUserVerification: true,
      credential: { id: credential.id, publicKey: Buffer.from(credential.publicKey, 'base64url'), counter: credential.counter, transports: credential.transports },
    });
  } catch { throw httpError(401, '패스키 서명을 확인하지 못했습니다. 새 질문으로 다시 로그인해 주세요.'); }
  if (!verification.verified) throw httpError(401, '패스키 서명을 확인하지 못했습니다.');
  const token = randomBytes(32).toString('base64url');
  const user = await store.transact(state => {
    const current = Object.hasOwn(state.credentials, credential.id) && state.credentials[credential.id];
    const account = state.users[challenge.userId];
    if (!current || current.userId !== challenge.userId || !account || state.rates[`revoked-flow:${challenge.flowHash}`] || (account.authEpoch || 0) !== (challenge.authEpoch || 0)) throw httpError(401, '패스키가 삭제되었거나 로그인이 취소되었습니다. 다시 시작해 주세요.');
    // Compare-and-swap also protects authenticators whose signature counter stays at zero.
    if (current.publicKey !== credential.publicKey || current.counter !== credential.counter || (current.authVersion || 0) !== (credential.authVersion || 0)) throw httpError(401, '다른 로그인에서 패스키 상태가 바뀌었습니다. 새 질문으로 다시 시도해 주세요.');
    current.counter = verification.authenticationInfo.newCounter;
    current.authVersion = (current.authVersion || 0) + 1;
    current.deviceType = verification.authenticationInfo.credentialDeviceType;
    current.backedUp = verification.authenticationInfo.credentialBackedUp;
    current.lastUsedAt = new Date().toISOString();
    const previousToken = cookies(req)[config.sessionCookie];
    if (previousToken) delete state.sessions[tokenHash(previousToken)];
    state.sessions[tokenHash(token)] = { userId: account.id, credentialId: current.id, expiresAt: Date.now() + SESSION_LIFETIME };
    return { id: account.id, name: account.name };
  });
  res.setHeader('Set-Cookie', cookieValue(config.sessionCookie, token, config, SESSION_LIFETIME));
  json(res, 200, { authenticated: true, user });
}

async function logout(req, res, config, store) {
  requireSameOrigin(req, config);
  await readJson(req);
  const requestCookies = cookies(req);
  const session = requestCookies[config.sessionCookie];
  const sessionHash = session ? tokenHash(session) : null;
  const flow = requestCookies[config.flowCookie];
  const flowHash = flow ? tokenHash(flow) : null;
  await store.transact(state => {
    if (sessionHash) delete state.sessions[sessionHash];
    for (const [id, challenge] of Object.entries(state.challenges)) {
      if ((flowHash && challenge.flowHash === flowHash) || (sessionHash && challenge.sessionHash === sessionHash)) delete state.challenges[id];
    }
    // Revocation remains visible if a signature is being checked concurrently with logout.
    if (flowHash) state.rates[`revoked-flow:${flowHash}`] = { expiresAt: Date.now() + CHALLENGE_LIFETIME };
  });
  res.setHeader('Set-Cookie', [cookieValue(config.sessionCookie, '', config, 0), cookieValue(config.flowCookie, '', config, 0)]);
  json(res, 200, { loggedOut: true });
}

async function deleteCredential(req, res, credentialId, config, store) {
  requireSameOrigin(req, config);
  await readJson(req);
  const sessionToken = cookies(req)[config.sessionCookie];
  const result = await store.transact(state => {
    const user = currentUser(req, state, config);
    const credential = Object.hasOwn(state.credentials, credentialId) && state.credentials[credentialId];
    if (!credential) throw httpError(404, '이 패스키는 이미 삭제되었거나 찾을 수 없습니다.');
    if (credential.userId !== user.id) throw httpError(403, '다른 계정의 패스키는 삭제할 수 없습니다.');
    delete state.credentials[credentialId];
    const remaining = Object.values(state.credentials).filter(key => key.userId === user.id).length;
    // Invalidate even an already-consumed proof being verified outside this transaction.
    user.authEpoch = (user.authEpoch || 0) + 1;
    for (const [id, challenge] of Object.entries(state.challenges)) {
      if (challenge.userId !== user.id) continue;
      if (challenge.flowHash) state.rates[`revoked-flow:${challenge.flowHash}`] = { expiresAt: Date.now() + CHALLENGE_LIFETIME };
      delete state.challenges[id];
    }
    for (const [hash, session] of Object.entries(state.sessions)) {
      if (session.userId === user.id && (remaining === 0 || session.credentialId === credentialId)) delete state.sessions[hash];
    }
    const loggedOut = !Object.hasOwn(state.sessions, tokenHash(sessionToken));
    return {
      deleted: true, remaining, loggedOut,
      message: remaining === 0
        ? '마지막 패스키를 삭제했습니다. 모든 세션을 종료했으며 이 계정에 다시 로그인할 수 없습니다. 계정과 가상 자료는 남지만 복구 수단은 없습니다.'
        : `패스키를 삭제했습니다. 남은 패스키 ${remaining}개를 사용할 수 있습니다.${loggedOut ? ' 삭제한 패스키로 만든 세션이 종료되었으므로 남은 패스키로 다시 로그인해 주세요.' : ''}`,
    };
  });
  if (result.loggedOut) res.setHeader('Set-Cookie', [cookieValue(config.sessionCookie, '', config, 0), cookieValue(config.flowCookie, '', config, 0)]);
  json(res, 200, result);
}

export async function authRoutes({ req, res, path, config, store }) {
  if (path === '/api/passkeys/register/options' && req.method === 'POST') { await registrationOptions(req, res, config, store); return true; }
  if (path === '/api/passkeys/register/verify' && req.method === 'POST') { await registrationVerify(req, res, config, store); return true; }
  if (path === '/api/passkeys/register/cancel' && req.method === 'POST') { await registrationCancel(req, res, config, store); return true; }
  if (path === '/api/passkeys/login/options' && req.method === 'POST') { await authenticationOptions(req, res, config, store); return true; }
  if (path === '/api/passkeys/login/verify' && req.method === 'POST') { await authenticationVerify(req, res, config, store); return true; }
  if (path === '/api/logout' && req.method === 'POST') { await logout(req, res, config, store); return true; }
  const deletion = /^\/api\/passkeys\/([^/]+)$/.exec(path);
  if (deletion && req.method === 'DELETE') { await deleteCredential(req, res, deletion[1], config, store); return true; }
  if (path === '/api/passkeys' && req.method === 'GET') {
    const result = await store.transact(state => {
      const user = currentUser(req, state, config);
      const credentials = Object.values(state.credentials).filter(credential => credential.userId === user.id).map(({ id, name, createdAt, publicKey, deviceType, backedUp, transports }) => ({ id, name, createdAt, publicKey, deviceType, backedUp, transports }));
      return { credentials };
    });
    json(res, 200, result);
    return true;
  }
  return false;
}
