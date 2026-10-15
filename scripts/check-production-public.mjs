import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const origin = 'https://skt-aleph-project-1.vercel.app';
const commit = '653f9057cb63e5223b37b474f6f1fe1ceb61284c';
const sourceUrl = `https://github.com/PeterAhnn/SKT-ALEPH-Project-1-Profile/commit/${commit}`;
const evidenceDirectory = 'verification/production';
const blockedPaths = [
  '/server/app.mjs', '/server/auth.mjs', '/server/pg-store.mjs', '/server.mjs',
  '/.env', '/.env.local', '/.vercel/project.json', '/package.json',
  '/data/t08-state.json', '/verification/private/',
  '/verification/card2/registration-evidence.json',
  '/contracts/profile-baseline.html', '/docs/TASK-SOURCE.md',
];
const report = {
  checkedAt: new Date().toISOString(),
  kind: '개인 Chrome·인앱 브라우저와 분리한 Playwright Chromium의 새 무로그인 컨텍스트에서 수행한 공개 운영 화면·HTTP 읽기 검증입니다. 실제 기기 패스키 시험은 포함하지 않습니다.',
  origin, commit, sourceUrl,
  authenticationBypassUsed: false, loginPerformed: false, passkeyRegistered: false,
  dbChangesExecuted: false, deploymentExecuted: false,
  cookiePolicy: '컨텍스트마다 초기 쿠키가 0개인지 검사했습니다. 쿠키 값은 저장하지 않고 Set-Cookie는 가립니다.',
  responseBodiesStored: false,
  http: [], checks: {},
};
const safeUrl = value => {
  const url = new URL(value);
  url.search = '';
  url.hash = '';
  return url.toString();
};
const hasSecret = value => /-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----|\b(?:sb_secret_|sbp_)[A-Za-z0-9_-]{12,}|\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}|postgres(?:ql)?:\/\/[^\s:@]+:[^\s@]+@/i.test(value);
const safeText = value => hasSecret(value) ? '[비밀값 형태를 감지하여 저장하지 않았습니다.]' : value.slice(0, 500);
const normalize = value => value.replace(/\r\n/g, '\n');
const sha256 = value => createHash('sha256').update(value).digest('hex');
const baseline = normalize(await readFile('contracts/profile-baseline.html', 'utf8'));
await mkdir(evidenceDirectory, { recursive: true });
const browser = await chromium.launch({ headless: true });
report.browserVersion = browser.version();

const newEmptyContext = async () => {
  const context = await browser.newContext({ viewport: { width: 1365, height: 900 }, serviceWorkers: 'block', permissions: [] });
  assert.equal((await context.cookies()).length, 0, '새 검증 컨텍스트에 기존 쿠키가 있습니다.');
  return context;
};

