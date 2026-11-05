/** T10의 합성 요청을 동일한 이동 시간창 규칙으로 재생한다. 네트워크 호출은 없다. */
export const SCENARIOS = Object.freeze([
  { id: 'distributed_target', label: '여러 IP가 한 계정에 집중', description: '여러 출발지에서 한 계정으로 과다 요청을 보내는 합성 예시입니다.' },
  { id: 'single_source_spray', label: '한 IP가 여러 계정에 요청', description: '한 출발지에서 여러 계정으로 과다 요청을 나누는 합성 예시입니다.' },
  { id: 'shared_nat_benign', label: '정상 이용자가 IP를 공유', description: '정상 계정 50개가 IP 하나를 공유하는 합성 예시입니다.' },
  { id: 'targeted_mixed', label: '한 계정에 정상·과다 요청 혼재', description: '정상 이용자와 과다 요청이 같은 계정의 할당량을 공유합니다.' },
].map(Object.freeze));

export const POLICIES = Object.freeze([
  { id: 'none', label: '제한 없음', description: '비교 기준으로 모든 요청을 허용합니다.' },
  { id: 'ip', label: 'IP 단위', description: '같은 출발지 식별자의 허용 요청을 셉니다.' },
  { id: 'account', label: '계정 단위', description: '같은 계정 식별자의 허용 요청을 셉니다.' },
  { id: 'dual', label: 'IP·계정 복합', description: 'IP와 계정을 각각 확인하고 하나라도 한도이면 거부합니다.' },
].map(Object.freeze));

const textField = (value, maximum = 160) => typeof value === 'string' && value.trim().length > 0
  && value.length <= maximum && !/[\u0000-\u001f\u007f]/u.test(value);
const integer = value => Number.isSafeInteger(value) && value >= 0;
const syntheticId = value => typeof value === 'string' && /^syn-[A-Za-z0-9_-]{1,80}$/u.test(value);

/** 사용자 JSON은 기본 1~500건이다. 논문 자료에는 명시적으로 더 큰 상한을 준다. */
export function validateRequests(input, { maxRequests = 500 } = {}) {
  const errors = [];
  if (!Number.isSafeInteger(maxRequests) || maxRequests < 1 || maxRequests > 100000) {
    return { valid: false, errors: ['요청 상한은 1~100000 사이의 정수여야 합니다.'], requests: [] };
  }
  if (!Array.isArray(input) || input.length < 1 || input.length > maxRequests) {
    return { valid: false, errors: [`요청은 1~${maxRequests}건의 JSON 배열이어야 합니다.`], requests: [] };
  }
  const requests = [];
  const seenIds = new Set();
  const runOrder = new Map();
  input.forEach((row, index) => {
    const prefix = `${index + 1}번째 요청: `;
    if (row === null || typeof row !== 'object' || Array.isArray(row)) {
      errors.push(`${prefix}객체여야 합니다.`);
      return;
    }
    const startErrors = errors.length;
    const requestId = row.requestId ?? `custom:${index + 1}`;
    const runId = row.runId ?? 'custom';
    if (!integer(row.timeMs)) errors.push(`${prefix}timeMs는 0 이상의 안전한 정수여야 합니다.`);
    if (!syntheticId(row.ipId)) errors.push(`${prefix}ipId는 syn- 뒤에 영문·숫자·밑줄·하이픈 1~80자를 붙인 예시 식별자여야 합니다.`);
    if (!syntheticId(row.accountId)) errors.push(`${prefix}accountId는 syn- 뒤에 영문·숫자·밑줄·하이픈 1~80자를 붙인 예시 식별자여야 합니다.`);
    if (!['attack', 'benign'].includes(row.actorLabel)) errors.push(`${prefix}actorLabel은 attack 또는 benign이어야 합니다.`);
    if (typeof row.credentialValid !== 'boolean') errors.push(`${prefix}credentialValid는 불리언이어야 합니다.`);
    if (!textField(requestId)) errors.push(`${prefix}requestId가 유효하지 않습니다.`);
    if (seenIds.has(requestId)) errors.push(`${prefix}requestId가 중복됩니다.`);
    seenIds.add(requestId);
    if (!textField(runId)) errors.push(`${prefix}runId가 유효하지 않습니다.`);
    if (row.originalIndex !== undefined && !integer(row.originalIndex)) errors.push(`${prefix}originalIndex는 0 이상의 안전한 정수여야 합니다.`);
    if (row.scenario !== undefined && !textField(row.scenario)) errors.push(`${prefix}scenario가 유효하지 않습니다.`);
    if (row.seed !== undefined && (!Number.isSafeInteger(row.seed) || row.seed < 1)) errors.push(`${prefix}seed는 양의 정수여야 합니다.`);
    if (errors.length !== startErrors) return;
    if (!runOrder.has(runId)) runOrder.set(runId, runOrder.size);
    requests.push({
      requestId, timeMs: row.timeMs, ipId: row.ipId, accountId: row.accountId,
      actorLabel: row.actorLabel, credentialValid: row.credentialValid,
      originalIndex: row.originalIndex ?? index, runId,
      ...(row.scenario === undefined ? {} : { scenario: row.scenario }),
      ...(row.seed === undefined ? {} : { seed: row.seed }),
    });
  });
  if (errors.length) return { valid: false, errors, requests: [] };
  // 같은 시각은 생성 순번으로 정렬하고, 순번까지 같으면 배열 순서를 유지한다.
  requests.sort((a, b) => runOrder.get(a.runId) - runOrder.get(b.runId)
    || a.timeMs - b.timeMs || a.originalIndex - b.originalIndex);
  return { valid: true, errors: [], requests };
}

