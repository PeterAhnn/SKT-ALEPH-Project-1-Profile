import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const commit = '90cc5592447b3dd22ed882b0600d8ee9f1632e68';
const urls = {
  source: `https://github.com/PeterAhnn/SKT-ALEPH-Project-1-Profile/commit/${commit}`,
  preview: 'https://skt-aleph-project-1-profile-cq6we4559-peter-ahns-projects.vercel.app/',
  production: 'https://skt-aleph-project-1.vercel.app/',
};
const report = {
  checkedAt: new Date().toISOString(),
  kind: '개인 Chrome·인앱 브라우저와 분리한 Playwright Chromium의 새 무로그인 컨텍스트에서 수행한 공개 접근 읽기 검증입니다.',
  commit,
  previewDeploymentId: 'dpl_BocyB7dgK7sSYMhFY9aaPjfMwxV6',
  authenticationBypassUsed: false,
  loginPerformed: false,
  passkeyRegistered: false,
  dbChangesExecuted: false,
  deploymentExecuted: false,
  responseBodiesStored: false,
  records: [],
};

const safeUrl = value => {
  const url = new URL(value);
  url.search = '';
  url.hash = '';
  return url.toString();
};
const hasSecret = value => /-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----|\b(?:sb_secret_|sbp_)[A-Za-z0-9_-]{12,}|\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}|postgres(?:ql)?:\/\/[^\s:@]+:[^\s@]+@|(?:api[_-]?key|access[_-]?token|client[_-]?secret)\s*[=:]\s*["'][A-Za-z0-9_./+=-]{20,}["']/i.test(value);
const safeText = value => hasSecret(value) ? '[비밀값 형태가 감지되어 저장하지 않았습니다.]' : value.slice(0, 500);
const redirectChain = async response => {
  const entries = [];
  for (let request = response?.request(); request; request = request.redirectedFrom()) {
    entries.unshift({ url: safeUrl(request.url()), status: (await request.response())?.status() ?? null });
  }
  return entries;
};

await mkdir('verification', { recursive: true });
const browser = await chromium.launch({ headless: true });
report.browserVersion = browser.version();
try {
  for (const [target, requestedUrl] of Object.entries(urls)) {
    const context = await browser.newContext({ viewport: { width: 1365, height: 900 }, serviceWorkers: 'block', permissions: [] });
    const initialCookieCount = (await context.cookies()).length;
    assert.equal(initialCookieCount, 0, '새 컨텍스트에 기존 쿠키가 있습니다.');
    const page = await context.newPage();
    const record = { target, requestedUrl, initialCookieCount, method: 'GET' };
    try {
      const response = await page.goto(requestedUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForLoadState('load', { timeout: 10000 }).catch(() => {});
      record.status = response?.status() ?? null;
      record.redirectChain = await redirectChain(response);
      record.finalUrl = safeUrl(page.url());
      record.contentType = response?.headers()['content-type'] ?? null;
      const observations = await page.evaluate(() => {
        const text = document.body?.innerText ?? '';
        const headings = [...document.querySelectorAll('h1, h2')].map(node => node.textContent.trim()).filter(Boolean).slice(0, 10);
        return {
          title: document.title,
          metaTitle: document.querySelector('meta[property="og:title"]')?.content ?? null,
          commitHeading: document.querySelector('.commit-title, [data-testid="commit-message"]')?.textContent.trim() ?? null,
          headings,
          profileHeroPresent: !!document.querySelector('#hero-title'),
          originalProfileHeadingPresent: /조용히 돕고,\s*끝까지 해결합니다\./.test(text),
          t08PrivateSectionPresent: !!document.querySelector('#private-space'),
          t08RegistrationControlPresent: !!document.querySelector('#register-passkey'),
          loginOrProtectionVisible: /Log in to Vercel|Log in to continue|Authentication Required|Deployment Protection|Sign in to Vercel|Authenticate to access/.test(text),
          visibleText: text,
        };
      });
      record.title = safeText(observations.title);
      record.metaTitle = observations.metaTitle ? safeText(observations.metaTitle) : null;
      record.commitHeading = observations.commitHeading ? safeText(observations.commitHeading) : null;
      if (target === 'source') record.commitTitle = safeText((observations.metaTitle ?? observations.title).split(' · PeterAhnn/')[0]);
      record.headings = observations.headings.map(safeText);
      record.profileHeroPresent = observations.profileHeroPresent;
      record.originalProfileHeadingPresent = observations.originalProfileHeadingPresent;
      record.t08PrivateSectionPresent = observations.t08PrivateSectionPresent;
      record.t08RegistrationControlPresent = observations.t08RegistrationControlPresent;
      record.protectionObserved = observations.loginOrProtectionVisible || [401, 403].includes(record.status) || new URL(page.url()).hostname === 'vercel.com';
      record.publicAccessObserved = record.status === 200 && !record.protectionObserved;
      record.bodyStored = false;
      if (!hasSecret(observations.visibleText)) {
        record.screenshot = `verification/public-access-${target}.png`;
        await page.screenshot({ path: record.screenshot, fullPage: false });
      } else {
        record.screenshot = null;
        record.screenshotOmittedReason = '화면 본문에서 비밀값 형태를 감지하여 저장하지 않았습니다.';
      }
      if (target === 'preview') {
        const apiContext = await browser.newContext({ serviceWorkers: 'block', permissions: [] });
        const apiInitialCookieCount = (await apiContext.cookies()).length;
        assert.equal(apiInitialCookieCount, 0, 'API 확인 컨텍스트에 기존 쿠키가 있습니다.');
        const apiPage = await apiContext.newPage();
        const apiUrl = new URL('/api/session', requestedUrl).href;
        const apiResponse = await apiPage.goto(apiUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        const contentType = apiResponse?.headers()['content-type'] ?? '';
        const body = await apiResponse?.text() ?? '';
        record.sessionApi = {
          method: 'GET', requestedUrl: apiUrl, initialCookieCount: apiInitialCookieCount, status: apiResponse?.status() ?? null,
          finalUrl: safeUrl(apiPage.url()), contentType, bodyStored: false,
          redirectChain: await redirectChain(apiResponse),
          expectedWithoutDatabaseConfiguration: 503,
        };
        if (/application\/json/i.test(contentType) && !hasSecret(body)) {
          try {
            const parsed = JSON.parse(body);
            if (typeof parsed.error === 'string') record.sessionApi.errorMessage = safeText(parsed.error);
            record.sessionApi.jsonPropertyNames = Object.keys(parsed);
          } catch {
            record.sessionApi.jsonParseFailed = true;
          }
        }
        record.sessionApi.protectionObserved = [401, 403].includes(record.sessionApi.status) || new URL(apiPage.url()).hostname === 'vercel.com' || /Authentication Required|Deployment Protection|Log in to Vercel|Sign in to Vercel/.test(await apiPage.locator('body').innerText());
        record.sessionApi.applicationResponseObserved = /application\/json/i.test(contentType) && !record.sessionApi.protectionObserved;
        await apiContext.close();
      }
    } catch (error) {
      record.error = safeText(String(error.message));
    } finally {
      report.records.push(record);
      await context.close();
    }
  }
} finally {
  await browser.close();
  report.completedAt = new Date().toISOString();
  await writeFile('verification/public-access.json', `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify(report, null, 2));