try {
  const context = await newEmptyContext();
  try {
    const page = await context.newPage();
    const response = await page.goto(`${origin}/`, { waitUntil: 'networkidle', timeout: 60000 });
    const html = normalize(await response.text());
    const restored = html.replace(/<!-- T08 ADDITION START -->[\s\S]*?<!-- T08 ADDITION END -->\n?/g, '');
    const visibleText = await page.locator('body').innerText();
    report.page = {
      requestedUrl: `${origin}/`, finalUrl: safeUrl(page.url()), status: response.status(), initialCookieCount: 0,
      title: safeText(await page.title()),
      setCookie: response.headers()['set-cookie'] ? '[가림]' : null,
      profileHeroPresent: await page.locator('#hero-title').isVisible(),
      originalHeadingPresent: /조용히 돕고,\s*끝까지 해결합니다\./.test(visibleText),
      originalHtmlPreserved: restored === baseline,
      originalHtmlSha256: sha256(restored), baselineHtmlSha256: sha256(baseline),
      t08BoundaryPresent: await page.locator('#private-space').isVisible(),
      privateStatus: safeText(await page.locator('#private-status').innerText()),
      privateContentVisible: await page.locator('#private-content').isVisible(),
      privateContentTextLength: (await page.locator('#private-content').innerText()).trim().length,
      privateContentElementCount: await page.locator('#private-content > *').count(),
      passkeyManagementVisible: await page.locator('#passkey-management').isVisible(),
      passwordInputCount: await page.locator('input[type="password"]').count(),
      registrationControlPresent: await page.locator('#register-passkey').isVisible(),
      loginControlPresent: await page.locator('#login-passkey').isVisible(),
      responseBodyStored: false,
    };
    if (!hasSecret(visibleText)) {
      report.page.screenshot = `${evidenceDirectory}/public-and-locked.png`;
      await page.screenshot({ path: report.page.screenshot, fullPage: true });
      report.page.lockBoundaryScreenshot = `${evidenceDirectory}/locked-boundary.png`;
      await page.locator('#private-space').screenshot({ path: report.page.lockBoundaryScreenshot });
    } else {
      report.page.screenshotOmittedReason = '화면에 비밀값 형태가 감지되어 저장하지 않았습니다.';
    }
  } finally {
    await context.close();
  }

  for (const path of ['/api/session', '/api/private/items', ...blockedPaths]) {
    const context = await newEmptyContext();
    try {
      const response = await context.request.get(`${origin}${path}`, { timeout: 30000 });
      const contentType = response.headers()['content-type'] ?? '';
      const body = await response.text();
      const record = {
        method: 'GET', path, requestedUrl: `${origin}${path}`, finalUrl: safeUrl(response.url()),
        initialCookieCount: 0, status: response.status(), contentType,
        setCookie: response.headers()['set-cookie'] ? '[가림]' : null,
        responseBodyStored: false,
      };
      if (['/api/session', '/api/private/items'].includes(path) && /application\/json/i.test(contentType) && !hasSecret(body)) {
        const parsed = JSON.parse(body);
        record.jsonPropertyNames = Object.keys(parsed);
        if (typeof parsed.authenticated === 'boolean') record.authenticated = parsed.authenticated;
        if (typeof parsed.error === 'string') record.errorMessage = safeText(parsed.error);
      }
      report.http.push(record);
    } finally {
      await context.close();
    }
  }

  const sourceContext = await newEmptyContext();
  try {
    const page = await sourceContext.newPage();
    const response = await page.goto(sourceUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('load', { timeout: 10000 }).catch(() => {});
    const title = await page.title();
    const metaTitle = await page.locator('meta[property="og:title"]').getAttribute('content').catch(() => null);
    report.source = {
      requestedUrl: sourceUrl, finalUrl: safeUrl(page.url()), status: response.status(), initialCookieCount: 0,
      title: safeText(title), commitTitle: safeText((metaTitle ?? title).split(' · PeterAhnn/')[0]),
      setCookie: response.headers()['set-cookie'] ? '[가림]' : null,
      responseBodyStored: false,
      publicAccessObserved: response.status() === 200 && page.url().startsWith(sourceUrl),
    };
  } finally {
    await sourceContext.close();
  }

  const session = report.http.find(record => record.path === '/api/session');
  const privateItems = report.http.find(record => record.path === '/api/private/items');
  report.checks = {
    publicPage200: report.page.status === 200 && report.page.finalUrl === `${origin}/`,
    originalProfilePreserved: report.page.profileHeroPresent && report.page.originalHeadingPresent && report.page.originalHtmlPreserved,
    lockedBoundaryVisible: report.page.t08BoundaryPresent,
    privateDataHiddenAndEmpty: !report.page.privateContentVisible && report.page.privateContentTextLength === 0 && report.page.privateContentElementCount === 0,
    passwordInputAbsent: report.page.passwordInputCount === 0,
    sessionUnauthenticated200: session?.status === 200 && session.authenticated === false,
    privateApiUnauthorized401: privateItems?.status === 401,
    serverEnvironmentPrivateFiles404: blockedPaths.every(path => report.http.find(record => record.path === path)?.status === 404),
    sourceCommitPublic200: report.source.publicAccessObserved,
  };
  report.allChecksPassed = Object.values(report.checks).every(Boolean);
} catch (error) {
  report.error = safeText(String(error.message));
  report.allChecksPassed = false;
} finally {
  await browser.close();
  report.completedAt = new Date().toISOString();
  await writeFile(`${evidenceDirectory}/public-access.json`, `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify({ checkedAt: report.checkedAt, completedAt: report.completedAt, checks: report.checks, allChecksPassed: report.allChecksPassed, error: report.error, http: report.http.map(({ path, status, authenticated }) => ({ path, status, authenticated })), source: report.source }, null, 2));
if (!report.allChecksPassed) process.exitCode = 1;
