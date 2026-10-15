import { chromium } from 'playwright';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.mjs';
import { authRoutes } from '../server/auth.mjs';
import { LocalStore } from '../server/store.mjs';

export async function fixture() {
  const store = new LocalStore();
  let handler;
  const server = createServer((req, res) => handler(req, res));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://localhost:${server.address().port}`;
  handler = createApp({ store, authRoutes, origin: base });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light' });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const addAuthenticator = async () => (await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } })).authenticatorId;
  const authenticatorId = await addAuthenticator();
  const records = [];
  const post = async (path, body) => {
    const response = await context.request.post(base + path, { headers: { origin: base }, data: body });
    const data = await response.json();
    records.push({ request: { method: 'POST', path, cookie: '[가림]', body }, response: { status: response.status(), body: data, setCookie: response.headers()['set-cookie'] ? '[가림]' : undefined } });
    return { status: response.status(), body: data };
  };
  await page.goto(base);
  const register = async (name = 'virtual-a', credentialName = '가상 인증기 A') => {
    await page.locator('#account-name').fill(name);
    await page.locator('#credential-name').fill(credentialName);
    const finished = page.waitForResponse(response => response.url().endsWith('/register/verify'));
    await page.locator('#register-passkey').click();
    const response = await finished;
    assert.equal(response.status(), 200, JSON.stringify(await response.json()));
    await page.locator('#private-content article').nth(2).waitFor();
    await page.locator('#passkey-management').waitFor();
    return response.json();
  };
  const logout = async () => {
    const response = await post('/api/logout', {});
    assert.equal(response.status, 200);
    await page.reload();
    await page.locator('#login-passkey').waitFor();
  };
  return { store, server, base, browser, context, page, cdp, authenticatorId, addAuthenticator, records, post, register, logout, async close() { await browser.close(); await new Promise(resolve => server.close(resolve)); } };
}

export const kind = '개인 Chrome과 분리한 Chromium의 가상 WebAuthn 인증기로 실제 브라우저 API·서명·서버 검증기를 실행한 로컬 자동 시험입니다. 사용자 실제 기기 시험과 운영 배포 시험이 아닙니다.';
