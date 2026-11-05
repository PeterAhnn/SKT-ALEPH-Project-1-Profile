/** 승인된 배포 뒤 무인증 GET만 수행한다. 본문·쿠키·인증값은 보고서에 저장하지 않는다. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import { careerPublicFiles } from '../bra/public-files.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const allowed = new Set(['--origin', '--deployment-id', '--source-manifest', '--before', '--report']);
const args = new Map();
if (process.argv.includes('--help')) {
  console.log('실행: node tools/brb/verify-public.mjs --deployment-id 배포ID --source-manifest 매니페스트JSON [--origin HTTPS주소] [--before 배포전JSON] [--report 새보고서JSON]');
  console.log('소스 매니페스트는 files: [{path, sha256, bytes}] 형식입니다. path는 프로젝트 루트 상대경로입니다.');
  process.exit(0);
}
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index];
  if (!allowed.has(key) || !process.argv[index + 1] || args.has(key)) throw new Error('지원하지 않거나 중복된 실행 인수입니다. --help를 확인해 주세요.');
  args.set(key, process.argv[index + 1]);
}
const deploymentId = args.get('--deployment-id');
if (!deploymentId || !/^dpl_[A-Za-z0-9]{8,100}$/u.test(deploymentId)) throw new Error('실제 배포 결과의 dpl_ 형식 배포 ID를 --deployment-id로 전달해 주세요.');
if (!args.has('--source-manifest')) throw new Error('배포 직전 고정한 공개 소스 매니페스트를 --source-manifest로 전달해 주세요.');
const originUrl = new URL(args.get('--origin') ?? 'https://skt-aleph-project-1.vercel.app');
if (originUrl.protocol !== 'https:' || originUrl.username || originUrl.password || originUrl.pathname !== '/' || originUrl.search || originUrl.hash) throw new Error('자격 정보·경로·쿼리가 없는 HTTPS 공개 원점을 지정해 주세요.');
const origin = originUrl.origin;
const insideRoot = value => {
  const absolute = resolve(ROOT, value);
  const child = relative(ROOT, absolute);
  if (child.startsWith('..') || isAbsolute(child)) throw new Error('파일 경로가 프로젝트 폴더를 벗어났습니다.');
  return absolute;
};
const beforePath = insideRoot(args.get('--before') ?? 'verification/brb/release/before.json');
const manifestPath = insideRoot(args.get('--source-manifest'));
const reportPath = insideRoot(args.get('--report') ?? 'verification/brb/release/public-http.json');
if (!relative(resolve(ROOT, 'verification/brb/release'), reportPath) || relative(resolve(ROOT, 'verification/brb/release'), reportPath).startsWith('..')) throw new Error('보고서는 verification/brb/release 안의 새 파일이어야 합니다.');
const sha256 = value => createHash('sha256').update(value).digest('hex');
const normalize = value => value.replace(/\r\n/gu, '\n');
const mimeType = value => value.split(';', 1)[0].trim().toLowerCase();
const correctMime = (actual, expected) => {
  const wanted = mimeType(expected);
  const received = mimeType(actual);
  return ['text/javascript', 'application/javascript'].includes(wanted)
    ? ['text/javascript', 'application/javascript'].includes(received)
    : wanted === received;
};

// 기준 ZIP에서 지정한 공개 HTML 하나만 읽는다. 압축 해제 파일은 만들지 않는다.
function zipEntry(bytes, wanted) {
  let end = -1;
  for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 65557); index -= 1) {
    if (bytes.readUInt32LE(index) === 0x06054b50) { end = index; break; }
  }
  assert.ok(end >= 0, '기준 ZIP의 끝 레코드가 없습니다.');
  let offset = bytes.readUInt32LE(end + 16);
  const count = bytes.readUInt16LE(end + 10);
  for (let index = 0; index < count; index += 1) {
    assert.equal(bytes.readUInt32LE(offset), 0x02014b50, '기준 ZIP 중앙 디렉터리가 올바르지 않습니다.');
    const method = bytes.readUInt16LE(offset + 10);
    const compressed = bytes.readUInt32LE(offset + 20);
    const size = bytes.readUInt32LE(offset + 24);
    const nameSize = bytes.readUInt16LE(offset + 28);
    const extraSize = bytes.readUInt16LE(offset + 30);
    const commentSize = bytes.readUInt16LE(offset + 32);
    const name = bytes.subarray(offset + 46, offset + 46 + nameSize).toString('utf8');
    if (name === wanted) {
      assert.ok(size < 1000000, '기준 공개 HTML이 예상 크기를 넘습니다.');
      const local = bytes.readUInt32LE(offset + 42);
      assert.equal(bytes.readUInt32LE(local), 0x04034b50);
      const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
      const payload = bytes.subarray(start, start + compressed);
      const content = method === 0 ? payload : method === 8 ? inflateRawSync(payload, { maxOutputLength: size }) : null;
      assert.ok(content && content.length === size, '기준 공개 HTML 압축을 읽지 못했습니다.');
      return content;
    }
    offset += 46 + nameSize + extraSize + commentSize;
  }
  throw new Error('기준 ZIP에 대표작 HTML이 없습니다.');
}

const report = {
  schemaVersion: 1, kind: 'brb-production-after-readonly-http', checkedAt: new Date().toISOString(),
  origin, deploymentId, deploymentIdentitySource: '실제 배포 도구 결과에서 전달받은 CLI 인수이며 HTTP만으로 배포 ID를 새로 조회하지 않습니다.',
  sourceManifest: relative(ROOT, manifestPath).replaceAll('\\', '/'),
  before: relative(ROOT, beforePath).replaceAll('\\', '/'),
  authenticationUsed: false, cookiesSent: false, responseBodiesStored: false, mutationsPerformed: false,
  http: [], checks: {}, passed: false,
  limitations: ['공개 HTTP와 소스·기존 파일 보존 검사입니다. 실제 기기 패스키 인증·운영 서비스 방어 성능·플랫폼 제출이나 승인을 검증하지 않습니다.'],
};
const bodies = new Map();
const check = (name, passed, details = {}) => { report.checks[name] = { passed: Boolean(passed), ...details }; };
async function request(path) {
  const response = await fetch(origin + path, { headers: { 'cache-control': 'no-cache' }, credentials: 'omit', redirect: 'manual', signal: AbortSignal.timeout(30000) });
  const bytes = Buffer.from(await response.arrayBuffer());
  bodies.set(path, bytes);
  const record = { path, status: response.status, bytes: bytes.length, sha256: sha256(bytes), mime: response.headers.get('content-type') ?? '' };
  report.http.push(record);
  return record;
}

try {
  const before = JSON.parse(await readFile(beforePath, 'utf8'));
  assert.equal(before.origin, origin, '비교 대상 공개 주소가 배포 전 기록과 다릅니다.');
  assert.equal(before.passed, true, '배포 전 공개 HTTP 기록에 실패가 있습니다.');
  const manifestBytes = await readFile(manifestPath);
  const manifest = JSON.parse(manifestBytes);
  assert.ok(Array.isArray(manifest.files), '소스 매니페스트에 files 배열이 없습니다.');
  const sourceManifest = new Map(manifest.files.map(item => [item.path.replaceAll('\\', '/'), item]));
  assert.equal(sourceManifest.size, manifest.files.length, '소스 매니페스트에 중복 경로가 있습니다.');
  report.sourceManifestSha256 = sha256(manifestBytes);
  const targets = [
    { path: '/', source: 'index.html', built: 'public/index.html', mime: 'text/html' },
    { path: '/assets/private.css', source: 'assets/private.css', built: 'public/assets/private.css', mime: 'text/css' },
    { path: '/assets/private.mjs', source: 'assets/private.mjs', built: 'public/assets/private.mjs', mime: 'text/javascript' },
    { path: '/assets/webauthn.js', source: 'node_modules/@simplewebauthn/browser/dist/bundle/index.umd.min.js', built: 'public/assets/webauthn.js', mime: 'text/javascript' },
    ...careerPublicFiles.map(([file, mime]) => ({ path: `/career/${file}`, source: `career/${file}`, built: `public/career/${file}`, mime })),
    { path: '/career/', source: 'career/index.html', built: 'public/career/index.html', mime: 'text/html' },
    { path: '/career/apps/login-policy/', source: 'career/apps/login-policy/index.html', built: 'public/career/apps/login-policy/index.html', mime: 'text/html' },
  ];
  const localChecks = [];
  for (const target of targets) {
    const frozen = sourceManifest.get(target.source);
    const sourceBytes = await readFile(insideRoot(target.source));
    const builtBytes = await readFile(insideRoot(target.built));
    const sourceMatches = Boolean(frozen && /^[a-f0-9]{64}$/u.test(frozen.sha256) && frozen.sha256 === sha256(sourceBytes) && frozen.bytes === sourceBytes.length);
    localChecks.push({ path: target.path, source: target.source, sourceMatches, buildMatches: sourceBytes.equals(builtBytes) });
  }
  check('frozenSourceAndBuildCopies', localChecks.every(item => item.sourceMatches && item.buildMatches), { checkedFiles: localChecks.length, files: localChecks });
  assert.ok(report.checks.frozenSourceAndBuildCopies.passed, '매니페스트·현재 소스·빌드 사본이 다릅니다. HTTP 검사를 시작하지 않습니다.');
  for (let index = 0; index < targets.length; index += 4) await Promise.all(targets.slice(index, index + 4).map(target => request(target.path)));
  const responses = new Map(report.http.map(item => [item.path, item]));
  const publicChecks = targets.map(target => {
    const response = responses.get(target.path);
    const frozen = sourceManifest.get(target.source);
    return { path: target.path, source: target.source, status200: response.status === 200, hashMatches: response.sha256 === frozen.sha256, bytesMatch: response.bytes === frozen.bytes, mimeMatches: correctMime(response.mime, target.mime) };
  });
  check('publicFilesMatchFrozenSource', publicChecks.every(item => item.status200 && item.hashMatches && item.bytesMatch && item.mimeMatches), { checkedPaths: publicChecks.length, files: publicChecks });
  const oldRecords = new Map(before.records.map(item => [item.path, item]));
  const oldPaths = before.records.filter(item => !['/career/', '/api/session', '/api/private/items'].includes(item.path)).map(item => item.path);
  const preserved = oldPaths.map(path => {
    const old = oldRecords.get(path);
    const current = responses.get(path);
    return { path, sameSha256: current?.sha256 === old.sha256, sameBytes: current?.bytes === old.bytes, status200: current?.status === 200, sameMime: correctMime(current?.mime ?? '', old.mime) };
  });
  check('existingProductionFilesPreserved', preserved.every(item => item.sameSha256 && item.sameBytes && item.status200 && item.sameMime), { checkedPaths: preserved.length, files: preserved });
  const profile = normalize(bodies.get('/').toString('utf8'));
  const profileOriginal = profile.replace(/<!-- T08 ADDITION START -->[\s\S]*?<!-- T08 ADDITION END -->\n?/gu, '');
  const t01 = normalize(await readFile(resolve(ROOT, 'contracts/profile-baseline.html'), 'utf8'));
  check('originalT01ProfilePreserved', profileOriginal === t01, { originalSha256: sha256(profileOriginal), baselineSha256: sha256(t01) });
  const baselineDirectory = resolve(ROOT, 'verification/brb/baseline/20261020-150309');
  const baselineHashes = JSON.parse(await readFile(resolve(baselineDirectory, 'hashes.json'), 'utf8'));
  const oldCareer = zipEntry(await readFile(resolve(baselineDirectory, 'source-before-brb.zip')), 'career/index.html');
  assert.equal(sha256(oldCareer), baselineHashes['career/index.html'], '기준 ZIP의 대표작 HTML 해시가 다릅니다.');
  const newCareer = bodies.get('/career/').toString('utf8');
  const cardPattern = /<article\b[^>]*\baria-labelledby="app-heading"[^>]*>[\s\S]*?<\/article>/gu;
  const oldCards = normalize(oldCareer.toString('utf8')).match(cardPattern) ?? [];
  const newCards = normalize(newCareer).match(cardPattern) ?? [];
  const stripCard = value => normalize(value).replace(cardPattern, '<!-- BR-B APP CARD -->');
  check('careerOnlyAppCardChanged', oldCards.length === 1 && newCards.length === 1 && stripCard(oldCareer.toString('utf8')) === stripCard(newCareer) && newCards[0].includes('href="./apps/login-policy/"') && sha256(oldCareer) === oldRecords.get('/career/')?.sha256, { previousProductionMatchesBaseline: sha256(oldCareer) === oldRecords.get('/career/')?.sha256, previousSha256: sha256(oldCareer), currentSha256: sha256(Buffer.from(newCareer)), previousCardCount: oldCards.length, currentCardCount: newCards.length });
  const safePaths = [
    '/.env', '/.env.local', '/server/app.mjs', '/server/auth.mjs', '/server/store.mjs', '/server/pg-store.mjs', '/server.mjs',
    '/data/t08-state.json', '/.vercel/project.json', '/package.json', '/contracts/profile-baseline.html',
    '/tools/bra/input/rituals.json', '/tools/bra/input/approvals.json', '/tools/brb/prepare-data.py',
    '/verification/brb/artifact-audit.json', '/docs/brb/SUBMISSION.md',
    '/career/apps/login-policy/.env', '/career/apps/login-policy/data/t08-state.json',
  ];
  for (let index = 0; index < safePaths.length; index += 4) await Promise.all(safePaths.slice(index, index + 4).map(path => request(path)));
  check('privateSourceAndEnvironmentPaths404', safePaths.every(path => report.http.find(item => item.path === path)?.status === 404), { checkedPaths: safePaths.length, statuses: safePaths.map(path => ({ path, status: report.http.find(item => item.path === path)?.status })) });
  const session = await request('/api/session');
  const privateItems = await request('/api/private/items');
  let sessionShape = false;
  let privateShape = false;
  try { const value = JSON.parse(bodies.get('/api/session')); sessionShape = value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 1 && value.authenticated === false; } catch { /* 원문을 저장하지 않는다. */ }
  try { const value = JSON.parse(bodies.get('/api/private/items')); privateShape = value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 1 && value.error === '패스키로 로그인해 주세요.'; } catch { /* 원문을 저장하지 않는다. */ }
  check('t08UnauthenticatedBoundary', session.status === 200 && sessionShape && privateItems.status === 401 && privateShape && correctMime(session.mime, 'application/json') && correctMime(privateItems.mime, 'application/json'), { session: { status: session.status, authenticatedFalseShape: Boolean(sessionShape) }, privateItems: { status: privateItems.status, unauthorizedErrorShape: Boolean(privateShape) } });
  report.passed = Object.values(report.checks).every(item => item.passed);
} catch (error) {
  report.error = { type: error?.name ?? 'Error', message: String(error?.message ?? '검사를 완료하지 못했습니다.').slice(0, 300) };
  report.passed = false;
} finally {
  bodies.clear();
  report.completedAt = new Date().toISOString();
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
}
console.log(JSON.stringify({ report: relative(ROOT, reportPath).replaceAll('\\', '/'), passed: report.passed, checks: Object.fromEntries(Object.entries(report.checks).map(([name, item]) => [name, item.passed])), checkedHttpPaths: report.http.length, deploymentId, error: report.error }, null, 2));
if (!report.passed) process.exitCode = 1;
