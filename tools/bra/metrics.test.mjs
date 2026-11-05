import test from 'node:test';
import assert from 'node:assert/strict';
import { summarize } from './metrics.mjs';
import { syntheticFixture } from './synthetic-fixture.mjs';

function fixture() {
  return {
    rituals: {
      asOf: '2026-10-20',
      days: [{ date: '2026-10-19', open: 2, close: 1 }],
    },
    attendance: {
      asOf: '2026-10-20',
      start: '2026-08-11',
      end: '2026-10-20',
      trainingDays: 46,
      enrolledDays: 46,
      presentDays: 45,
      absentDays: 0,
      pendingDays: 1,
      rateNumerator: 45,
      displayedPercent: 97.8,
    },
    projects: {
      asOf: '2026-10-20',
      submissions: [{ id: 'T01', submittedAt: '2026-09-02T18:21:00+09:00', status: '기록된 상태' }],
    },
  };
}

test('합성 입력은 저장 87건과 내용 84건, 11과제와 12행을 구분한다', () => {
  const inputs = syntheticFixture();
  const result = summarize(inputs);
  assert.equal(result.asOf, '2026-10-20');
  assert.deepEqual(result.period, { start: '2026-08-11', end: '2026-10-20' });
  assert.deepEqual(result.metrics, {
    ritualDays: 44,
    openStored: 44,
    closeStored: 43,
    openWithContent: 44,
    closeWithContent: 40,
    contentTotal: 84,
    emptyCloseDates: ['2026-08-11', '2026-09-02', '2026-09-16'],
    attendance: { enrolledDays: 46, presentDays: 45, absentDays: 0, pendingDays: 1, percent: 97.8 },
    submittedTasks: 11,
    submissionRows: 12,
  });
  const ritualSource = result.sources.find(source => source.id === 'rituals');
  assert.match(ritualSource.description, /87건/);
  assert.match(ritualSource.description, /84건/);
  for (const date of result.metrics.emptyCloseDates) assert.ok(ritualSource.description.includes(date));
  assert.ok(result.sources.every(source => source.description.includes('공식 13주 과정 전체가 아니라 확보한 기간')));
  assert.deepEqual(result.sources.find(source => source.id === 'projects').period, { start: '2026-09-02', end: '2026-10-19' });
});

test('입력 순서가 달라도 결과가 같고 입력 객체를 바꾸지 않는다', () => {
  const input = fixture();
  input.rituals.days.push({ date: '2026-10-20', open: 1, close: null });
  input.projects.submissions.push({ id: 'T02', submittedAt: '2026-09-03T12:00:00+09:00' });
  const before = structuredClone(input);
  const first = summarize(input);
  assert.deepEqual(input, before);
  input.rituals.days.reverse();
  input.projects.submissions.reverse();
  assert.deepEqual(summarize(input), first);
  assert.equal(JSON.stringify(summarize(before)), JSON.stringify(first));
});

test('기준일 불일치와 존재하지 않는 기준일은 실패한다', () => {
  const input = fixture();
  input.projects.asOf = '2026-10-19';
  assert.throws(() => summarize(input), /기준일 asOf/);
  input.projects.asOf = '2026-10-20';
  input.rituals.asOf = '2026-02-30';
  assert.throws(() => summarize(input), /실제 달력/);
});

test('리추얼 날짜는 실제 달력과 기준일을 검증한다', async t => {
  for (const date of ['2026-02-29', '2026-04-31', '2026-13-01', '2026-00-01', '0000-01-01', '2026-8-11', '2026-10-21']) {
    await t.test(date, () => {
      const input = fixture();
      input.rituals.days[0].date = date;
      assert.throws(() => summarize(input), /날짜|미래/);
    });
  }
});

test('윤년의 2월 29일을 정상 처리한다', () => {
  const input = fixture();
  for (const value of Object.values(input)) value.asOf = '2024-03-01';
  input.rituals.days[0].date = '2024-02-29';
  input.attendance.start = '2024-02-29';
  input.attendance.end = '2024-03-01';
  input.projects.submissions[0].submittedAt = '2024-02-29T12:00:00+09:00';
  assert.deepEqual(summarize(input).period, { start: '2024-02-29', end: '2024-03-01' });
});

