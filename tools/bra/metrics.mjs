import { isDeepStrictEqual } from 'node:util';

function record(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name}는 객체여야 합니다.`);
  }
  return value;
}

function nonnegativeInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${name}는 0 이상의 안전한 정수여야 합니다.`);
  }
  return value;
}

function calendarDate(value, name, asOf) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new TypeError(`${name}는 YYYY-MM-DD 날짜여야 합니다.`);
  }
  const [year, month, day] = value.split('-').map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthLengths = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > monthLengths[month - 1]) {
    throw new RangeError(`${name}가 실제 달력에 없는 날짜입니다.`);
  }
  if (asOf && value > asOf) {
    throw new RangeError(`${name}가 기준일보다 미래입니다.`);
  }
  return value;
}

function submissionDate(value, asOf) {
  if (typeof value !== 'string') {
    throw new TypeError('submittedAt은 시간대가 있는 ISO 날짜·시간이어야 합니다.');
  }
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if (!match) {
    throw new TypeError('submittedAt은 시간대가 있는 ISO 날짜·시간이어야 합니다.');
  }
  const date = calendarDate(match[1], 'submittedAt의 날짜', asOf);
  const [, , hours, minutes, seconds, , zone, , offsetHours, offsetMinutes] = match;
  if (Number(hours) > 23 || Number(minutes) > 59 || Number(seconds) > 59 ||
      (zone !== 'Z' && (Number(offsetHours) > 14 || Number(offsetMinutes) > 59 ||
        (Number(offsetHours) === 14 && Number(offsetMinutes) !== 0)))) {
    throw new RangeError('submittedAt의 시각 또는 시간대가 유효하지 않습니다.');
  }
  const epoch = Date.parse(value);
  if (!Number.isFinite(epoch)) {
    throw new RangeError('submittedAt이 유효한 날짜·시간이 아닙니다.');
  }
  return { date, epoch };
}

function ritualEntry(value, name) {
  if (value === null) return { stored: false, items: 0 };
  if (Array.isArray(value)) {
    if (!value.every(item => typeof item === 'string')) {
      throw new TypeError(`${name} 배열에는 문자열 항목만 넣을 수 있습니다.`);
    }
    return { stored: true, items: value.filter(item => item.trim().length > 0).length };
  }
  return { stored: true, items: nonnegativeInteger(value, name) };
}

function datePeriod(dates) {
  if (dates.length === 0) return { start: null, end: null };
  const ordered = [...dates].sort();
  return { start: ordered[0], end: ordered.at(-1) };
}

function compareTotals(input, expected, name) {
  if (input === undefined) return;
  record(input, name);
  for (const [key, value] of Object.entries(expected)) {
    if (Object.hasOwn(input, key) && nonnegativeInteger(input[key], `${name}.${key}`) !== value) {
      throw new RangeError(`${name}.${key}가 실제 집계와 일치하지 않습니다.`);
    }
  }
}

function summarizeRituals(input, asOf) {
  if (!Array.isArray(input.days)) throw new TypeError('리추얼 days는 배열이어야 합니다.');
  const byDate = new Map();
  for (const rawDay of input.days) {
    const day = record(rawDay, '리추얼 날짜 행');
    const date = calendarDate(day.date, '리추얼 날짜', asOf);
    if (!Object.hasOwn(day, 'open') || !Object.hasOwn(day, 'close')) {
      throw new TypeError('리추얼 날짜 행에는 open과 close가 필요합니다. 미저장은 null로 표시합니다.');
    }
    const open = ritualEntry(day.open, '리추얼 open');
    const close = ritualEntry(day.close, '리추얼 close');
    if (byDate.has(date)) {
      if (!isDeepStrictEqual(byDate.get(date).raw, day)) {
        throw new RangeError('같은 날짜의 리추얼 기록이 상충합니다.');
      }
      continue;
    }
    byDate.set(date, { raw: day, date, open, close });
  }
  const days = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  const storedDays = days.filter(day => day.open.stored || day.close.stored);
  const openStored = days.filter(day => day.open.stored).length;
  const closeStored = days.filter(day => day.close.stored).length;
  const openWithContent = days.filter(day => day.open.items > 0).length;
  const closeWithContent = days.filter(day => day.close.items > 0).length;
  const emptyCloseDates = days.filter(day => day.close.stored && day.close.items === 0).map(day => day.date);
  compareTotals(input.screenTotals, { days: storedDays.length, open: openStored, close: closeStored }, '리추얼 화면 합계');
  return {
    period: datePeriod(storedDays.map(day => day.date)),
    ritualDays: storedDays.length,
    openStored,
    closeStored,
    openWithContent,
    closeWithContent,
    contentTotal: openWithContent + closeWithContent,
    emptyCloseDates,
    unsavedCloseDays: days.filter(day => !day.close.stored).length,
  };
}

