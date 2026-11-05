const elements = {
  status: document.getElementById('records-status'),
  statusText: document.getElementById('records-status-text'),
  retry: document.getElementById('retry-records'),
  content: document.getElementById('records-content'),
  updates: document.getElementById('approved-updates'),
  paragraphs: document.getElementById('approved-paragraphs'),
  sources: document.getElementById('sources-list'),
};

const number = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 });
const allowedAbilities = new Set(['자기조절력', '대인관계력', '자기동기력']);

function requireText(value) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('기록 문구가 없습니다.');
  return value.trim();
}

function requireNumber(value, { maximum = Infinity, integer = true } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > maximum || (integer && !Number.isInteger(value))) {
    throw new Error('기록 숫자가 올바르지 않습니다.');
  }
  return value;
}

function dateText(value) {
  const text = requireText(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(text);
  if (!match) throw new Error('기록 날짜가 올바르지 않습니다.');
  const [, year, month, day] = match;
  const date = new Date(`${year}-${month}-${day}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== `${year}-${month}-${day}`) {
    throw new Error('기록 날짜가 올바르지 않습니다.');
  }
  return `${year}. ${month}. ${day}.`;
}

function periodText(period) {
  if (typeof period === 'string') return requireText(period);
  if (!period || typeof period !== 'object') throw new Error('기록 기간이 없습니다.');
  if (period.start === null && period.end === null) return '아직 기록이 없습니다.';
  return `${dateText(period.start)} ~ ${dateText(period.end)}`;
}

function readData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('기록을 읽을 수 없습니다.');
  const asOf = dateText(data.asOf);
  const period = periodText(data.period);
  const metrics = data.metrics;
  if (!metrics || typeof metrics !== 'object') throw new Error('기록 숫자가 없습니다.');
  const attendance = metrics.attendance;
  if (!attendance || typeof attendance !== 'object') throw new Error('출석 숫자가 없습니다.');

  const normalized = {
    asOf,
    period,
    ritualDays: requireNumber(metrics.ritualDays),
    openStored: requireNumber(metrics.openStored),
    closeStored: requireNumber(metrics.closeStored),
    openWithContent: requireNumber(metrics.openWithContent),
    closeWithContent: requireNumber(metrics.closeWithContent),
    contentTotal: requireNumber(metrics.contentTotal),
    submittedTasks: requireNumber(metrics.submittedTasks),
    attendance: {
      enrolledDays: requireNumber(attendance.enrolledDays),
      presentDays: requireNumber(attendance.presentDays),
      absentDays: requireNumber(attendance.absentDays),
      pendingDays: requireNumber(attendance.pendingDays),
      percent: attendance.percent === null && attendance.enrolledDays === 0 ? null : requireNumber(attendance.percent, { maximum: 100, integer: false }),
    },
  };

  if (!Array.isArray(metrics.emptyCloseDates)) throw new Error('빈 기록의 날짜가 없습니다.');
  normalized.emptyCloseDates = metrics.emptyCloseDates.map(dateText);
  if (normalized.openWithContent > normalized.openStored || normalized.closeWithContent > normalized.closeStored || normalized.contentTotal !== normalized.openWithContent + normalized.closeWithContent) {
    throw new Error('저장 기록과 내용 기록이 맞지 않습니다.');
  }
  const days = normalized.attendance;
  if (days.enrolledDays !== days.presentDays + days.absentDays + days.pendingDays) {
    throw new Error('출석 집계의 일수가 맞지 않습니다.');
  }

  if (!Array.isArray(data.sources) || data.sources.length === 0) throw new Error('숫자의 출처가 없습니다.');
  normalized.sources = data.sources.map((source) => {
    if (!source || typeof source !== 'object') throw new Error('출처를 읽을 수 없습니다.');
    return {
      id: requireText(source.id),
      label: requireText(source.label),
      period: periodText(source.period),
      description: requireText(source.description),
    };
  });
  if (!Array.isArray(data.approvedParagraphs)) throw new Error('승인한 문장 목록이 없습니다.');
  normalized.approvedParagraphs = data.approvedParagraphs.map((paragraph) => {
    if (!paragraph || typeof paragraph !== 'object' || !allowedAbilities.has(paragraph.ability)) {
      throw new Error('승인한 문장의 능력을 확인할 수 없습니다.');
    }
    return {
      id: requireText(paragraph.id),
      date: dateText(paragraph.date),
      ability: paragraph.ability,
      text: requireText(paragraph.text),
      source: requireText(paragraph.source),
    };
  });
  return normalized;
}

function setText(id, text) {
  document.getElementById(id).textContent = text;
}

function renderSources(sources) {
  const fragment = document.createDocumentFragment();
  for (const source of sources) {
    const item = document.createElement('li');
    const name = document.createElement('span');
    name.className = 'source-name';
    name.textContent = source.label;
    const description = document.createElement('span');
    description.className = 'source-description';
    description.textContent = source.description;
    const period = document.createElement('span');
    period.className = 'source-period';
    period.textContent = `대상 기간: ${source.period}`;
    item.append(name, description, period);
    fragment.append(item);
  }
  elements.sources.replaceChildren(fragment);
}

function renderApprovedParagraphs(paragraphs) {
  const fragment = document.createDocumentFragment();
  for (const paragraph of paragraphs) {
    const article = document.createElement('article');
    article.className = 'approved-paragraph';
    const meta = document.createElement('p');
    meta.className = 'approved-meta';
    meta.textContent = `${paragraph.date} · ${paragraph.ability}`;
    const text = document.createElement('p');
    text.textContent = paragraph.text;
    const source = document.createElement('p');
    source.className = 'approved-source';
    source.textContent = `근거: ${paragraph.source}`;
    article.append(meta, text, source);
    fragment.append(article);
  }
  elements.paragraphs.replaceChildren(fragment);
  elements.updates.hidden = paragraphs.length === 0;
}

function renderData(data) {
  setText('metric-content', number.format(data.contentTotal));
  setText('metric-days', number.format(data.ritualDays));
  setText('metric-attendance', data.attendance.percent === null ? '—' : number.format(data.attendance.percent));
  document.getElementById('metric-attendance-unit').hidden = data.attendance.percent === null;
  setText('metric-tasks', number.format(data.submittedTasks));
  setText('records-story-connection', `시험의 아쉬움 뒤에도 계획을 세우고 배움을 이어 갔습니다. ${number.format(data.ritualDays)}일에 걸쳐 내용이 남은 ${number.format(data.contentTotal)}회의 리추얼은, 다시 시작한 뒤 다음 행동을 돌아본 기록입니다.`);
  setText('records-period', `기준일 ${data.asOf} · 실제 기록 기간 ${data.period}`);

  const storedTotal = data.openStored + data.closeStored;
  const emptyText = data.emptyCloseDates.length > 0
    ? ` 내용이 없는 마무리 ${number.format(data.emptyCloseDates.length)}회(${data.emptyCloseDates.join(', ')})는 내용 횟수에서 제외했습니다.`
    : ' 내용이 없는 마무리 기록은 없습니다.';
  setText('records-count-note', `리추얼은 아침 ${number.format(data.openStored)}회와 마무리 ${number.format(data.closeStored)}회, 총 ${number.format(storedTotal)}회가 저장되어 있습니다. 이 가운데 내용이 있는 기록은 아침 ${number.format(data.openWithContent)}회와 마무리 ${number.format(data.closeWithContent)}회, 총 ${number.format(data.contentTotal)}회입니다.${emptyText}`);

  const attendance = data.attendance;
  const pendingText = attendance.pendingDays > 0
    ? ` 미확정 ${number.format(attendance.pendingDays)}일도 분모에 포함한 수치입니다.`
    : ' 미확정 출석일은 없습니다.';
  setText('records-attendance-note', `출석은 재적 ${number.format(attendance.enrolledDays)}일 가운데 출석 ${number.format(attendance.presentDays)}일, 결석 ${number.format(attendance.absentDays)}일입니다.${pendingText}`);
  renderSources(data.sources);
  renderApprovedParagraphs(data.approvedParagraphs);
}

async function loadRecords() {
  elements.retry.disabled = true;
  elements.retry.hidden = true;
  elements.status.hidden = false;
  elements.statusText.textContent = '기록 숫자를 불러오고 있습니다.';
  elements.content.hidden = true;
  elements.updates.hidden = true;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch('./data.json', { cache: 'no-store', signal: controller.signal });
    if (!response.ok) throw new Error('기록 파일을 불러오지 못했습니다.');
    const data = readData(await response.json());
    renderData(data);
    elements.content.hidden = false;
    elements.status.hidden = true;
  } catch {
    elements.statusText.textContent = '기록 숫자를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
    elements.retry.hidden = false;
  } finally {
    clearTimeout(timeout);
    elements.retry.disabled = false;
  }
}

elements.retry.addEventListener('click', loadRecords);
loadRecords();
