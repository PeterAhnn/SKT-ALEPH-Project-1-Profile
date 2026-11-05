import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENARIOS, POLICIES, validateRequests, simulate, summarize, comparePolicies, getPaperRequests } from '../../career/apps/login-policy/engine.mjs';
import { readFile } from 'node:fs/promises';

const request = (index, changes = {}) => ({
  requestId: `test:${index}`, timeMs: index, ipId: 'syn-ip-a', accountId: 'syn-account-a',
  actorLabel: 'attack', credentialValid: false, ...changes,
});

test('기본 정책과 시나리오가 고정되어 있다', () => {
  assert.equal(SCENARIOS.length, 4);
  assert.deepEqual(POLICIES.map(item => item.id), ['none', 'ip', 'account', 'dual']);
});

test('한도까지만 허용하며 판정 직전 횟수를 반환한다', () => {
  const result = simulate(Array.from({ length: 7 }, (_, index) => request(index)), { policy: 'ip', threshold: 5 });
  assert.deepEqual(result.map(row => row.allowed), [true, true, true, true, true, false, false]);
  assert.deepEqual(result.map(row => row.ipCount), [0, 1, 2, 3, 4, 5, 5]);
  assert.equal(result[5].deniedBy, 'ip');
  assert.equal(result[5].accountCount, null);
});

test('정확히 창 길이가 지난 기록을 만료시킨다', () => {
  const result = simulate([request(0), request(1, { timeMs: 59999 }), request(2, { timeMs: 60000 })], { policy: 'account', threshold: 1 });
  assert.deepEqual(result.map(row => row.allowed), [true, false, true]);
  assert.deepEqual(result.map(row => row.accountCount), [0, 1, 0]);
});

test('거부된 요청을 이력에 넣어 대기 시간을 연장하지 않는다', () => {
  const result = simulate([request(0), request(1, { timeMs: 59000 }), request(2, { timeMs: 60000 }), request(3, { timeMs: 60001 })], { policy: 'ip', threshold: 1 });
  assert.deepEqual(result.map(row => row.allowed), [true, false, true, false]);
});

test('같은 시각에는 생성 순번으로 판정한다', () => {
  const result = simulate([request(0, { originalIndex: 2 }), request(1, { timeMs: 0, originalIndex: 1 })], { policy: 'ip', threshold: 1 });
  assert.deepEqual(result.map(row => row.requestId), ['test:1', 'test:0']);
  assert.deepEqual(result.map(row => row.allowed), [true, false]);
});

test('시각 순서가 다른 입력을 안정적으로 정렬하며 원본을 바꾸지 않는다', () => {
  const input = [request(0, { timeMs: 20 }), request(1, { timeMs: 10 }), request(2, { timeMs: 10, originalIndex: 1 })];
  const saved = structuredClone(input);
  assert.deepEqual(validateRequests(input).requests.map(row => row.requestId), ['test:1', 'test:2', 'test:0']);
  assert.deepEqual(input, saved);
});

test('복합 정책에서 IP 한도만으로 거부하고 다른 계정 이력은 추가하지 않는다', () => {
  const result = simulate([request(0), request(1, { accountId: 'syn-account-b' }), request(2, { ipId: 'syn-ip-b', accountId: 'syn-account-b' })], { policy: 'dual', threshold: 1 });
  assert.equal(result[1].deniedBy, 'ip');
  assert.equal(result[1].accountCount, 0);
  assert.equal(result[2].allowed, true);
  assert.equal(result[2].accountCount, 0);
});

test('복합 정책에서 계정 한도와 두 키의 동시 한도를 각각 표시한다', () => {
  const account = simulate([request(0), request(1, { ipId: 'syn-ip-b' })], { policy: 'dual', threshold: 1 });
  assert.equal(account[1].deniedBy, 'account');
  const both = simulate([request(0), request(1)], { policy: 'dual', threshold: 1 });
  assert.equal(both[1].deniedBy, 'ip|account');
});

test('평가 라벨과 자격 유효 여부를 바꿔도 제한 판정은 같다', () => {
  const input = Array.from({ length: 8 }, (_, index) => request(index));
  const changed = input.map(row => ({ ...row, actorLabel: 'benign', credentialValid: true }));
  for (const { id: policy } of POLICIES) {
    const select = rows => simulate(rows, { policy, threshold: 5 }).map(({ allowed, deniedBy, ipCount, accountCount }) => ({ allowed, deniedBy, ipCount, accountCount }));
    assert.deepEqual(select(input), select(changed));
  }
});

