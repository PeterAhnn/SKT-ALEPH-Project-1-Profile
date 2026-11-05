import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { generate, outputFiles, makeCandidates } from './generate.mjs';
import { syntheticFixture } from './synthetic-fixture.mjs';

const names = ['rituals', 'attendance', 'projects', 'approvals'];
async function fixture() {
  const folder = await mkdtemp(join(tmpdir(), 'bra-test-'));
  const input = join(folder, 'input');
  await mkdir(input);
  const data = syntheticFixture();
  const save = async () => { for (const name of names) await writeFile(join(input, `${name}.json`), JSON.stringify(data[name])); };
  await save();
  return { folder, input, data, save, out: join(folder, 'out') };
}
test('합성 입력은 두 새 결과 폴더에서 같은 파일을 만들고 세 능력 후보를 만든다', async () => {
  const f = await fixture();
  const one = await generate(f.input, f.out);
  const second = join(f.folder, 'second');
  await generate(f.input, second);
  for (const name of outputFiles) assert.deepEqual(await readFile(join(f.out, name)), await readFile(join(second, name)));
  assert.equal(one.data.metrics.contentTotal, 84);
  assert.equal(one.candidates.length, 7);
  assert.deepEqual([...new Set(one.candidates.map(item => item.ability))].sort(), ['대인관계력', '자기동기력', '자기조절력'].sort());
  assert.deepEqual(one.data.approvedParagraphs, []);
  assert.ok(!JSON.stringify(one.data).includes('evidenceText'));
  assert.ok(!JSON.stringify(one.manifest).includes(resolve(f.folder)));
});
test('명시적으로 승인한 후보만 공개 데이터에 들어가고 근거 변경은 이전 승인을 무효화한다', async () => {
  const f = await fixture();
  const initial = await generate(f.input, f.out);
  const chosen = initial.candidates[0];
  f.data.approvals.approvedCandidateIds = [chosen.id];
  await f.save();
  const approved = await generate(f.input, f.out);
  assert.equal(approved.data.approvedParagraphs.length, 1);
  assert.equal(approved.data.approvedParagraphs[0].id, chosen.id);
  f.data.rituals.evidence.find(item => item.date === chosen.date).text += ' 근거 수정';
  await f.save();
  await assert.rejects(generate(f.input, f.out), /일치하지 않는 승인/);
});
test('존재하지 않거나 중복된 승인 ID는 거절한다', async () => {
  const f = await fixture();
  f.data.approvals.approvedCandidateIds = ['missing']; await f.save();
  await assert.rejects(generate(f.input, f.out), /일치하지 않는 승인/);
  const id = makeCandidates(f.data.rituals)[0].id;
  f.data.approvals.approvedCandidateIds = [id, id]; await f.save();
  await assert.rejects(generate(f.input, f.out), /중복되거나/);
});
test('합성 검증용 새 기록을 넣으면 숫자와 문단 후보가 함께 갱신된다', async () => {
  const f = await fixture();
  for (const name of names) f.data[name].asOf = '2026-10-21';
  f.data.rituals.days.push({ date: '2026-10-21', open: 1, close: 1 });
  f.data.rituals.screenTotals = { days: 45, open: 45, close: 44 };
  f.data.rituals.evidence.push({ date: '2026-10-21', kind: 'close', sourceField: '합성 검증 전용', text: '계획을 세우고 미루지 않고 마무리했다.' });
  Object.assign(f.data.attendance, { end: '2026-10-21', trainingDays: 47, enrolledDays: 47, presentDays: 46, rateNumerator: 46, displayedPercent: 97.9 });
  await f.save();
  const result = await generate(f.input, f.out);
  assert.equal(result.data.metrics.contentTotal, 86);
  assert.equal(result.data.metrics.ritualDays, 45);
  assert.equal(result.candidates.length, 8);
  assert.equal(result.data.metrics.submittedTasks, 11);
  assert.deepEqual(result.data.approvedParagraphs, []);
});
test('비밀값 의심 입력은 출력 전에 거절하고 이메일은 후보에서 가린다', async () => {
  const f = await fixture();
  f.data.rituals.evidence[0].text = '설명 후 test@example.test로 연락했다.';
  await f.save();
  const result = await generate(f.input, f.out);
  assert.ok(JSON.stringify(result.candidates).includes('(연락처 가림)'));
  assert.ok(!JSON.stringify(result.candidates).includes('test@example.test'));
  f.data.rituals.evidence[0].text = '질문 기록 token=synthetic-test-value';
  await f.save();
  await assert.rejects(generate(f.input, f.out), /비밀값 의심/);
});
test('입력 폴더에 결과를 덮어쓰거나 내용 없는 기록을 근거로 쓰는 작업을 거절한다', async () => {
  const f = await fixture();
  await assert.rejects(generate(f.input, f.input), /입력 폴더/);
  f.data.rituals.evidence.push({ date: '2026-09-02', kind: 'close', text: '계획을 마쳤다.', sourceField: '합성 검증 전용' });
  await f.save();
  await assert.rejects(generate(f.input, f.out), /연결되지 않은/);
});
