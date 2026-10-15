import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.mjs';
import { authRoutes } from '../server/auth.mjs';
import { LocalStore } from '../server/store.mjs';

const store = new LocalStore();
let handler;
const server = createServer((req, res) => handler(req, res));
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://localhost:${server.address().port}`;
handler = createApp({ store, authRoutes, origin: base });
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light' });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
  const records = [];
  page.on('response', async response => {
    if (!response.url().includes('/api/')) return;
    const request = response.request();
    records.push({ request: { method: request.method(), path: new URL(request.url()).pathname, cookie: '[가림]', body: request.postDataJSON() }, response: { status: response.status(), body: await response.json() } });
  });
  await page.goto(base);
  await page.locator('#account-name').fill('virtual-a');
  await page.locator('#credential-name').fill('가상 인증기 A');
  const registered = page.waitForResponse(response => response.url().endsWith('/register/verify'));
  await page.getByRole('button', { name: '처음 패스키 등록', exact: true }).click();
  assert.equal((await registered).status(), 200);
  await page.locator('#private-content article').nth(2).waitFor();
  await page.locator('#passkey-management').waitFor();
  assert.equal(await page.locator('#private-content article').count(), 3);
  assert.equal(await page.locator('#passkey-list li').count(), 1);
  await mkdir('verification/card2', { recursive: true });
  await page.locator('#private-space').screenshot({ path: 'verification/card2/registered.png' });
  const stored = await store.transact(state => Object.values(state.credentials));
  assert.equal(stored.length, 1);
  assert.ok(stored[0].publicKey);
  assert.ok(!Object.keys(stored[0]).some(key => /private|password/i.test(key)));
  const starts = [];
  for (let index = 0; index < 2; index++) {
    const response = await context.request.post(base + '/api/passkeys/register/options', { headers: { origin: base }, data: { name: 'virtual-a', credentialName: '추가 등록 질문 시험' } });
    assert.equal(response.status(), 200);
    starts.push(await response.json());
  }
  assert.notEqual(starts[0].publicKey.challenge, starts[1].publicKey.challenge);
  const retained = await store.transact(state => starts.map(item => state.challenges[item.challengeId].challenge));
  assert.deepEqual(retained, starts.map(item => item.publicKey.challenge));
  for (const item of starts) await context.request.post(base + '/api/passkeys/register/cancel', { headers: { origin: base }, data: { challengeId: item.challengeId } });

  const cancelContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const cancelPage = await cancelContext.newPage();
  await cancelPage.goto(base);
  await cancelPage.evaluate(() => { window.SimpleWebAuthnBrowser.startRegistration = async () => { throw new DOMException('시험용 등록 취소', 'NotAllowedError'); }; });
  await cancelPage.locator('#account-name').fill('virtual-cancel');
  await cancelPage.locator('#credential-name').fill('취소할 가상 인증기');
  await cancelPage.getByRole('button', { name: '처음 패스키 등록', exact: true }).click();
  await cancelPage.getByRole('status').getByText('패스키 등록을 취소했습니다.', { exact: false }).waitFor();
  const cancelState = await store.transact(state => ({ users: Object.keys(state.users).length, credentials: Object.keys(state.credentials).length, challenges: Object.keys(state.challenges).length }));
  assert.deepEqual(cancelState, { users: 1, credentials: 1, challenges: 0 });
  await cancelPage.locator('#private-space').screenshot({ path: 'verification/card2/cancelled.png' });
  await writeFile('verification/card2/registration-evidence.json', JSON.stringify({ checkedAt: new Date().toISOString(), kind: '분리된 Chromium의 가상 WebAuthn 인증기로 실제 브라우저 API와 서버 검증기를 실행한 자동 시험. 실제 기기·실제 저장 위치는 미확인.', records, freshChallenges: starts.map(item => item.publicKey.challenge), serverRetainedChallenges: retained, storedPublicKey: stored[0], cancelled: { kind: 'NotAllowedError를 모의 발생시킨 취소 화면 시험', countsAfter: cancelState } }, null, 2));
  console.log('카드 2: 가상 인증기 등록·공개키 저장·3개 자료·취소 화면 확인 완료');
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