function settings({ policy, threshold = 5, windowMs = 60000 } = {}) {
  if (!POLICIES.some(item => item.id === policy)) throw new TypeError('policy는 none, ip, account, dual 중 하나여야 합니다.');
  if (!Number.isSafeInteger(threshold) || threshold < (policy === 'none' ? 0 : 1)) throw new TypeError('제한 정책의 threshold는 양의 안전한 정수여야 합니다.');
  if (!Number.isSafeInteger(windowMs) || windowMs < 1) throw new TypeError('windowMs는 양의 안전한 정수여야 합니다.');
  return { policy, threshold: policy === 'none' ? 0 : threshold, windowMs };
}

/** 판정에는 시각·IP·계정만 사용한다. 라벨과 자격은 판정 뒤의 집계에만 사용한다. */
export function simulate(input, options = {}) {
  const { policy, threshold, windowMs } = settings(options);
  const checked = validateRequests(input, { maxRequests: 100000 });
  if (!checked.valid) throw new TypeError(checked.errors.join('\n'));
  const runStates = new Map();
  return checked.requests.map(request => {
    if (!runStates.has(request.runId)) runStates.set(request.runId, { ip: new Map(), account: new Map() });
    const state = runStates.get(request.runId);
    const active = [];
    if (policy === 'ip' || policy === 'dual') active.push(['ip', request.ipId]);
    if (policy === 'account' || policy === 'dual') active.push(['account', request.accountId]);
    const counts = { ip: null, account: null };
    const expiredAt = request.timeMs - windowMs;
    for (const [kind, key] of active) {
      if (!state[kind].has(key)) state[kind].set(key, []);
      const history = state[kind].get(key);
      let expiredCount = 0;
      while (expiredCount < history.length && history[expiredCount] <= expiredAt) expiredCount += 1;
      if (expiredCount) history.splice(0, expiredCount);
      counts[kind] = history.length;
    }
    const deniedBy = active.filter(([kind]) => counts[kind] >= threshold).map(([kind]) => kind).join('|');
    const allowed = deniedBy === '';
    if (allowed) for (const [kind, key] of active) state[kind].get(key).push(request.timeMs);
    return {
      ...request, policy, threshold, windowMs, allowed, deniedBy,
      ipCount: counts.ip, accountCount: counts.account,
      statusCode: allowed ? (request.credentialValid ? 200 : 401) : 429,
    };
  });
}