test('완전히 같은 리추얼 날짜 행만 중복 제거한다', () => {
  const input = fixture();
  input.rituals.days.push({ close: 1, open: 2, date: '2026-10-19' });
  input.rituals.screenTotals = { days: 1, open: 1, close: 1 };
  assert.equal(summarize(input).metrics.ritualDays, 1);
  input.rituals.days[1].open = 3;
  assert.throws(() => summarize(input), /리추얼 기록이 상충/);
});

test('집계 수가 같아도 원문 또는 메타데이터가 다르면 같은 날짜를 덮어쓰지 않는다', () => {
  const input = fixture();
  input.rituals.days = [
    { date: '2026-10-19', open: ['첫 내용'], close: 1 },
    { date: '2026-10-19', open: ['다른 내용'], close: 1 },
  ];
  assert.throws(() => summarize(input), /리추얼 기록이 상충/);
  input.rituals.days = [
    { date: '2026-10-19', open: 1, close: 1, revision: 1 },
    { date: '2026-10-19', open: 1, close: 1, revision: 2 },
  ];
  assert.throws(() => summarize(input), /리추얼 기록이 상충/);
});

test('null·0·양의 정수·문자열 배열의 저장 여부와 내용을 구분한다', () => {
  const input = fixture();
  input.rituals.days = [
    { date: '2026-10-16', open: null, close: null },
    { date: '2026-10-17', open: 0, close: [] },
    { date: '2026-10-18', open: 99, close: [' ', '\t', '\u3000'] },
    { date: '2026-10-19', open: ['', '내용', '다른 내용'], close: ['실제 내용'] },
    { date: '2026-10-20', open: [], close: null },
  ];
  const result = summarize(input);
  assert.equal(result.metrics.ritualDays, 4);
  assert.equal(result.metrics.openStored, 4);
  assert.equal(result.metrics.closeStored, 3);
  assert.equal(result.metrics.openWithContent, 2);
  assert.equal(result.metrics.closeWithContent, 1);
  assert.equal(result.metrics.contentTotal, 3);
  assert.deepEqual(result.metrics.emptyCloseDates, ['2026-10-17', '2026-10-18']);
  assert.deepEqual(result.sources[0].period, { start: '2026-10-17', end: '2026-10-20' });
});

test('저장 여부를 추정할 수 없는 누락값·음수·소수·객체는 실패한다', async t => {
  for (const value of [undefined, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '3', {}, ['내용', null]]) {
    await t.test(String(value), () => {
      const input = fixture();
      input.rituals.days[0].open = value;
      assert.throws(() => summarize(input), /리추얼 open/);
    });
  }
  const input = fixture();
  delete input.rituals.days[0].close;
  assert.throws(() => summarize(input), /open과 close/);
});

test('화면 합계는 내용 수가 아니라 중복 제거한 저장 수와 대조한다', () => {
  const input = fixture();
  input.rituals.days[0].close = 0;
  input.rituals.screenTotals = { days: 1, open: 1, close: 1 };
  assert.equal(summarize(input).metrics.closeWithContent, 0);
  input.rituals.screenTotals.close = 0;
  assert.throws(() => summarize(input), /화면 합계.close/);
});

test('출석 분모에는 미확정일도 포함하며 재적일 합계 오류를 거부한다', () => {
  const input = fixture();
  assert.equal(summarize(input).metrics.attendance.percent, 97.8);
  input.attendance.pendingDays = 0;
  assert.throws(() => summarize(input), /재적일은/);
});

test('출석률의 분자·화면 표시·숫자 형식을 검증한다', async t => {
  for (const [key, value] of [['rateNumerator', 44], ['displayedPercent', 100], ['displayedPercent', 97.81], ['presentDays', -1], ['absentDays', 0.5], ['trainingDays', 45]]) {
    await t.test(`${key}: ${value}`, () => {
      const input = fixture();
      input.attendance[key] = value;
      assert.throws(() => summarize(input), /분자|출석률|정수|훈련일/);
    });
  }
});

