import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createApp, tokenHash } from '../server/app.mjs';
import { LocalStore, emptyState } from '../server/store.mjs';

const state = emptyState();
state.users.a = { id: 'a', name: '가상 계정 A', items: [1, 2, 3].map(id => ({ id, title: `가상 프로젝트 메모 ${id}`, body: '카드 1의 화면 확인을 위해 만든 가상 자료입니다.' })) };
state.sessions[tokenHash('synthetic-browser-session')] = { userId: 'a', expiresAt: Date.now() + 60000 };
const server = createServer(createApp({ store: new LocalStore({ state }) }));
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light' });
  const page = await context.newPage();
  const base = `http://localhost:${server.address().port}`;
  await page.goto(base);
  await page.locator('#private-status').getByText('잠겨 있습니다.', { exact: false }).waitFor();
  assert.equal(await page.locator('#private-content').isVisible(), false);
  await mkdir('verification/card1', { recursive: true });
  await page.screenshot({ path: 'verification/card1/public-and-locked.png', fullPage: true });
  await page.locator('#private-space').screenshot({ path: 'verification/card1/locked.png' });
  await context.addCookies([{ name: 't08-session', value: 'synthetic-browser-session', url: base, httpOnly: true, sameSite: 'Strict' }]);
  await page.reload();
  await page.locator('#private-content article').nth(2).waitFor();
  assert.equal(await page.locator('#private-content article').count(), 3);
  await page.locator('#private-space').screenshot({ path: 'verification/card1/synthetic-unlocked.png' });
  await page.getByRole('button', { name: /테마 변경/ }).click();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await writeFile('verification/card1/browser-evidence.json', JSON.stringify({ checkedAt: new Date().toISOString(), environment: '개인 Chrome과 분리한 Playwright Chromium', kind: '합성 세션을 직접 주입한 화면 시험. 실제 패스키 등록·로그인 시험이 아님.', lockedContentVisible: false, unlockedItemCount: 3, originalThemeTogglePassed: true, mobileOverflow: false }, null, 2));
  console.log('카드 1 화면·3개 항목·테마·모바일 너비 확인 완료(합성 세션)');
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
