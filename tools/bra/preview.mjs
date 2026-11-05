import { createServer } from 'node:http';
import { createApp } from '../../server/app.mjs';
import { authRoutes } from '../../server/auth.mjs';
import { LocalStore, emptyState } from '../../server/store.mjs';

// Preview never opens the existing account database or loads .env files.
const port = Number(process.argv[2] || 8008);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('포트 번호를 확인해 주세요.');
const handler = createApp({ store: new LocalStore({ state: emptyState() }), authRoutes, origin: `http://localhost:${port}` });
const server = createServer(handler);
server.listen(port, '127.0.0.1', () => console.log(`BR-A 로컬 미리보기: http://localhost:${port}/career/`));
server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? '해당 포트를 다른 프로그램이 사용 중입니다.' : '미리보기 서버를 시작하지 못했습니다.'); process.exitCode = 1; });