test('재적일이 0이면 출석률은 null이며 잘못된 표시값을 거부한다', () => {
  const input = fixture();
  Object.assign(input.attendance, { trainingDays: 0, enrolledDays: 0, presentDays: 0, absentDays: 0, pendingDays: 0, rateNumerator: 0, displayedPercent: null });
  const result = summarize(input);
  assert.equal(result.metrics.attendance.percent, null);
  assert.match(result.sources[1].description, /재적일이 0/);
  input.attendance.displayedPercent = 0;
  assert.throws(() => summarize(input), /null/);
});

test('출석 기간의 순서·미래일·실제 날짜를 검증한다', async t => {
  for (const [key, value] of [['start', '2026-10-20'], ['end', '2026-10-21'], ['start', '2026-02-30']]) {
    await t.test(`${key}: ${value}`, () => {
      const input = fixture();
      if (key === 'start' && value === '2026-10-20') input.attendance.end = '2026-10-19';
      input.attendance[key] = value;
      assert.throws(() => summarize(input), /종료일보다|미래|실제 달력/);
    });
  }
});

test('동일 과제의 재제출 두 행은 한 과제로 센다', () => {
  const input = fixture();
  input.projects.submissions.push({ id: 'T01', submittedAt: '2026-09-02T18:22:00+09:00' });
  assert.equal(summarize(input).metrics.submissionRows, 2);
  assert.equal(summarize(input).metrics.submittedTasks, 1);
  input.projects.screenTotals = { rows: 2, tasks: 1 };
  summarize(input);
  input.projects.screenTotals.tasks = 2;
  assert.throws(() => summarize(input), /제출 화면 합계.tasks/);
});

test('완전히 같은 제출 행은 제거하고 같은 제출 키의 충돌은 실패한다', () => {
  const input = fixture();
  input.projects.submissions.push(structuredClone(input.projects.submissions[0]));
  assert.equal(summarize(input).metrics.submissionRows, 1);
  input.projects.submissions[1].status = '다른 상태';
  assert.throws(() => summarize(input), /제출시각의 행이 상충/);
});

test('프로젝트 제출시각의 실제 날짜·시각·시간대·미래일을 검증한다', async t => {
  for (const value of ['2026-02-30T12:00:00+09:00', '2026-10-21T00:00:00+09:00', '2026-10-19T24:00:00+09:00', '2026-10-19T12:60:00+09:00', '2026-10-19T12:00:00+14:30', '2026-10-19T12:00:00', '2026-10-19']) {
    await t.test(value, () => {
      const input = fixture();
      input.projects.submissions[0].submittedAt = value;
      assert.throws(() => summarize(input), /submittedAt/);
    });
  }
});

test('서로 다른 과제는 제출 시각이 같아도 별도로 센다', () => {
  const input = fixture();
  input.projects.submissions.push({ ...input.projects.submissions[0], id: 'T02' });
  assert.equal(summarize(input).metrics.submittedTasks, 2);
  assert.equal(summarize(input).metrics.submissionRows, 2);
});

test('빈 입력 기록은 날짜를 꾸며내지 않고 안전하게 집계한다', () => {
  const input = fixture();
  input.rituals.days = [];
  input.projects.submissions = [];
  const result = summarize(input);
  assert.equal(result.metrics.ritualDays, 0);
  assert.equal(result.metrics.contentTotal, 0);
  assert.equal(result.metrics.submittedTasks, 0);
  assert.deepEqual(result.sources[0].period, { start: null, end: null });
  assert.deepEqual(result.sources[2].period, { start: null, end: null });
  assert.deepEqual(result.period, { start: '2026-08-11', end: '2026-10-20' });
});

test('개인정보·원문·출처 입력 문구·생성시각·절대경로를 출력에 복사하지 않는다', () => {
  const input = fixture();
  const privateText = '개인 원문 synthetic@example.invalid';
  input.rituals.days[0].open = [privateText];
  input.rituals.evidence = [{ text: privateText }];
  input.rituals.source = privateText;
  input.attendance.note = privateText;
  input.projects.submissions[0].title = privateText;
  const output = JSON.stringify(summarize(input));
  assert.ok(!output.includes(privateText));
  assert.ok(!output.includes('synthetic@example.invalid'));
  assert.ok(!output.includes('submittedAt'));
  assert.ok(!output.includes('generatedAt'));
  assert.ok(!/[A-Z]:\\|\/Users\/|\/home\//.test(output));
});
