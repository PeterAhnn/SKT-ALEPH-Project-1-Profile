#!/usr/bin/env python3
"""T10의 합성 원자료를 브라우저용 압축 JSON으로 변환한다. 원본은 수정하지 않는다."""
import argparse
import csv
import hashlib
import json
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SOURCE = ROOT.parent / 'SKT-ALEPH-Project-10-Paper'
SCENARIOS = ('distributed_target', 'single_source_spray', 'shared_nat_benign', 'targeted_mixed')


def read_csv(path):
    with path.open(encoding='utf-8-sig', newline='') as stream:
        return list(csv.DictReader(stream))


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=DEFAULT_SOURCE)
    parser.add_argument('--output', type=Path, default=ROOT / 'career/apps/login-policy/data/paper-data.json')
    args = parser.parse_args()
    source = args.source.resolve()
    files = {
        'requests': source / 'data/main/raw/requests.csv',
        'decisions': source / 'data/main/raw/decisions.csv',
        'runs': source / 'data/main/raw/runs.csv',
        'summary': source / 'results/summary.csv',
        'analysis': source / 'results/analysis.json',
        'experiment': source / 'scripts/experiment.py',
        'paper': source / 'paper/T10-안형섭-논문.md',
    }
    tables = {key: read_csv(files[key]) for key in ('requests', 'decisions', 'runs', 'summary')}
    analysis = json.loads(files['analysis'].read_text(encoding='utf-8-sig'))
    expected = {'requests': 24000, 'decisions': 168000, 'runs': 840, 'summary': 28}
    for name, count in expected.items():
        if len(tables[name]) != count:
            raise ValueError(f'{name} 행 수가 기대값 {count}와 다릅니다.')
    for name in ('requests', 'decisions', 'runs'):
        if any(row['is_synthetic'] != 'true' for row in tables[name]):
            raise ValueError('합성 자료 표시가 없는 행은 포함할 수 없습니다.')
    counts = Counter((row['scenario'], int(row['seed'])) for row in tables['requests'])
    if set(counts) != {(scenario, seed) for scenario in SCENARIOS for seed in range(1, 31)} or set(counts.values()) != {200}:
        raise ValueError('시나리오·시드별 200건 규칙을 만족하지 않습니다.')
    if len({row['request_id'] for row in tables['requests']}) != 24000:
        raise ValueError('요청 식별자가 중복됩니다.')
    ip_ids = sorted({row['ip_id'] for row in tables['requests']})
    account_ids = sorted({row['account_id'] for row in tables['requests']})
    ip_indices = {value: index for index, value in enumerate(ip_ids)}
    account_indices = {value: index for index, value in enumerate(account_ids)}
    runs = []
    grouped = {(scenario, seed): [] for scenario in SCENARIOS for seed in range(1, 31)}
    for row in tables['requests']:
        original_index = int(row['original_event_index'])
        expected_id = f"{row['scenario']}:s{int(row['seed']):02d}:e{original_index:03d}"
        if row['request_id'] != expected_id or row['actor_label'] not in ('attack', 'benign') or row['credential_valid'] not in ('true', 'false'):
            raise ValueError('압축 변환에 필요한 원자료 필드가 예상과 다릅니다.')
        grouped[(row['scenario'], int(row['seed']))].append([
            int(row['time_ms']), ip_indices[row['ip_id']], account_indices[row['account_id']],
            int(row['actor_label'] == 'attack'), int(row['credential_valid'] == 'true'), original_index,
        ])
    for (scenario, seed), requests in grouped.items():
        if requests != sorted(requests, key=lambda row: (row[0], row[5])):
            raise ValueError('원자료의 시각·생성 순번 정렬이 달라졌습니다.')
        runs.append({'scenario': scenario, 'seed': seed, 'requests': requests})
    summaries = []
    for row in tables['summary']:
        summaries.append({key: value if key in ('scenario', 'policy') else None if value == '' else float(value)
                          for key, value in row.items()})
    # 분석 JSON과 CSV의 전체 조건별 요약 값도 변환 전에 대조한다.
    analysis_summaries = analysis.get('condition_summaries') or analysis.get('summaries') or analysis.get('summary')
    if not isinstance(analysis_summaries, list):
        candidates = [value for value in analysis.values() if isinstance(value, list) and len(value) == 28
                      and all(isinstance(item, dict) and 'scenario' in item and 'policy' in item for item in value)]
        if len(candidates) != 1:
            raise ValueError('analysis.json에서 28개 조건 요약을 확인하지 못했습니다.')
        analysis_summaries = candidates[0]
    by_condition = {(row['scenario'], row['policy'], row['threshold']): row for row in analysis_summaries}
    matched_summary_fields = 0
    for row in summaries:
        reference = by_condition[(row['scenario'], row['policy'], row['threshold'])]
        for key, value in row.items():
            if reference.get(key) != value:
                raise ValueError(f'CSV와 분석 JSON이 다릅니다: {key}')
            matched_summary_fields += 1
    result = {
        'schemaVersion': 1,
        'metadata': {
            'title': 'T10 합성 로그인 요청 제한 비교 원자료',
            'isSynthetic': True,
            'sourceProject': source.name,
            'sourceFiles': {key: {'path': path.relative_to(source).as_posix(), 'sha256': digest(path), 'bytes': path.stat().st_size}
                            for key, path in files.items()},
            'expectedCounts': expected,
            'conversionChecks': {'scenarioSeedRuns': len(runs), 'requestsPerRun': 200,
                                 'summaryFieldsMatchedWithAnalysis': matched_summary_fields},
            'tupleFields': ['timeMs', 'ipIndex', 'accountIndex', 'actorCode', 'credentialCode', 'originalIndex'],
            'encoding': {'actorCode': {'0': 'benign', '1': 'attack'}, 'credentialCode': {'0': False, '1': True}},
            'conversionRules': [
                '원본 CSV 행을 사용하며 난수를 다시 생성하지 않는다.',
                'IP·계정 문자열을 사전순 사전의 0 기반 인덱스로 바꾼다.',
                '정수 시각·생성 순번과 평가 라벨·자격 불리언을 손실 없이 보존한다.',
                'requestId는 scenario:s두자리seed:e세자리originalIndex 형식으로 복구한다.',
                '각 시나리오·시드 요청열을 독립 실행으로 유지한다.',
                '요약 CSV의 빈 비율은 null로 바꾸고 수치는 반올림하지 않는다.',
                '논문의 30시드 합계와 사용자가 선택한 단일 시드 결과를 구분한다.',
            ],
            'policy': {'windowMs': 60000, 'thresholds': [5, 10], 'history': 'allowed_only',
                       'validInterval': '(t-windowMs,t]', 'dual': 'independent_ip_and_account'},
            'limitations': analysis.get('limitations', []),
        },
        'dictionaries': {'ipIds': ip_ids, 'accountIds': account_ids},
        'runs': runs,
        'paperSummaries': summaries,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print(json.dumps({'passed': True, 'output': str(args.output), 'bytes': args.output.stat().st_size,
                      'sha256': digest(args.output), 'counts': expected, 'summary_fields_matched': matched_summary_fields}, ensure_ascii=False))


if __name__ == '__main__':
    main()
