/** 원자료와 브라우저 엔진을 전수 대조한다. 보고서는 verification/brb에 새로만 쓴다. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCENARIOS, getPaperRequests, simulate, summarize } from '../../career/apps/login-policy/engine.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const argumentsMap = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  if (!['--source', '--report'].includes(process.argv[index]) || !process.argv[index + 1]) throw new Error('허용 인수는 --source 경로와 --report 경로입니다.');
  argumentsMap.set(process.argv[index], process.argv[index + 1]);
}
const source = resolve(ROOT, argumentsMap.get('--source') ?? '../SKT-ALEPH-Project-10-Paper');
const reportRoot = resolve(ROOT, 'verification/brb');
const stamp = new Date().toISOString().replace(/[:.]/gu, '-');
const reportPath = resolve(ROOT, argumentsMap.get('--report') ?? `verification/brb/paper-engine-${stamp}.json`);
const reportRelative = relative(reportRoot, reportPath);
if (reportRelative.startsWith('..') || isAbsolute(reportRelative)) throw new Error('보고서는 verification/brb 안에만 저장할 수 있습니다.');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const report = { schemaVersion: 1, kind: 'brb-paper-engine-verification', checkedAt: new Date().toISOString(), passed: false, checks: {}, counts: {}, limitations: [
  '합성 원자료와 브라우저 엔진의 일치를 검증한 결과입니다.',
  '실제 로그인·계정 침해 성공률이나 운영 서비스 안전성을 검증한 결과가 아닙니다.',
] };

function csv(text) {
  const lines = text.replace(/^\uFEFF/u, '').trimEnd().split(/\r?\n/u);
  const headers = lines.shift().split(',');
  return lines.map((line, index) => {
    // 이 연구의 CSV는 인용부호나 행 내부 줄바꿈이 없는 고정 필드 형식이다.
    if (line.includes('"')) throw new Error(`${index + 2}행에 지원하지 않는 인용 필드가 있습니다.`);
    const values = line.split(',');
    assert.equal(values.length, headers.length, 'CSV 열 수가 다릅니다.');
    return Object.fromEntries(headers.map((header, offset) => [header, values[offset]]));
  });
}

function equalValue(actual, expected, description) {
  if (typeof expected === 'number' && Number.isFinite(expected)) {
    assert.ok(typeof actual === 'number' && Math.abs(actual - expected) <= 1e-9, `${description}: ${actual} / ${expected}`);
  } else assert.equal(actual, expected, description);
}

const countMetrics = {
  attempts: 'attempts', attack_attempts: 'attackAttempts', benign_attempts: 'benignAttempts',
  allowed: 'allowed', denied: 'denied', attack_allowed: 'attackAllowed', attack_blocked: 'attackBlocked',
  benign_allowed: 'benignAllowed', benign_blocked: 'benignBlocked',
  status_200: 'status200', status_401: 'status401', status_429: 'status429',
};
const rateMetrics = { attack_allowed_pct: 'attackAllowedRate', attack_blocked_pct: 'attackBlockedRate', benign_rejected_pct: 'benignBlockedRate' };

function statistics(values) {
  const defined = values.filter(value => value !== null);
  if (!defined.length) return { n_defined: 0, mean: null, sd: null, min: null, max: null };
  const mean = defined.reduce((sum, value) => sum + value, 0) / defined.length;
  const sd = defined.length > 1 ? Math.sqrt(defined.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (defined.length - 1)) : null;
  return { n_defined: defined.length, mean, sd, min: Math.min(...defined), max: Math.max(...defined) };
}

try {
  const dataBytes = await readFile(resolve(ROOT, 'career/apps/login-policy/data/paper-data.json'));
  const data = JSON.parse(dataBytes);
  report.dataSha256 = sha256(dataBytes);
  const tables = {};
  const sources = {};
  for (const [name, metadata] of Object.entries(data.metadata.sourceFiles)) {
    const sourceFile = resolve(source, metadata.path);
    const sourceRelative = relative(source, sourceFile);
    assert.ok(!sourceRelative.startsWith('..') && !isAbsolute(sourceRelative), '원본 경로가 자료 폴더를 벗어납니다.');
    const bytes = await readFile(sourceFile);
    assert.equal(sha256(bytes), metadata.sha256, `${name} SHA256이 다릅니다.`);
    assert.equal(bytes.length, metadata.bytes, `${name} 크기가 다릅니다.`);
    sources[name] = metadata;
    if (['requests', 'decisions', 'runs', 'summary'].includes(name)) tables[name] = csv(bytes.toString('utf8'));
    if (name === 'analysis') tables.analysis = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/u, ''));
  }
  report.sourceFiles = sources;
  report.checks.sourceHashes = { passed: true, files: Object.keys(sources).length };
  const expectedCounts = { requests: 24000, decisions: 168000, runs: 840, summary: 28 };
  for (const [name, count] of Object.entries(expectedCounts)) assert.equal(tables[name].length, count, `${name} 행 수`);

  const requests = getPaperRequests(data, { scenario: 'all', seed: 'all' });
  assert.equal(requests.length, 24000);
  let requestFieldsMatched = 0;
  requests.forEach((row, index) => {
    const reconstructed = {
      is_synthetic: 'true', request_id: row.requestId, scenario: row.scenario, seed: String(row.seed),
      rng_seed: String(SCENARIOS.findIndex(item => item.id === row.scenario) * 1000003 + row.seed),
      original_event_index: String(row.originalIndex), time_ms: String(row.timeMs), ip_id: row.ipId,
      account_id: row.accountId, actor_label: row.actorLabel, credential_valid: String(row.credentialValid),
    };
    for (const [key, value] of Object.entries(tables.requests[index])) {
      assert.equal(reconstructed[key], value, `입력 ${index + 1}행 ${key}`);
      requestFieldsMatched += 1;
    }
  });
  report.checks.requestRoundTrip = { passed: true, rows: requests.length, fields: requestFieldsMatched };

  const decisionGroups = new Map();
  for (const row of tables.decisions) {
    const key = `${row.scenario}:${row.seed}:${row.policy}:${row.threshold}`;
    if (!decisionGroups.has(key)) decisionGroups.set(key, []);
    decisionGroups.get(key).push(row);
  }
  const rawRuns = new Map(tables.runs.map(row => [`${row.scenario}:${row.seed}:${row.policy}:${row.threshold}`, row]));
  assert.equal(rawRuns.size, 840);
  assert.equal(decisionGroups.size, 840);
  const summariesByCondition = new Map();
  const decisionsByCondition = new Map();
  const counts = { requests: 24000, decisions: 0, runs: 0, summary: 0, decisionFields: 0, runFields: 0, summaryFields: 0, analysisFields: 0 };
  for (const { id: scenario } of SCENARIOS) {
    for (let seed = 1; seed <= 30; seed += 1) {
      const runInput = getPaperRequests(data, { scenario, seed });
      assert.equal(runInput.length, 200);
      for (const [policy, threshold] of [['none', 0], ['ip', 5], ['ip', 10], ['account', 5], ['account', 10], ['dual', 5], ['dual', 10]]) {
        const key = `${scenario}:${seed}:${policy}:${threshold}`;
        const decisions = simulate(runInput, { policy, threshold, windowMs: 60000 });
        const reference = decisionGroups.get(key);
        assert.equal(decisions.length, reference.length, `판정 행 수 ${key}`);
        decisions.forEach((row, index) => {
          const reconstructed = {
            is_synthetic: 'true', request_id: row.requestId, scenario, seed: String(seed),
            original_event_index: String(row.originalIndex), time_ms: String(row.timeMs), policy,
            threshold: String(threshold), window_ms: '60000', condition_id: `${policy}_t${threshold}_w60000`,
            actor_label: row.actorLabel, credential_valid: String(row.credentialValid), allowed: String(row.allowed),
            status_code: String(row.statusCode), denied_by: row.deniedBy,
          };
          for (const [field, value] of Object.entries(reference[index])) {
            assert.equal(reconstructed[field], value, `판정 ${key} ${index + 1}행 ${field}`);
            counts.decisionFields += 1;
          }
        });
        counts.decisions += decisions.length;
        const result = summarize(decisions);
        const runRow = {
          is_synthetic: 'true', scenario, seed: String(seed),
          rng_seed: String(SCENARIOS.findIndex(item => item.id === scenario) * 1000003 + seed),
          policy, threshold: String(threshold), window_ms: '60000', condition_id: `${policy}_t${threshold}_w60000`,
          ...Object.fromEntries(Object.entries(countMetrics).map(([raw, api]) => [raw, String(result[api])])),
        };
        for (const [field, value] of Object.entries(rawRuns.get(key))) {
          assert.equal(runRow[field], value, `집계 ${key} ${field}`);
          counts.runFields += 1;
        }
        counts.runs += 1;
        const conditionKey = `${scenario}:${policy}:${threshold}`;
        if (!summariesByCondition.has(conditionKey)) {
          summariesByCondition.set(conditionKey, []);
          decisionsByCondition.set(conditionKey, []);
        }
        summariesByCondition.get(conditionKey).push(result);
        decisionsByCondition.get(conditionKey).push(...decisions);
      }
    }
  }
  const analysisSummaries = Object.values(tables.analysis).find(value => Array.isArray(value) && value.length === 28
    && value.every(row => row && typeof row === 'object' && 'scenario' in row && 'policy' in row));
  assert.ok(analysisSummaries, '분석 JSON의 28개 요약을 찾지 못했습니다.');
  const analysisByCondition = new Map(analysisSummaries.map(row => [`${row.scenario}:${row.policy}:${row.threshold}`, row]));
  for (const reference of tables.summary) {
    const key = `${reference.scenario}:${reference.policy}:${reference.threshold}`;
    const runSummaries = summariesByCondition.get(key);
    assert.equal(runSummaries.length, 30);
    const totals = summarize(decisionsByCondition.get(key));
    const calculated = { scenario: reference.scenario, policy: reference.policy, threshold: Number(reference.threshold), window_ms: 60000, n_runs: 30 };
    for (const [raw, api] of Object.entries(countMetrics)) {
      calculated[`${raw}_total`] = totals[api];
      for (const [stat, value] of Object.entries(statistics(runSummaries.map(row => row[api])))) calculated[`${raw}_${stat}`] = value;
    }
    for (const [raw, api] of Object.entries(rateMetrics)) {
      for (const [stat, value] of Object.entries(statistics(runSummaries.map(row => row[api])))) calculated[`${raw}_${stat}`] = value;
      calculated[`${raw}_pooled`] = totals[api];
    }
    const bundledReference = data.paperSummaries.find(row => `${row.scenario}:${row.policy}:${row.threshold}` === key);
    for (const [field, value] of Object.entries(reference)) {
      const parsed = ['scenario', 'policy'].includes(field) ? value : value === '' ? null : Number(value);
      equalValue(calculated[field], parsed, `요약 ${key} ${field}`);
      equalValue(bundledReference[field], parsed, `묶음 요약 ${key} ${field}`);
      counts.summaryFields += 1;
      equalValue(analysisByCondition.get(key)[field], parsed, `분석 JSON ${key} ${field}`);
      counts.analysisFields += 1;
    }
    counts.summary += 1;
  }
  for (const [name, value] of Object.entries(expectedCounts)) assert.equal(counts[name], value, `최종 ${name} 대조 수`);
  report.counts = counts;
  report.checks.allDecisions = { passed: true, rows: counts.decisions, fields: counts.decisionFields };
  report.checks.allRunSummaries = { passed: true, rows: counts.runs, fields: counts.runFields };
  report.checks.allConditionSummaries = { passed: true, rows: counts.summary, fields: counts.summaryFields, numericTolerance: 1e-9 };
  report.checks.analysisJson = { passed: true, fields: counts.analysisFields };
  report.checks.originalDataUnchanged = { passed: true };
  report.passed = true;
} catch (error) {
  report.error = { name: error.name, message: error.message };
  process.exitCode = 1;
}
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx', encoding: 'utf8' });
console.log(JSON.stringify({ passed: report.passed, report: reportPath, counts: report.counts, ...(report.error ? { error: report.error } : {}) }));