export function summarize(decisions) {
  if (!Array.isArray(decisions)) throw new TypeError('판정 결과는 배열이어야 합니다.');
  const result = {
    attempts: decisions.length, attackAttempts: 0, benignAttempts: 0,
    allowed: 0, denied: 0, attackAllowed: 0, attackBlocked: 0, benignAllowed: 0, benignBlocked: 0,
    status200: 0, status401: 0, status429: 0,
  };
  for (const decision of decisions) {
    if (!decision || typeof decision.allowed !== 'boolean' || !['attack', 'benign'].includes(decision.actorLabel)
      || ![200, 401, 429].includes(decision.statusCode)) throw new TypeError('판정 결과의 라벨·허용 여부·상태 코드가 유효하지 않습니다.');
    const actor = decision.actorLabel === 'attack' ? 'attack' : 'benign';
    result[`${actor}Attempts`] += 1;
    result[decision.allowed ? 'allowed' : 'denied'] += 1;
    result[`${actor}${decision.allowed ? 'Allowed' : 'Blocked'}`] += 1;
    result[`status${decision.statusCode}`] += 1;
  }
  const rate = (numerator, denominator) => denominator === 0 ? null : numerator / denominator * 100;
  return {
    ...result,
    attackAllowedRate: rate(result.attackAllowed, result.attackAttempts),
    attackBlockedRate: rate(result.attackBlocked, result.attackAttempts),
    benignBlockedRate: rate(result.benignBlocked, result.benignAttempts),
  };
}

export function comparePolicies(requests, { threshold = 5, windowMs = 60000 } = {}) {
  return POLICIES.map(({ id: policy }) => {
    const decisions = simulate(requests, { policy, threshold, windowMs });
    return { policy, threshold: policy === 'none' ? 0 : threshold, windowMs, decisions, summary: summarize(decisions) };
  });
}

/** Python으로 생성한 원자료를 펼친다. 이 함수는 난수를 다시 생성하지 않는다. */
export function getPaperRequests(data, { scenario = SCENARIOS[0].id, seed = 1 } = {}) {
  if (data?.schemaVersion !== 1 || !Array.isArray(data.runs)
    || !Array.isArray(data.dictionaries?.ipIds) || !Array.isArray(data.dictionaries?.accountIds)) throw new TypeError('논문 데이터 형식이 올바르지 않습니다.');
  if (scenario !== 'all' && !SCENARIOS.some(item => item.id === scenario)) throw new TypeError('알 수 없는 시나리오입니다.');
  if (seed !== 'all' && (!Number.isInteger(seed) || seed < 1 || seed > 30)) throw new TypeError('seed는 1~30 또는 all이어야 합니다.');
  const selected = data.runs.filter(run => (scenario === 'all' || run.scenario === scenario) && (seed === 'all' || run.seed === seed));
  const requests = selected.flatMap(run => run.requests.map(tuple => {
    const [timeMs, ipIndex, accountIndex, actorCode, credentialCode, originalIndex] = tuple;
    if (tuple.length !== 6 || !integer(ipIndex) || !integer(accountIndex)
      || ipIndex >= data.dictionaries.ipIds.length || accountIndex >= data.dictionaries.accountIds.length
      || ![0, 1].includes(actorCode) || ![0, 1].includes(credentialCode)) throw new TypeError('논문 데이터의 압축 행이 올바르지 않습니다.');
    return {
      requestId: `${run.scenario}:s${String(run.seed).padStart(2, '0')}:e${String(originalIndex).padStart(3, '0')}`,
      timeMs, ipId: data.dictionaries.ipIds[ipIndex], accountId: data.dictionaries.accountIds[accountIndex],
      actorLabel: actorCode === 1 ? 'attack' : 'benign', credentialValid: credentialCode === 1,
      originalIndex, runId: `${run.scenario}:s${run.seed}`, scenario: run.scenario, seed: run.seed,
    };
  }));
  const checked = validateRequests(requests, { maxRequests: 100000 });
  if (!checked.valid) throw new TypeError(checked.errors.join('\n'));
  return checked.requests;
}
