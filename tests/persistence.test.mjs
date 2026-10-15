import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, unlink, rmdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import { LocalStore } from '../server/store.mjs';
import { createApp } from '../server/app.mjs';
import api from '../api/index.mjs';

test('로컬 저장소는 재시작 후 유지되고 실패한 변경을 저장하지 않는다', async t => {
  const directory = await mkdtemp(join(tmpdir(), 't08-store-'));
  const path = join(directory, 'state.json');
  t.after(async () => { assert.ok(directory.startsWith(join(tmpdir(), 't08-store-'))); await unlink(path); await rmdir(directory); });
  const first = new LocalStore({ path });
  await first.transact(state => { state.users.a = { id: 'a', name: 'synthetic-a', items: [1, 2, 3] }; });
  const restarted = new LocalStore({ path });
  assert.equal(await restarted.transact(state => state.users.a.name), 'synthetic-a');
  await assert.rejects(restarted.transact(state => { state.users.a.name = 'changed'; throw new Error('의도한 실패'); }));
  const again = new LocalStore({ path });
  assert.equal(await again.transact(state => state.users.a.name), 'synthetic-a');
});

test('운영 저장소가 준비되지 않아도 공개 소개는 열리고 비공개 API는 503이다', async t => {
  const server = createServer(createApp({ production: true, origin: 'https://example.test' }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(base)).status, 200);
  const response = await fetch(base + '/api/private/items');
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('set-cookie'), null);
});

test('Vercel API는 운영 설정이 없으면 로컬 파일 저장으로 대체하지 않는다', async t => {
  const previous = process.env.T08_ORIGIN;
  delete process.env.T08_ORIGIN;
  const server = createServer(api);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); if (previous !== undefined) process.env.T08_ORIGIN = previous; });
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/private/items`);
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /준비하고 있습니다/);
});