function summarizeAttendance(input, asOf) {
  const start = calendarDate(input.start, '출석 시작일', asOf);
  const end = calendarDate(input.end, '출석 종료일', asOf);
  if (start > end) throw new RangeError('출석 시작일이 종료일보다 늦습니다.');
  const enrolledDays = nonnegativeInteger(input.enrolledDays, 'enrolledDays');
  const presentDays = nonnegativeInteger(input.presentDays, 'presentDays');
  const absentDays = nonnegativeInteger(input.absentDays, 'absentDays');
  const pendingDays = nonnegativeInteger(input.pendingDays, 'pendingDays');
  if (enrolledDays !== presentDays + absentDays + pendingDays) {
    throw new RangeError('재적일은 출석일·결석일·미확정일의 합과 같아야 합니다.');
  }
  if (input.rateNumerator !== undefined && nonnegativeInteger(input.rateNumerator, 'rateNumerator') !== presentDays) {
    throw new RangeError('출석률 분자가 출석일과 일치하지 않습니다.');
  }
  if (input.trainingDays !== undefined) {
    const trainingDays = nonnegativeInteger(input.trainingDays, 'trainingDays');
    if (trainingDays < enrolledDays) throw new RangeError('훈련일이 재적일보다 작습니다.');
  }
  const percent = enrolledDays === 0 ? null : Math.round((presentDays / enrolledDays) * 1000) / 10;
  if (input.displayedPercent !== undefined) {
    const displayed = input.displayedPercent;
    if (percent === null) {
      if (displayed !== null) throw new RangeError('재적일이 0이면 출석률은 null이어야 합니다.');
    } else if (typeof displayed !== 'number' || !Number.isFinite(displayed) || Math.abs(displayed - percent) > 1e-9) {
      throw new RangeError('화면 출석률이 출석일 ÷ 재적일 × 100의 소수 첫째 자리 반올림 값과 다릅니다.');
    }
  }
  return { period: { start, end }, enrolledDays, presentDays, absentDays, pendingDays, percent };
}

function summarizeProjects(input, asOf) {
  if (!Array.isArray(input.submissions)) throw new TypeError('프로젝트 submissions는 배열이어야 합니다.');
  const bySubmission = new Map();
  const taskIds = new Set();
  for (const rawSubmission of input.submissions) {
    const row = record(rawSubmission, '제출 행');
    if (typeof row.id !== 'string' || row.id.trim().length === 0 || row.id !== row.id.trim()) {
      throw new TypeError('과제 id는 앞뒤 공백이 없는 비어 있지 않은 문자열이어야 합니다.');
    }
    const { date, epoch } = submissionDate(row.submittedAt, asOf);
    const key = JSON.stringify([row.id, epoch]);
    if (bySubmission.has(key)) {
      if (!isDeepStrictEqual(bySubmission.get(key).raw, row)) {
        throw new RangeError('동일한 과제·제출시각의 행이 상충합니다.');
      }
      continue;
    }
    bySubmission.set(key, { raw: row, date });
    taskIds.add(row.id);
  }
  compareTotals(input.screenTotals, {
    rows: bySubmission.size,
    tasks: taskIds.size,
    submissionRows: bySubmission.size,
    submittedTasks: taskIds.size,
  }, '제출 화면 합계');
  return {
    period: datePeriod([...bySubmission.values()].map(row => row.date)),
    submittedTasks: taskIds.size,
    submissionRows: bySubmission.size,
  };
}

