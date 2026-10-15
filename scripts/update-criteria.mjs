import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const decisions = new Map();
function record(ids, status, evidence) { for (const id of ids) decisions.set(id, { status, evidence }); }
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
record(range(13, 18), '로컬 검증 통과 / 운영 대기', 'docs/CARD-1-REPORT.md; verification/card1/');
record(range(19, 24), '가상 인증기·설명서 근거 확인 / 실기·운영 대기', 'docs/AUTH-EXPLANATION.md ③; verification/card2/registration-evidence.json');
record([25], '모의 취소·경합 시험 통과 / 실제 기기 취소 대기', 'docs/CARD-2-REPORT.md; tests/registration.test.mjs; verification/card2/cancelled.png');
record([26], '미완료: 사용자 실제 패스키 저장 위치 미확인', 'docs/AUTH-EXPLANATION.md ① 및 ⑥');
record(range(27, 35), '가상 인증기·설명서 근거 확인 / 실기·운영 대기', 'docs/CARD-3-REPORT.md; docs/AUTH-EXPLANATION.md; verification/card3/');
record(range(42, 46), '독립 가상 인증기 2개 시험 통과 / 실기·운영 대기', 'docs/CARD-4-REPORT.md; docs/AUTH-EXPLANATION.md ④; verification/card4/');
record([1], '미완료: T08 운영 결과물 URL 미확정·미제출', 'docs/SUBMISSION.md; docs/SUBMISSION-CHECKLIST.md');
record([2], '미완료: 고정 소스 URL 확정·공식 입력 대기', 'docs/SUBMISSION.md; docs/SUBMISSION-CHECKLIST.md');
record([3], '미완료: T08 운영 URL의 새 시크릿 접근 대기', 'docs/SUBMISSION.md; verification/deployment-access.json');
record([10], '로컬 공개 첫 화면 확인 / T08 운영 배포 대기', 'verification/card1/public-and-locked.png; docs/CARD-5-REPORT.md');
record([11], '기존 공개 원문 보존 검사 통과 / 운영 배포 대기', 'scripts/check-source.mjs; contracts/profile-baseline.html; docs/CARD-5-REPORT.md');
record([12], '새 자료는 가상 내용 / 최종 비밀값 검사 및 기존 공개 이름 보존 범위 기록', 'docs/AUTH-EXPLANATION.md; docs/CARD-5-REPORT.md');
record(range(36, 41), '가상 계정 양방향 격리·건수 보존·소스 위치 확인 / 운영 대기', 'verification/card5/isolation-evidence.json; docs/AUTH-EXPLANATION.md ③·④');
record(range(47, 53), '설명서·확인법·실제 판단 초안 작성·대조 / 공식 제출 대기', 'docs/AUTH-EXPLANATION.md; docs/SUBMISSION.md; docs/CARD-5-REPORT.md');
let doc = await readFile('docs/CRITERIA.md', 'utf8');
const ids = [...doc.matchAll(/^\| T08-C(\d+) \|/gm)].map(match => Number(match[1]));
assert.equal(ids.length, 47);
assert.equal(decisions.size, 47);
for (const id of ids) {
  const result = decisions.get(id);
  assert.ok(result, `기준 C${id}의 확인 상태가 없습니다.`);
  doc = doc.replace(new RegExp(`^(\\| T08-C${id} \\|[^\\r\\n]*?\\|) [^|]* \\| [^|]* \\|$`, 'm'), `$1 ${result.status} | ${result.evidence} |`);
}
doc = doc.replace('- 초기 상태: 모든 기준은 **미검증**입니다. 구현·문서 초안·예상 결과를 실제 통과로 표시하지 않습니다.', '- 갱신 상태: 47개 기준 모두에 실제 로컬 근거 또는 미완료 사유를 연결했습니다. 로컬·가상 인증기·실제 기기·운영·공식 제출을 구분합니다. 전체 과제 통과를 뜻하지 않습니다.');
await writeFile('docs/CRITERIA.md', doc);
console.log('47개 기준의 실제 근거와 남은 검증 상태를 갱신했습니다.');
