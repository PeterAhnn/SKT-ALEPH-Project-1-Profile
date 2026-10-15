import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const decisions = new Map();
function record(ids, status, evidence) { for (const id of ids) decisions.set(id, { status, evidence }); }
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const production = 'verification/production/run-mv93637i-d8b509/production-evidence.json';
record(range(13, 18), '운영 HTTPS 검증 통과 / 인증 화면은 가상 인증기 시험', `docs/CARD-1-REPORT.md; ${production}; verification/production/http-evidence.json`);
record(range(19, 24), '운영 가상 인증기·설명서 근거 및 실제 등록 사용자 확인', `docs/AUTH-EXPLANATION.md ③; ${production}; verification/real-device-user-confirmation.json`);
record([25], '모의 취소·경합 시험 통과 / 실제 기기 취소 대기', 'docs/CARD-2-REPORT.md; tests/registration.test.mjs; verification/card2/cancelled.png');
record([26], '실제 저장 위치: 구글 비밀번호 관리자 / 사용자 직접 확인', 'verification/real-device-user-confirmation.json; docs/AUTH-EXPLANATION.md ①');
record(range(27, 35), '운영 가상 인증기 근거·실제 로그인 사용자 확인', `docs/CARD-3-REPORT.md; ${production}; verification/real-device-user-confirmation.json`);
record([42], '운영 가상 키 2개 시험 및 실제 2개 등록 사용자 확인', `${production}; verification/real-device-user-confirmation.json`);
record([43], '운영 패스키 이름·등록 날짜 화면 확인', 'verification/production/run-mv93637i-d8b509/two-passkeys.png; docs/CARD-4-REPORT.md');
record([44], '운영 남은 키 200 및 실제 삭제 후 남은 키 로그인 사용자 확인', `${production}; verification/real-device-user-confirmation.json`);
record([45], '운영 가상 인증기의 삭제 키 실제 서명 401 확인', `${production}; docs/AUTH-EXPLANATION.md ④`);
record([46], '운영 가상 계정의 0개 정책·거절·화면·제출문 확인', `${production}; docs/AUTH-EXPLANATION.md ④·⑥`);
record([1], '운영 결과물 공개 200·제출 초안 입력 완료 / 실제 제출 대기', 'verification/submission-payload.json; verification/production/http-evidence.json');
record([2], '고정 소스 공개 200·제출 초안 입력 완료 / 실제 제출 대기', 'verification/submission-payload.json; verification/production/public-access.json');
record([3], '운영 결과물·고정 소스 모두 새 무로그인 컨텍스트 공개 200', 'verification/production/public-access.json');
record([10], '운영 공개 첫 화면·잠금 공간 확인 통과', `verification/production/http-evidence.json; ${production}`);
record([11], '기존 공개 원문 보존·운영 HTML 일치 확인 통과', 'scripts/check-source.mjs; contracts/profile-baseline.html; verification/production/http-evidence.json');
record([12], '새 자료 합성·비밀값 가림 확인 / 기존 공개 이름 보존 범위 명시', 'docs/AUTH-EXPLANATION.md; verification/submission-readiness.json');
record(range(36, 41), '운영 가상 계정 양방향 격리·건수 보존·소스 위치 확인', `${production}; docs/AUTH-EXPLANATION.md ③·④`);
record(range(47, 53), '설명서·확인법·실제 판단 초안 작성·대조 / 공식 제출 대기', 'docs/AUTH-EXPLANATION.md; docs/SUBMISSION.md; docs/CARD-5-REPORT.md');
let doc = await readFile('docs/CRITERIA.md', 'utf8');
const ids = [...doc.matchAll(/^\| T08-C(\d+) \|/gm)].map(match => Number(match[1]));
assert.equal(ids.length, 47);
assert.equal(decisions.size, 47);
for (const id of ids) {
  const result = decisions.get(id);
  assert.ok(result, `기준 C${id}의 확인 상태가 없습니다.`);
  const code = String(id).padStart(2, '0');
  const row = new RegExp(`^(\\| T08-C${code} \\|[^\\r\\n]*?\\|) [^|]* \\| [^|]* \\|$`, 'm');
  assert.ok(row.test(doc), `기준 C${code}의 갱신 대상 행이 없습니다.`);
  doc = doc.replace(row, `$1 ${result.status} | ${result.evidence} |`);
}
doc = doc.replace(/^- (?:초기 상태|상태 갱신|갱신 상태):[^\r\n]*/m, '- 갱신 상태: 47개 기준 모두에 실제 로컬·운영 근거 또는 미완료 사유를 연결했습니다. 가상 인증기·실제 기기·운영·공식 제출을 구분합니다. 전체 과제 통과를 뜻하지 않습니다.');
await writeFile('docs/CRITERIA.md', doc);
console.log('47개 기준의 실제 근거와 남은 검증 상태를 갱신했습니다.');
