import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const portable = existsSync(join(here, 'app', 'index.html'));
const project = resolve(here, '../..');
const appRoot = portable ? join(here, 'app') : join(project, 'career', 'apps', 'login-policy');
const paperFile = portable ? join(here, 'paper', 'T10-paper.md') : join(project, 'career', 'downloads', 'T10-paper.md');
const readmeFile = portable ? join(here, 'README.md') : join(appRoot, 'README.md');
const port = Number(process.argv[2] || 8013);
if (process.argv.length > 3 || !Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('실행 형식: node serve.mjs [1부터 65535까지의 포트 번호]');
  process.exit(1);
}

const files = new Map([
  ['index.html', 'text/html; charset=utf-8'],
  ['engine.mjs', 'text/javascript; charset=utf-8'],
  ['app.mjs', 'text/javascript; charset=utf-8'],
  ['styles.css', 'text/css; charset=utf-8'],
  ['data/paper-data.json', 'application/json; charset=utf-8'],
  ['README.md', 'text/markdown; charset=utf-8'],
]);
const escape = value => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const page = (title, body) => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{max-width:900px;margin:40px auto;padding:0 24px;font-family:system-ui,sans-serif;line-height:1.8;color:#172338;background:#f8fafc}a{color:#174cc0}li{margin:16px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}nav{display:flex;gap:24px;flex-wrap:wrap}</style></head><body>${body}</body></html>`;
const landing = page('로그인 정책 비교 앱 · 실행 안내', `<main><h1>로그인 정책 비교 앱</h1><p>로그인 방어 정책을 검토하는 사람이 합성 요청 조건에 따른 공격 차단과 정상 요청 손실을 비교할 수 있습니다.</p><ol><li><a href="/app/">앱을 열고 조건을 선택합니다.</a></li><li>정책 비교를 실행하고 논문의 결과와 해석을 읽습니다.</li><li>결과를 저장합니다.</li></ol><nav><a href="/app/">앱 열기</a><a href="/paper.html">논문 읽기</a><a href="/paper/T10-paper.md">논문 MD</a><a href="/README.md">실행 안내</a></nav><p>실제 서비스로 요청을 보내지 않습니다. 논문의 합성 데이터로 이 브라우저에서 계산하며, 외부 계정·API 키·추가 패키지가 필요하지 않습니다.</p></main>`);

function respond(res, method, status, type, content) {
  const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
  res.writeHead(status, {
    'Content-Type': type,
    'Content-Length': bytes.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  });
  res.end(method === 'HEAD' ? undefined : bytes);
}

const server = createServer(async (req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.setHeader('Allow', 'GET, HEAD');
    respond(res, req.method, 405, 'text/plain; charset=utf-8', '읽기 요청만 사용할 수 있습니다.');
    return;
  }
  try {
    const pathname = decodeURIComponent(new URL(req.url, `http://127.0.0.1:${port}`).pathname);
    if (['/app', '/career/apps/login-policy'].includes(pathname)) {
      res.writeHead(308, { Location: `${pathname}/`, 'Cache-Control': 'no-store' });
      res.end();
      return;
    }
    if (['/', '/index.html', '/career/', '/career/index.html'].includes(pathname)) {
      respond(res, req.method, 200, 'text/html; charset=utf-8', landing);
      return;
    }
    if (['/paper.html', '/career/paper.html'].includes(pathname)) {
      const paper = await readFile(paperFile, 'utf8');
      respond(res, req.method, 200, 'text/html; charset=utf-8', page('논문 공개 사본', `<nav><a href="/app/">앱으로 돌아가기</a><a href="/paper/T10-paper.md" download>논문 MD 내려받기</a></nav><main><h1>논문 공개 사본</h1><p>아래 문서는 묶음에 포함된 논문 MD의 원문입니다.</p><pre>${escape(paper)}</pre></main>`));
      return;
    }
    if (['/paper/T10-paper.md', '/downloads/T10-paper.md', '/career/downloads/T10-paper.md'].includes(pathname)) {
      respond(res, req.method, 200, 'text/markdown; charset=utf-8', await readFile(paperFile));
      return;
    }
    if (pathname === '/README.md') {
      respond(res, req.method, 200, 'text/markdown; charset=utf-8', await readFile(readmeFile));
      return;
    }
    const prefix = ['/app/', '/career/apps/login-policy/'].find(value => pathname.startsWith(value));
    const relative = prefix ? pathname.slice(prefix.length) || 'index.html' : '';
    const type = files.get(relative);
    if (!type) {
      respond(res, req.method, 404, 'text/plain; charset=utf-8', '요청한 공개 파일을 찾을 수 없습니다.');
      return;
    }
    respond(res, req.method, 200, type, await readFile(join(appRoot, relative)));
  } catch (error) {
    const invalid = error instanceof URIError;
    respond(res, req.method, invalid ? 400 : 404, 'text/plain; charset=utf-8', invalid ? '주소 형식을 확인해 주세요.' : '공개 파일을 읽을 수 없습니다. 압축을 모두 풀었는지 확인해 주세요.');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`실행 안내: http://127.0.0.1:${port}/`);
  console.log(`로그인 정책 비교 앱: http://127.0.0.1:${port}/app/`);
  console.log('종료하려면 Ctrl+C를 누르세요.');
});
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? '해당 포트를 사용 중입니다. node serve.mjs 8014처럼 다른 포트 번호를 지정해 주세요.' : '로컬 서버를 시작하지 못했습니다. 포트 번호와 파일을 확인해 주세요.');
  process.exitCode = 1;
});