test('정상 유효·무효와 제한 거부의 코드를 구분한다', () => {
  const result = simulate([request(0, { actorLabel: 'benign', credentialValid: true }), request(1, { actorLabel: 'benign' }), request(2)], { policy: 'account', threshold: 2 });
  assert.deepEqual(result.map(row => row.statusCode), [200, 401, 429]);
  assert.equal(summarize(result).benignBlocked, 0);
});

test('실행 식별자가 다르면 상태를 독립적으로 유지한다', () => {
  const result = simulate([request(0, { runId: 'seed1' }), request(1, { runId: 'seed2', timeMs: 0 })], { policy: 'account', threshold: 1 });
  assert.deepEqual(result.map(row => row.allowed), [true, true]);
});

test('분모가 없으면 비율은 null이다', () => {
  const result = summarize(simulate([request(0, { actorLabel: 'benign' })], { policy: 'none' }));
  assert.equal(result.attackAllowedRate, null);
  assert.equal(result.attackBlockedRate, null);
  assert.equal(result.benignBlockedRate, 0);
  assert.equal(summarize([]).benignBlockedRate, null);
});

test('비교 API가 같은 입력을 네 정책에 적용한다', () => {
  const result = comparePolicies([request(0), request(1)], { threshold: 1 });
  assert.equal(result[0].threshold, 0);
  assert.deepEqual(result.map(row => row.summary.allowed), [2, 1, 1, 1]);
});

test('사용자 입력의 1~500건 범위와 식별자를 검증한다', () => {
  assert.equal(validateRequests([]).valid, false);
  assert.equal(validateRequests(Array.from({ length: 500 }, (_, index) => request(index))).valid, true);
  assert.equal(validateRequests(Array.from({ length: 501 }, (_, index) => request(index))).valid, false);
  assert.equal(validateRequests([request(0, { ipId: '192.0.2.1' })]).valid, false);
  assert.equal(validateRequests([request(0, { accountId: 'example@example.test' })]).valid, false);
  assert.equal(validateRequests([request(0, { ipId: 'syn-<script>' })]).valid, false);
  assert.equal(validateRequests([request(0, { requestId: 'same' }), request(1, { requestId: 'same' })]).valid, false);
});

test('잘못된 라벨·불리언·시각·요청 형태를 거부한다', () => {
  for (const changes of [{ actorLabel: 'unknown' }, { credentialValid: 'false' }, { timeMs: -1 }, { timeMs: 1.5 }, { timeMs: Infinity }, { timeMs: Number.MAX_SAFE_INTEGER + 1 }, { originalIndex: -1 }, { seed: 0 }, { runId: '' }]) {
    assert.equal(validateRequests([request(0, changes)]).valid, false);
  }
  for (const value of [null, {}, 'text', [null], [[]]]) assert.equal(validateRequests(value).valid, false);
  assert.equal(validateRequests([request(0)], { maxRequests: -1 }).valid, false);
});

test('누락된 요청 식별자를 생성하며 설정 오류를 거부한다', () => {
  const { requestId, ...withoutId } = request(0);
  assert.equal(validateRequests([withoutId]).requests[0].requestId, 'custom:1');
  for (const options of [{ policy: 'unknown' }, { policy: 'ip', threshold: 0 }, { policy: 'ip', threshold: 1.5 }, { policy: 'ip', windowMs: 0 }]) assert.throws(() => simulate([request(0)], options));
  assert.throws(() => simulate([request(0, { ipId: '' })], { policy: 'ip' }));
});

test('압축 원자료에서 한 시드와 전체 시드 요청을 정확한 수로 복구한다', async () => {
  const data = JSON.parse(await readFile(new URL('../../career/apps/login-policy/data/paper-data.json', import.meta.url), 'utf8'));
  assert.equal(getPaperRequests(data, { scenario: 'distributed_target', seed: 1 }).length, 200);
  assert.equal(getPaperRequests(data, { scenario: 'distributed_target', seed: 'all' }).length, 6000);
  assert.equal(getPaperRequests(data, { scenario: 'all', seed: 'all' }).length, 24000);
  assert.throws(() => getPaperRequests(data, { seed: 31 }));
  assert.throws(() => getPaperRequests(data, { scenario: 'unknown' }));
  assert.throws(() => getPaperRequests({}));
});

test('논문 전체 시드의 정상 전용 입력은 과다 비율을 만들지 않는다', async () => {
  const data = JSON.parse(await readFile(new URL('../../career/apps/login-policy/data/paper-data.json', import.meta.url), 'utf8'));
  const input = getPaperRequests(data, { scenario: 'shared_nat_benign', seed: 'all' });
  const result = comparePolicies(input, { threshold: 5 });
  assert.equal(result[1].summary.benignBlockedRate, 95);
  assert.equal(result[2].summary.benignBlockedRate, 0);
  assert.equal(result[1].summary.attackAllowedRate, null);
});
