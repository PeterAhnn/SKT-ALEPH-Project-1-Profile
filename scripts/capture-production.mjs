import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { chromium } from 'playwright';

// Run only against the explicitly supplied, approved production origin.
const input = process.argv[2];
if (!input) throw new Error('사용법: node scripts/capture-production.mjs https://승인된-운영주소');
const parsed = new URL(input);
assert.equal(parsed.protocol, 'https:', '운영 검증에는 HTTPS 주소가 필요합니다.');
assert.ok(!parsed.username && !parsed.password && !parsed.search && !parsed.hash && parsed.pathname === '/', '인증값·경로 없이 운영 origin만 입력해 주세요.');
const origin = parsed.origin;
const suffix = `${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;
const runId = `run-${suffix}`;
const output = fileURLToPath(new URL(`../verification/production/${runId}/`, import.meta.url));
const kind = '승인된 운영 HTTPS 서버에 개인 Chrome과 분리한 Chromium 가상 WebAuthn 인증기로 접속한 자동 시험입니다. 서버 자료·세션을 직접 주입하지 않았습니다. 사용자 실제 기기·Windows Hello·구글 비밀번호 관리자·보안 키 시험이 아닙니다.';
const names = { a: `prod-${suffix}-a`, b: `prod-${suffix}-b` };
const keyNames = { first: '운영 자동 시험 A 첫 가상 인증기', backup: '운영 자동 시험 A 예비 가상 인증기', other: '운영 자동 시험 B 가상 인증기' };
const records = [];
const pendingRecords = new Set();
const knownCookieValues = new Set();
const checks = {};
let browser;
let result = '실패';
let failure;

function safe(value) {
  if (Array.isArray(value)) return value.map(safe);
  if (value && typeof value === 'object') {
    const answer = {};
    for (const [key, item] of Object.entries(value)) {
      if (/^(cookie|set-cookie|authorization|privatekey|password|sessiontoken|accesstoken|refreshtoken)$/i.test(key)) answer[key] = '[가림]';
      else answer[key] = safe(item);
    }
    return answer;
  }
  if (typeof value === 'string') {
    let answer = value;
    for (const cookie of knownCookieValues) if (cookie) answer = answer.replaceAll(cookie, '[가림]');
    return answer;
  }
  return value;
}

async function rememberCookies(actor) {
  for (const cookie of await actor.context.cookies()) knownCookieValues.add(cookie.value);
}

async function api(actor, method, path, body, label, cookieOverride) {
  const headers = { ...(method === 'GET' ? {} : { origin, 'content-type': 'application/json' }), ...(cookieOverride ? { cookie: cookieOverride } : {}) };
  const response = await actor.context.request.fetch(origin + path, { method, headers, ...(body === undefined ? {} : { data: body }) });
  const data = await response.json();
  await rememberCookies(actor);
  records.push(safe({ label, actor: actor.label, request: { method, path, cookie: '[가림]', ...(body === undefined ? {} : { body }) }, response: { status: response.status(), body: data, setCookie: response.headers()['set-cookie'] ? '[가림]' : undefined } }));
  return { status: response.status(), body: data };
}

async function actor(label) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 960 }, colorScheme: 'light' });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const cdp = await context.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const person = { label, context, page, cdp, authenticatorId: null };
  await replaceAuthenticator(person);
  page.on('response', response => {
    if (new URL(response.url()).origin !== origin || !new URL(response.url()).pathname.startsWith('/api/')) return;
    const task = (async () => {
      const request = response.request();
      const body = request.postData() ? request.postDataJSON() : undefined;
      const responseBody = await response.json();
      await rememberCookies(person);
      records.push(safe({ label: '서비스 화면이 실제로 보낸 요청', actor: label, request: { method: request.method(), path: new URL(request.url()).pathname + new URL(request.url()).search, cookie: '[가림]', ...(body === undefined ? {} : { body }) }, response: { status: response.status(), body: responseBody } }));
    })();
    pendingRecords.add(task);
    void task.catch(error => { failure ||= '서비스 화면 요청 기록을 수집하지 못했습니다: ' + error.message; }).finally(() => pendingRecords.delete(task));
  });
  page.on('dialog', dialog => dialog.accept());
  await page.goto(origin, { waitUntil: 'networkidle' });
  return person;
}

async function replaceAuthenticator(person, credential) {
  if (person.authenticatorId) await person.cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId: person.authenticatorId });
  person.authenticatorId = (await person.cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } })).authenticatorId;
  // An exported credential includes its private key. It remains in RAM only.
  if (credential) await person.cdp.send('WebAuthn.addCredential', { authenticatorId: person.authenticatorId, credential });
}

async function deviceCredential(person) {
  const device = await person.cdp.send('WebAuthn.getCredentials', { authenticatorId: person.authenticatorId });
  assert.equal(device.credentials.length, 1);
  return device.credentials[0];
}

async function register(person, name, credentialName, additional = false) {
  if (additional) assert.equal(await person.page.locator('#account-name').inputValue(), name);
  else await person.page.locator('#account-name').fill(name);
  await person.page.locator('#credential-name').fill(credentialName);
  const verified = person.page.waitForResponse(response => new URL(response.url()).pathname === '/api/passkeys/register/verify');
  await person.page.locator('#register-passkey').click();
  const response = await verified;
  assert.equal(response.status(), 200, JSON.stringify(await response.json()));
  const data = await response.json();
  await person.page.locator('#private-content article').nth(2).waitFor();
  await person.page.locator('#passkey-management').waitFor();
  await person.page.waitForFunction(() => !document.querySelector('#register-passkey').disabled);
  await rememberCookies(person);
  return data.user;
}

async function logout(person, label) {
  const response = await api(person, 'POST', '/api/logout', {}, label);
  assert.equal(response.status, 200);
  await person.page.reload({ waitUntil: 'networkidle' });
  assert.equal(await person.page.locator('#private-content').isVisible(), false);
}

async function options(person, name, label) {
  const response = await api(person, 'POST', '/api/passkeys/login/options', { name }, label);
  assert.equal(response.status, 200, JSON.stringify(response.body));
  return response.body;
}

async function sign(person, suppliedOptions, overrideCredentialId) {
  return person.page.evaluate(async ({ optionsJSON, credentialId }) => {
    if (credentialId) optionsJSON.allowCredentials = [{ type: 'public-key', id: credentialId }];
    return window.SimpleWebAuthnBrowser.startAuthentication({ optionsJSON });
  }, { optionsJSON: structuredClone(suppliedOptions.publicKey), credentialId: overrideCredentialId });
}

async function login(person, name, label) {
  const start = await options(person, name, `${label}: 새 질문`);
  const response = await sign(person, start);
  const proof = { challengeId: start.challengeId, response };
  const verified = await api(person, 'POST', '/api/passkeys/login/verify', proof, `${label}: 서명 검증`);
  assert.equal(verified.status, 200, JSON.stringify(verified.body));
  return proof;
}

async function removeByUI(person, credentialName, expectedRemaining) {
  const waiting = person.page.waitForResponse(response => response.request().method() === 'DELETE' && new URL(response.url()).pathname.startsWith('/api/passkeys/'));
  await person.page.getByRole('button', { name: `${credentialName} 삭제`, exact: true }).click();
  const response = await waiting;
  const data = await response.json();
  assert.equal(response.status(), 200);
  assert.equal(data.remaining, expectedRemaining);
  if (expectedRemaining === 0) await person.page.getByRole('status').getByText('패스키를 모두 삭제했습니다.', { exact: false }).waitFor();
  else await person.page.getByRole('status').getByText(`남은 패스키는 ${expectedRemaining}개입니다.`, { exact: false }).waitFor();
  return data;
}

await mkdir(output, { recursive: true });
try {
  browser = await chromium.launch({ headless: true });
  const a = await actor('가상 계정 A');
  const publicResponse = await a.context.request.get(origin + '/');
  const publicHTML = await publicResponse.text();
  assert.equal(publicResponse.status(), 200);
  assert.equal(publicHTML, await readFile(new URL('../index.html', import.meta.url), 'utf8'), '운영 첫 화면과 현재 로컬 소개 소스가 다릅니다.');
  assert.ok(!publicHTML.includes('의 합성 자료입니다.'));
  assert.equal(await a.page.locator('#private-content').isVisible(), false);
  assert.equal(await a.page.locator('input[type="password"]').count(), 0);
  assert.equal((await api(a, 'GET', '/api/private/items', undefined, '로그인 없는 비공개 자료 조회')).status, 401);
  await writeFile(join(output, 'unauthenticated.html'), publicHTML);
  await a.page.screenshot({ path: join(output, 'public-page.png'), fullPage: true });
  await a.page.locator('#private-space').screenshot({ path: join(output, 'locked.png') });
  checks.public = { status: 200, localSourceIdentical: true, sha256: createHash('sha256').update(publicHTML).digest('hex'), privateContentInHTML: false, anonymousPrivateStatus: 401, passwordInputCount: 0 };

  const accountA = await register(a, names.a, keyNames.first);
  const firstList = await api(a, 'GET', '/api/passkeys', undefined, 'A 첫 등록 공개키 목록');
  assert.equal(firstList.status, 200);
  assert.equal(firstList.body.credentials.length, 1);
  const keyA1 = firstList.body.credentials[0];
  assert.equal(keyA1.name, keyNames.first);
  assert.ok(keyA1.publicKey && keyA1.createdAt);
  let deviceA1 = await deviceCredential(a);
  const registrationQuestions = [];
  for (let index = 0; index < 2; index += 1) {
    const question = await api(a, 'POST', '/api/passkeys/register/options', { name: names.a, credentialName: '운영 자동 시험 질문 비교' }, `등록 질문 ${index + 1}`);
    assert.equal(question.status, 200);
    registrationQuestions.push(question.body);
  }
  assert.notEqual(registrationQuestions[0].publicKey.challenge, registrationQuestions[1].publicKey.challenge);
  for (const question of registrationQuestions) assert.equal((await api(a, 'POST', '/api/passkeys/register/cancel', { challengeId: question.challengeId }, '질문 비교 후 등록 취소')).status, 200);
  await replaceAuthenticator(a);
  await register(a, names.a, keyNames.backup, true);
  const secondList = await api(a, 'GET', '/api/passkeys', undefined, '독립 가상 인증기 두 개의 서버 공개키 목록');
  assert.equal(secondList.body.credentials.length, 2);
  const keyA2 = secondList.body.credentials.find(key => key.id !== keyA1.id);
  assert.ok(keyA2?.publicKey && keyA2.createdAt);
  assert.equal(keyA2.name, keyNames.backup);
  await a.page.locator('#private-space').screenshot({ path: join(output, 'two-passkeys.png') });
  checks.registration = { account: accountA, freshChallenges: registrationQuestions.map(question => question.publicKey.challenge), publicKeys: secondList.body.credentials, storageLocation: 'Chromium 메모리의 서로 독립한 가상 WebAuthn 인증기 2개입니다. 사용자 실제 저장 위치는 확인하지 않았습니다.' };

  const b = await actor('가상 계정 B');
  const accountB = await register(b, names.b, keyNames.other);
  const listB = await api(b, 'GET', '/api/passkeys', undefined, 'B 등록 공개키 목록');
  assert.equal(listB.body.credentials.length, 1);
  const keyB = listB.body.credentials[0];
  await logout(b, 'B 등록 뒤 로그아웃');
  await login(b, names.b, 'B 본인 패스키 로그인');
  await logout(a, 'A 등록 뒤 로그아웃');

  const loginQuestions = [await options(a, names.a, '로그인 질문 1'), await options(a, names.a, '로그인 질문 2')];
  assert.notEqual(loginQuestions[0].publicKey.challenge, loginQuestions[1].publicKey.challenge);
  const invalidProof = await sign(a, loginQuestions[1]);
  const changedSignature = Buffer.from(invalidProof.response.signature, 'base64url');
  changedSignature[changedSignature.length - 1] ^= 1;
  invalidProof.response.signature = changedSignature.toString('base64url');
  assert.equal((await api(a, 'POST', '/api/passkeys/login/verify', { challengeId: loginQuestions[1].challengeId, response: invalidProof }, '변조 서명 거절')).status, 401);
  const validProof = await login(a, names.a, 'A 본인 패스키 정상 로그인');
  assert.equal((await api(a, 'POST', '/api/passkeys/login/verify', validProof, '이미 성공한 질문·서명 재사용')).status, 400);
  const crossQuestion = await options(a, names.a, '남의 패스키 시험용 A 로그인 질문');
  const otherProof = await sign(b, crossQuestion, keyB.id);
  assert.equal((await api(a, 'POST', '/api/passkeys/login/verify', { challengeId: crossQuestion.challengeId, response: otherProof }, 'B 패스키 서명으로 A 로그인 시도')).status, 401);
  checks.authentication = { freshChallenges: loginQuestions.map(question => question.publicKey.challenge), validSignature: 200, invalidSignature: 401, replay: 400, otherAccountSignature: 401, otherKeyTest: '클라이언트 allowCredentials만 B의 실제 가상 패스키 ID로 지정해 서명했습니다. 서버 상태와 검증기는 변경하지 않았습니다.' };

  const ownA = await api(a, 'GET', '/api/private/items', undefined, 'A 정상 자료 조회');
  const ownB = await api(b, 'GET', '/api/private/items', undefined, 'B 정상 자료 조회');
  assert.equal(ownA.status, 200); assert.equal(ownB.status, 200);
  assert.equal(ownA.body.owner, accountA.id); assert.equal(ownB.body.owner, accountB.id);
  assert.equal(ownA.body.synthetic, true); assert.equal(ownB.body.synthetic, true);
  assert.equal(ownA.body.items.length, 3); assert.equal(ownB.body.items.length, 3);
  assert.notDeepEqual(ownA.body.items, ownB.body.items);
  assert.equal((await api(a, 'GET', `/api/private/accounts/${accountB.id}/items`, undefined, 'A에서 B 자료 접근 거절')).status, 403);
  assert.equal((await api(b, 'GET', `/api/private/accounts/${accountA.id}/items`, undefined, 'B에서 A 자료 접근 거절')).status, 403);
  const queryA = await api(a, 'GET', `/api/private/items?userId=${accountB.id}&owner=${accountB.id}`, undefined, 'A가 주소에 B 계정을 지정');
  const queryB = await api(b, 'GET', `/api/private/items?userId=${accountA.id}&owner=${accountA.id}`, undefined, 'B가 주소에 A 계정을 지정');
  assert.equal(queryA.status, 200); assert.equal(queryB.status, 200);
  assert.deepEqual(queryA.body, ownA.body); assert.deepEqual(queryB.body, ownB.body);
  const afterA = await api(a, 'GET', '/api/private/items', undefined, '거절 후 A 자료 건수 확인');
  const afterB = await api(b, 'GET', '/api/private/items', undefined, '거절 후 B 자료 건수 확인');
  assert.deepEqual(afterA.body, ownA.body); assert.deepEqual(afterB.body, ownB.body);
  checks.isolation = { accounts: [accountA, accountB], countsBefore: { a: ownA.body.items.length, b: ownB.body.items.length }, countsAfter: { a: afterA.body.items.length, b: afterB.body.items.length }, aToB: 403, bToA: 403, queryTamperingReturnsOwnData: true };
  for (const person of [a, b]) {
    await person.page.reload({ waitUntil: 'networkidle' });
    await person.page.locator('#private-content article').nth(2).waitFor();
    await person.page.locator('#private-space').screenshot({ path: join(output, person === a ? 'account-a.png' : 'account-b.png') });
  }

  const sessionCookie = (await a.context.cookies()).find(cookie => cookie.name === '__Host-t08-session');
  assert.ok(sessionCookie?.httpOnly && sessionCookie.secure && sessionCookie.sameSite === 'Strict');
  knownCookieValues.add(sessionCookie.value);
  await logout(a, '로그아웃 뒤 세션 폐기 확인');
  assert.equal((await api(a, 'GET', '/api/private/items', undefined, '로그아웃 전 쿠키 값을 다시 전송', `${sessionCookie.name}=${sessionCookie.value}`)).status, 401);
  await a.page.locator('#private-space').screenshot({ path: join(output, 'logged-out.png') });
  checks.logout = { oldSessionReused: 401, cookieFlags: { httpOnly: sessionCookie.httpOnly, secure: sessionCookie.secure, sameSite: sessionCookie.sameSite }, cookie: '[가림]' };

  await login(a, names.a, '삭제 시험 전 A 예비 패스키 로그인');
  await a.page.reload({ waitUntil: 'networkidle' });
  await a.page.locator('#passkey-list li').nth(1).waitFor();
  const removedFirst = await removeByUI(a, keyNames.first, 1);
  await logout(a, '첫 패스키 삭제 뒤 로그아웃');
  let deviceA2 = await deviceCredential(a);
  await replaceAuthenticator(a, deviceA1);
  const deletedQuestion = await options(a, names.a, '삭제된 패스키 재로그인 질문');
  assert.ok(!deletedQuestion.publicKey.allowCredentials.some(key => key.id === keyA1.id));
  const deletedProof = await sign(a, deletedQuestion, keyA1.id);
  assert.equal((await api(a, 'POST', '/api/passkeys/login/verify', { challengeId: deletedQuestion.challengeId, response: deletedProof }, '삭제된 패스키의 실제 서명 거절')).status, 401);
  await replaceAuthenticator(a, deviceA2);
  deviceA1 = undefined; deviceA2 = undefined;
  await login(a, names.a, '남은 예비 패스키 로그인');
  await a.page.reload({ waitUntil: 'networkidle' });
  await a.page.locator('#private-content article').nth(2).waitFor();
  await a.page.locator('#private-space').screenshot({ path: join(output, 'remaining-passkey-login.png') });
  const finalSession = (await a.context.cookies()).find(cookie => cookie.name === '__Host-t08-session');
  assert.ok(finalSession); knownCookieValues.add(finalSession.value);
  const removedLast = await removeByUI(a, keyNames.backup, 0);
  assert.equal(removedLast.loggedOut, true);
  assert.equal(await a.page.locator('#private-content').isVisible(), false);
  assert.equal((await api(a, 'POST', '/api/passkeys/login/options', { name: names.a }, '패스키 0개 계정 로그인')).status, 401);
  assert.equal((await api(a, 'POST', '/api/passkeys/register/options', { name: names.a, credentialName: '0개 계정 재등록 시도' }, '패스키 0개 계정의 익명 재등록 거절')).status, 409);
  assert.equal((await api(a, 'GET', '/api/private/items', undefined, '마지막 키 삭제 전 세션 재사용', `${finalSession.name}=${finalSession.value}`)).status, 401);
  await a.page.locator('#private-space').screenshot({ path: join(output, 'no-passkeys.png') });
  checks.deletion = { firstDelete: removedFirst, deletedKeyLogin: 401, remainingKeyLogin: 200, lastDelete: removedLast, zeroKeyLogin: 401, anonymousReregistration: 409, finalSessionReuse: 401, deletedKeyTest: '클라이언트 allowCredentials만 삭제된 키 ID로 지정했습니다. 서버 상태와 검증기는 변경하지 않았습니다.', policy: '0개 계정과 합성 자료는 남지만 패스키 로그인과 비밀번호·이메일 복구는 제공하지 않습니다.' };

  const cleanupB = await api(b, 'DELETE', `/api/passkeys/${encodeURIComponent(keyB.id)}`, {}, '자동 시험 종료 후 B 가상 패스키 삭제');
  assert.equal(cleanupB.status, 200); assert.equal(cleanupB.body.remaining, 0);
  checks.residualSyntheticAccounts = { names, aPasskeys: 0, bPasskeys: 0, note: '자동 시험에서 만든 가상 계정과 합성 자료는 운영 DB에 남습니다. 가상 패스키는 모두 삭제했습니다. 개인키를 파일로 보관하지 않았습니다.' };
  await Promise.all([...pendingRecords]);
  if (failure) throw new Error(failure);
  result = '자동 시험 통과';
} catch (error) {
  failure = error.message;
  process.exitCode = 1;
} finally {
  await Promise.allSettled([...pendingRecords]);
  await browser?.close();
  const evidence = safe({ checkedAt: new Date().toISOString(), runId, origin, kind, result, failure, checks, records, limits: ['실제 사용자 기기 등록·취소·저장 위치를 확인한 기록이 아닙니다.', '공식 제출·심사·승인 결과가 아닙니다.', '실패한 실행에서는 이미 생성된 가상 계정·키가 일부 남을 수 있습니다. 해당 실행 기록의 마지막 성공 요청을 확인합니다.'] });
  const serialized = JSON.stringify(evidence, null, 2);
  for (const cookie of knownCookieValues) if (cookie) assert.ok(!serialized.includes(cookie), '저장하려는 기록에 쿠키 비밀값이 남아 있습니다.');
  assert.ok(!/"privateKey"\s*:/.test(serialized), '저장하려는 기록에 인증기 개인키가 남아 있습니다.');
  await writeFile(join(output, 'production-evidence.json'), serialized);
  console.log(JSON.stringify({ result, evidenceDirectory: output, failure: failure ? safe(failure) : undefined }));
}