function periodDescription(period) {
  return period.start === null ? '저장 기록이 없는 기간' : `${period.start}부터 ${period.end}까지`;
}

/** 기준일이 같은 최소 입력 자료만 집계하며 기록 원문은 결과에 복사하지 않습니다. */
export function summarize({ rituals, attendance, projects }) {
  const inputs = [
    ['rituals', record(rituals, 'rituals')],
    ['attendance', record(attendance, 'attendance')],
    ['projects', record(projects, 'projects')],
  ];
  const asOf = calendarDate(rituals.asOf, 'rituals.asOf');
  for (const [name, input] of inputs) {
    if (calendarDate(input.asOf, `${name}.asOf`) !== asOf) {
      throw new RangeError('입력 자료의 기준일 asOf가 서로 다릅니다.');
    }
  }
  const ritual = summarizeRituals(rituals, asOf);
  const attendanceResult = summarizeAttendance(attendance, asOf);
  const project = summarizeProjects(projects, asOf);
  const { period: attendancePeriod, ...attendanceMetrics } = attendanceResult;
  const storedTotal = ritual.openStored + ritual.closeStored;
  const emptyDates = ritual.emptyCloseDates.length ? ritual.emptyCloseDates.join(', ') : '없음';
  const limitation = '공식 13주 과정 전체가 아니라 확보한 기간의 자료만 측정했습니다.';
  const sources = [
    {
      id: 'rituals',
      label: '리추얼 기록',
      period: ritual.period,
      description: `${periodDescription(ritual.period)}의 저장 날짜 ${ritual.ritualDays}일입니다. 아침 ${ritual.openStored}건·마무리 ${ritual.closeStored}건으로 총 ${storedTotal}건이 저장됐으며, 내용이 있는 아침 ${ritual.openWithContent}건·마무리 ${ritual.closeWithContent}건의 합은 ${ritual.contentTotal}건입니다. 저장된 빈 마무리 ${ritual.emptyCloseDates.length}건의 날짜는 ${emptyDates}이며, 마무리 미저장 날짜는 ${ritual.unsavedCloseDays}일입니다. 내용 수는 개별 문장 수가 아니라 내용이 있는 아침·마무리 기록 수입니다. ${limitation}`,
    },
    {
      id: 'attendance',
      label: '내 출석 기록',
      period: attendancePeriod,
      description: `${periodDescription(attendancePeriod)}의 재적 ${attendanceMetrics.enrolledDays}일은 출석 ${attendanceMetrics.presentDays}일·결석 ${attendanceMetrics.absentDays}일·미확정 ${attendanceMetrics.pendingDays}일의 합입니다. ${attendanceMetrics.percent === null ? '재적일이 0이므로 출석률을 계산하지 않았습니다.' : `출석 ${attendanceMetrics.presentDays}일 ÷ 재적 ${attendanceMetrics.enrolledDays}일 × 100을 소수 첫째 자리로 반올림한 출석률은 ${attendanceMetrics.percent}%입니다. 미확정일도 분모에 포함됩니다.`} ${limitation}`,
    },
    {
      id: 'projects',
      label: '내 제출 현황',
      period: project.period,
      description: `${periodDescription(project.period)}의 제출 행 ${project.submissionRows}개를 과제 ID 기준으로 중복 제거해 ${project.submittedTasks}개 과제로 집계했습니다. 서로 다른 시각의 재제출은 제출 행에 포함되지만 과제 수를 늘리지 않습니다. 제출 행을 점수나 별도의 승인 결과로 바꾸지 않습니다. ${limitation}`,
    },
  ];
  return {
    asOf,
    period: datePeriod(sources.flatMap(source => [source.period.start, source.period.end]).filter(date => date !== null)),
    metrics: {
      ritualDays: ritual.ritualDays,
      openStored: ritual.openStored,
      closeStored: ritual.closeStored,
      openWithContent: ritual.openWithContent,
      closeWithContent: ritual.closeWithContent,
      contentTotal: ritual.contentTotal,
      emptyCloseDates: ritual.emptyCloseDates,
      attendance: attendanceMetrics,
      submittedTasks: project.submittedTasks,
      submissionRows: project.submissionRows,
    },
    sources,
  };
}
