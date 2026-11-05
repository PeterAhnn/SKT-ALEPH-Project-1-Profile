import { SCENARIOS, POLICIES, validateRequests, comparePolicies, getPaperRequests } from './engine.mjs';

const $ = id => document.getElementById(id);
const form = $('compare-form');
const source = $('source-mode');
const number = value => value.toLocaleString('ko-KR');
const percent = value => value === null ? '계산 불가' : `${value.toFixed(3)}%`;
const policyNames = { none: '제한 없음', ip: 'IP 제한', account: '계정 제한', dual: '복합 제한' };
const paperTitle = '합성 로그인 요청 재생에서 제한 기준이 과다 요청 허용과 정상 이용 손실에 미치는 영향';
const scopeNames = { 'paper-all': '논문 · 전체 30시드', 'paper-seed': '논문 · 한 시드', custom: '직접 입력 · 별도 예시' };
const example = Array.from({ length: 8 }, (_, i) => ({
  timeMs: i === 7 ? 60000 : i * 1000, ipId: `syn-demo-ip-${i % 2 + 1}`,
  accountId: 'syn-demo-account-1', actorLabel: i < 6 ? 'attack' : 'benign', credentialValid: i >= 6,
}));
let data;
let current;
let page = 0;
let busy = false;
let loadVersion = 0;
const pageSize = 12;

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
function clearResult(message = '조건을 바꿨습니다. ‘정책 비교하기’를 눌러 새 결과를 확인하세요.') {
  current = undefined;
  $('result-content').hidden = true;
  $('request-details').hidden = true;
  $('scope-badge').textContent = '계산 대기';
  $('result-status').textContent = message;
  $('save-status').textContent = '';
  $('save-result').disabled = true;
}
function showError(message) {
  $('form-error').textContent = message;
  $('form-error').hidden = false;
}
function clearError() {
  $('form-error').hidden = true;
  $('form-error').textContent = '';
}
function availability() {
  const canRun = source.value === 'custom' || Boolean(data);
  $('run-compare').disabled = busy || !canRun;
  $('run-compare').replaceChildren(document.createTextNode(busy ? '계산하고 있습니다…' : '정책 비교하기'), node('span', '', '→'));
}
function syncMode() {
  const custom = source.value === 'custom';
  $('custom-section').hidden = !custom;
  document.querySelector('.seed-field').hidden = source.value !== 'paper-seed';
  $('scenario-fieldset').disabled = custom;
  availability();
}
function settings() {
  const mode = source.value;
  const threshold = Number($('threshold').value);
  if (![5, 10].includes(threshold)) throw new Error('허용 한도는 논문의 비교 설정인 5회 또는 10회로 선택해 주세요.');
  if (!Object.hasOwn(scopeNames, mode)) throw new Error('사용할 자료를 다시 선택해 주세요.');
  const scenario = form.elements.scenario.value;
  const seed = mode === 'paper-all' ? 'all' : Number($('seed').value);
  if (!SCENARIOS.some(item => item.id === scenario)) throw new Error('요청 상황을 다시 선택해 주세요.');
  return { mode, threshold, windowMs: 60000, scenario, seed };
}
function getRequests(config) {
  if (config.mode !== 'custom') {
    if (!data) throw new Error('논문 자료를 불러오지 못했습니다. 다시 불러오거나 직접 입력 예시를 사용해 주세요.');
    return getPaperRequests(data, { scenario: config.scenario, seed: config.seed });
  }
  const text = $('custom-input').value;
  if (text.length > 250000) throw new Error('입력이 너무 큽니다. 예시 요청을 500건 이하로 줄여 주세요.');
  let input;
  try { input = JSON.parse(text); } catch { throw new Error('JSON 형식이 올바르지 않습니다. 대괄호·쉼표·큰따옴표를 확인하거나 ‘예시 입력으로 되돌리기’를 눌러 주세요.'); }
  const validation = validateRequests(input);
  if (!validation.valid) throw new Error(validation.errors.slice(0, 5).join('\n'));
  return validation.requests;
}
function metric(summary, kind) {
  const attack = kind === 'attack';
  const rate = attack ? summary.attackAllowedRate : summary.benignBlockedRate;
  const numerator = attack ? summary.attackAllowed : summary.benignBlocked;
  const denominator = attack ? summary.attackAttempts : summary.benignAttempts;
  const label = attack ? '과다 요청 허용률' : '정상 요청 거부율';
  const box = node('div', 'metric');
  box.setAttribute('aria-label', `${label} ${percent(rate)}, ${number(numerator)}건 / ${number(denominator)}건`);
  const top = node('div', 'metric-top');
  top.append(node('span', 'metric-kind', label), node('strong', rate === null ? 'unavailable' : '', percent(rate)));
  const track = node('div', 'bar-track');
  track.setAttribute('aria-hidden', 'true');
  const fill = node('i', `bar-fill ${kind}`);
  fill.style.width = `${rate ?? 0}%`;
  track.append(fill);
  box.append(top, track, node('p', 'fraction', `${number(numerator)} / ${number(denominator)}건${rate === null ? ' · 해당 요청 없음' : ''}`));
  return box;
}
function finding(config) {
  const messages = {
    distributed_target: ['한 계정으로 모이면, 계정 기준이 작동합니다.', '여러 IP로 분산된 과다 요청은 IP별 한도 안에 들어올 수 있습니다. 계정 기준의 과다 요청 허용률과 정상 요청 거부율을 함께 비교해 보세요.'],
    single_source_spray: ['한 IP에서 퍼지면, IP 기준이 작동합니다.', '여러 계정으로 나뉜 요청은 계정별 한도 안에 들어올 수 있습니다. 앞의 상황과 제한 기준의 효과가 달라지는지 확인해 보세요.'],
    shared_nat_benign: ['같은 IP를 쓴다는 이유로, 정상 요청도 막힙니다.', '이 자료에는 과다 요청이 없습니다. 과다 요청 허용률은 0%가 아니라 ‘계산 불가’입니다. 공유 IP에서 정상 요청이 얼마나 거부되는지 살펴보세요.'],
    targeted_mixed: ['한 계정의 한도를 함께 쓰면, 정상 이용에도 손실이 생깁니다.', '과다 요청을 막는 기준이 정상 요청까지 거부할 수 있습니다. 과다 요청 허용률만으로 정책을 고르지 마세요.'],
    custom: ['직접 입력 결과는 별도 예시입니다.', '요청을 시드(runId)별로 나눈 뒤 시각과 originalIndex 순서로 정렬해 재생합니다. 논문 집계와 구분하고 두 지표의 분자·분모를 함께 살펴보세요.'],
  };
  const [title, text] = messages[config.mode === 'custom' ? 'custom' : config.scenario];
  $('finding').replaceChildren(node('strong', '', title), node('p', '', text));
}
function renderResult() {
  const { config, comparisons, requests } = current;
  const first = comparisons[0].summary;
  const scenarioLabel = SCENARIOS.find(item => item.id === config.scenario).label;
  const scope = config.mode === 'custom' ? '직접 입력 예시' : config.mode === 'paper-all' ? '전체 30시드' : `시드 ${config.seed}`;
  $('scope-badge').textContent = scope;
  $('result-status').textContent = `${config.mode === 'custom' ? '직접 입력한 합성 요청' : scenarioLabel} · ${number(requests.length)}건 · 과다 ${number(first.attackAttempts)}건 / 정상 ${number(first.benignAttempts)}건 · 60초당 ${config.threshold}회`;
  const cards = POLICIES.map(({ id }) => {
    const result = comparisons.find(item => item.policy === id);
    const card = node('article', 'policy-card');
    card.dataset.policy = id;
    card.setAttribute('aria-label', policyNames[id]);
    const name = node('h3', 'policy-name', policyNames[id]);
    name.append(node('span', 'policy-rule', id === 'none' ? '모든 요청 통과' : id === 'dual' ? '둘 중 하나라도 한도면 거부' : `같은 ${id === 'ip' ? 'IP' : '계정'}별 한도`));
    card.append(name, metric(result.summary, 'attack'), metric(result.summary, 'benign'));
    return card;
  });
  $('policy-cards').replaceChildren(...cards);
  finding(config);
  $('result-content').hidden = false;
  $('request-details').hidden = false;
  $('save-result').disabled = false;
  page = 0;
  renderDetails();
}
function renderDetails() {
  if (!current) return;
  const comparison = current.comparisons.find(item => item.policy === $('detail-policy').value);
  const decisions = comparison.decisions;
  const pages = Math.ceil(decisions.length / pageSize);
  page = Math.max(0, Math.min(page, pages - 1));
  const start = page * pageSize;
  const rows = decisions.slice(start, start + pageSize).map(decision => {
    const row = node('article', 'request-row');
    const time = node('div', 'request-time', `${(decision.timeMs / 1000).toFixed(3)}초`);
    if (decision.seed) time.append(node('div', '', `시드 ${decision.seed}`));
    const copy = node('div', 'request-copy');
    copy.append(node('p', '', decision.actorLabel === 'attack' ? '과다 요청' : '정상 요청'), node('p', 'request-identities', `${decision.ipId} → ${decision.accountId}`));
    const counts = [decision.ipCount === null ? '' : `IP ${decision.ipCount}회`, decision.accountCount === null ? '' : `계정 ${decision.accountCount}회`].filter(Boolean).join(' · ');
    const reason = decision.allowed ? (comparison.policy === 'none' ? '제한을 적용하지 않습니다.' : `판정 직전 ${counts}. 한도 ${comparison.threshold}회 미만입니다.`) : `${decision.deniedBy.split('|').map(key => key === 'ip' ? 'IP' : '계정').join('·')} 한도에 도달했습니다. 판정 직전 ${counts}.`;
    copy.append(node('p', 'request-reason', reason));
    row.append(time, copy, node('span', `decision-label ${decision.allowed ? 'allow' : 'deny'}`, decision.allowed ? '허용' : '거부'));
    return row;
  });
  $('detail-list').replaceChildren(...rows);
  $('details-scope').textContent = '허용은 제한기 통과를 뜻합니다. 횟수는 판정 직전 60초 동안 허용된 요청 수입니다. 라벨은 집계용입니다.';
  $('page-status').textContent = `${number(start + 1)}–${number(Math.min(start + pageSize, decisions.length))} / ${number(decisions.length)}건`;
  $('previous-page').disabled = page === 0;
  $('next-page').disabled = page >= pages - 1;
}
async function runComparison({ focusError = true } = {}) {
  if (busy) return;
  busy = true;
  clearError();
  clearResult('같은 요청을 네 정책에 적용하고 있습니다.');
  availability();
  try {
    const config = settings();
    const requests = getRequests(config);
    const comparisons = comparePolicies(requests, { threshold: config.threshold, windowMs: config.windowMs });
    current = { config, requests, comparisons };
    renderResult();
  } catch (error) {
    clearResult('계산하지 못했습니다. 입력이나 자료를 확인한 뒤 다시 비교해 주세요.');
    showError(error.message || '비교를 완료하지 못했습니다. 예시 입력으로 되돌린 뒤 다시 시도해 주세요.');
    if (focusError) (source.value === 'custom' ? $('custom-input') : $('run-compare')).focus();
  } finally {
    busy = false;
    availability();
  }
}
async function loadData() {
  const version = ++loadVersion;
  $('retry-data').hidden = true;
  try {
    const response = await fetch(new URL('./data/paper-data.json', import.meta.url), { cache: 'no-cache', credentials: 'omit' });
    if (!response.ok) throw new Error('data-unavailable');
    const loaded = await response.json();
    // Full shape validation is delegated to the same reader used by the engine.
    const checked = getPaperRequests(loaded, { scenario: SCENARIOS[0].id, seed: 1 });
    if (checked.length !== 200 || loaded.metadata?.isSynthetic !== true) throw new Error('data-invalid');
    if (version !== loadVersion) return;
    data = loaded;
    clearError();
    availability();
    if (!current && source.value !== 'custom') await runComparison({ focusError: false });
  } catch {
    if (version !== loadVersion) return;
    data = undefined;
    if (source.value !== 'custom') clearResult('논문 자료를 불러오지 못했습니다.');
    showError('논문 자료를 불러오지 못했습니다. ‘논문 자료 다시 불러오기’를 누르거나 사용할 자료를 ‘직접 입력’으로 바꿔 예시를 비교해 주세요. file://로 열었다면 README에 따라 로컬 서버를 실행해 주세요.');
    $('retry-data').hidden = false;
    availability();
  }
}
function exportResult() {
  if (!current) return;
  const { config, requests, comparisons } = current;
  const exportData = {
    schemaVersion: 1, title: '로그인 요청 제한 정책 비교', paperTitle,
    isSynthetic: true, scope: scopeNames[config.mode],
    settings: { ...config, scenario: config.mode === 'custom' ? 'custom' : config.scenario, seed: config.mode === 'custom' ? null : config.seed },
    requestCount: requests.length,
    formulas: { attackAllowedRate: 'attackAllowed / attackAttempts * 100; denominator 0 => null', benignBlockedRate: 'benignBlocked / benignAttempts * 100; denominator 0 => null' },
    rules: ['(t-60000,t]의 허용 이력만 누적', '거부 이력 미누적', '복합 정책은 IP·계정을 독립 검사', '시드별 독립 이력'],
    results: comparisons.map(({ policy, threshold, windowMs, summary }) => ({ policy, threshold, windowMs, summary })),
    ...(config.mode === 'custom' ? { exampleRequests: requests } : { sourceFiles: data.metadata.sourceFiles }),
    limitations: ['합성 요청의 로컬 재생 결과이며 운영 서비스 관측이 아닙니다.', '허용은 제한기 통과이며 인증 성공이나 계정 침해 성공이 아닙니다.', '5·10회와 60초는 비교 설정이며 운영 서비스 권장값이 아닙니다.', '실제 서비스의 요청 분포와 정상 이용 손실은 별도로 확인해야 합니다.'],
  };
  const blob = new Blob([JSON.stringify(exportData, null, 2) + '\n'], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = node('a');
  link.href = url;
  link.download = `login-policy-${config.mode === 'custom' ? 'example' : config.scenario}-t${config.threshold}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  $('save-status').textContent = '비교 결과 JSON 저장을 요청했습니다. 브라우저의 다운로드 목록에서 파일을 확인하세요.';
}

for (let seed = 1; seed <= 30; seed += 1) {
  const option = node('option', '', `시드 ${seed}`);
  option.value = seed;
  $('seed').append(option);
}
$('custom-input').value = JSON.stringify(example, null, 2);
form.addEventListener('submit', event => { event.preventDefault(); runComparison(); });
form.addEventListener('change', () => { syncMode(); clearError(); clearResult(); });
$('custom-input').addEventListener('input', () => { clearError(); clearResult(); });
$('reset-example').addEventListener('click', () => { $('custom-input').value = JSON.stringify(example, null, 2); clearError(); clearResult('예시 요청을 복구했습니다. ‘정책 비교하기’를 눌러 비교해 주세요.'); $('custom-input').focus(); });
$('retry-data').addEventListener('click', loadData);
$('detail-policy').addEventListener('change', () => { page = 0; renderDetails(); });
$('previous-page').addEventListener('click', () => { page -= 1; renderDetails(); });
$('next-page').addEventListener('click', () => { page += 1; renderDetails(); });
$('save-result').addEventListener('click', exportResult);
syncMode();
loadData();
