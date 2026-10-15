# T08 이어서 진행할 위치

## 승인 범위와 작업 대상

사용자는 기존 과제 1 프로젝트를 직접 이어 수정하고 공개 내용은 보존하도록 승인했습니다. 카드 1~5 순서와 통과 기준 47개·단계별 증거 보고·제출 요구사항 점검이 최우선입니다.

기존 저장소는 PeterAhnn/SKT-ALEPH-Project-1-Profile이고 작업 브랜치는 t08-passkey입니다. 기존 공개 기준 커밋은 1cde218ce6381c549d5f127d15083c9b6b16f0ce입니다. **현재 앱 코드 기준은 90cc5592447b3dd22ed882b0600d8ee9f1632e68로 고정했습니다.** 사용자 파일 SKT-ALEPH-project-guide (1).md는 수정하거나 커밋하지 않습니다.

## 현재까지 실제 수행

- 카드 1~5의 구현과 로컬 HTTP·가상 WebAuthn 인증기 시험을 수행했습니다. 카드별 보고서와 verification/card1~card5에 실제 증거가 있습니다.
- npm test 38개, npm run check의 기존 공개 원문·공식 기준 47개 보존, npm run build가 통과했습니다. IMPLEMENTATION-REVIEW.md에 수정·독립 재검증 기록이 있습니다.
- AUTH-EXPLANATION.md는 공식 여섯 항목과 실제 요청·응답 JSON 12개를 포함한 약 35KB MD 첨부 초안입니다. SUBMISSION.md의 확인 4줄·판단 3줄은 길이 제한에 들어갑니다.
- scripts/check-evidence.mjs의 verification/submission-readiness.json은 기계적 비밀값 패턴 findings=[]·설명서 형식·문안 길이·첨부 한 파일 용량을 기록합니다. 전체 개인정보 부재나 운영·실기·공식 제출 완료를 판정하지 않습니다.
- 실제 고정 소스 URL은 https://github.com/PeterAhnn/SKT-ALEPH-Project-1-Profile/commit/90cc5592447b3dd22ed882b0600d8ee9f1632e68 입니다. 새 무로그인 Playwright 컨텍스트에서 200·GitHub 커밋 화면을 확인했습니다. 공식 소스 URL 입력은 대기 중입니다.

## 미리보기와 운영 상태

Vercel MCP는 해당 팀에서 403이지만 공식 CLI 64.2.0의 기존 자격으로 프로젝트·팀·Git 연결·공개 도메인을 확인했습니다. 재연결이 필수이거나 모든 배포 권한이 차단되었다고 단정하지 않습니다. 근거는 verification/deployment-access.json입니다.

상위 CLI 확인으로 Git 자동 미리보기는 READY이고 앱 커밋 90cc5592447b3dd22ed882b0600d8ee9f1632e68과 일치합니다. 미리보기는 https://skt-aleph-project-1-profile-cq6we4559-peter-ahns-projects.vercel.app/ 입니다. 새 무로그인 브라우저에서 첫 화면과 /api/session 모두 Vercel 로그인 페이지로 이동했습니다. **앱의 503을 관찰한 결과가 아니며 공개 심사 URL로 제출할 수 없습니다.** 로그인을 하거나 배포 보호를 우회하지 않았습니다.

기존 운영 주소 https://skt-aleph-project-1.vercel.app/ 는 200으로 기존 과제 1 소개가 열리고 T08 공간·등록 기능은 없습니다. T08 운영 배포는 하지 않았으며 기존 운영을 변경하지 않았습니다. 공개 접근의 실제 관찰은 verification/public-access.json과 public-access-preview.png·public-access-production.png에 있습니다.

대상 프로젝트는 skt-aleph-project-1-profile, team은 peter-ahns-projects, production branch는 main입니다. Git 자동 미리보기 READY·운영 미배포·공개 접근·앱 기능 검증을 각각 구분합니다.

## 남은 일

1. DB-SETUP-PROPOSAL.md의 SQL은 사용자 승인 대기입니다. 아직 DB 스키마·전용 역할·로그인 비밀값·운영 자료를 만들지 않았습니다. 답변 없이 실행하지 않습니다.
2. 승인 후 전용 역할·운영 DB 연결·전용 환경 변수를 구성하고 실제 T08 운영 배포를 검증해야 합니다. 운영 설정이 없으면 비공개 API가 503으로 실패하도록 구현했지만, 현재 보호된 미리보기에서는 이 앱 응답을 관찰하지 못했습니다.
3. 사용자 실제 기기에서 등록·취소·저장 위치·독립 패스키 2개·삭제 후 남은 키 로그인·삭제 키 거절을 확인해야 합니다. 가상 인증기 시험을 실제 기기 사용으로 표시하지 않습니다.
4. T08 운영 결과물 주소를 새 무로그인 브라우저에서 확인해야 합니다. 소스 공개 200만 완료되었으므로 C03의 모든 제출 URL 조건은 부분 완료입니다.
5. C12는 기존 공개 이름·GitHub 링크의 사용자 승인 보존과 신규 합성 자료·비밀값 가림 검사를 구분해야 합니다. 기계적 패턴 검사 통과만으로 모든 개인정보 부재라고 쓰지 않습니다.
6. 공식 결과물·소스 URL 입력과 첨부 업로드·접수는 하지 않았습니다. 접수와 강사·마스터 승인도 미확인입니다. 현재 접수 조건은 공개 URL 또는 PDF·DOCX·MD·TXT 보고서 한 파일이며, 카드 완주 조건의 URL 두 개와 구분합니다.

## 실행과 증거 보관

npm start로 http://localhost:8008에서 확인합니다. 실제 PIN·생체인증·패스키 저장 선택은 사용자가 직접 수행합니다. 화면의 과제 확인 기록 보관에서 저장 위치를 직접 선택하고 이 탭의 요청·응답을 내려받을 수 있습니다. 쿠키와 개인키는 기록하지 않습니다. 새로고침하면 탭 기록은 초기화됩니다.

실제 기기 기록은 verification/private/에 먼저 보관합니다. 검토·비밀값 가림 없이 공개 커밋에 넣지 않습니다. 실제 연락처·신분증 번호·새로운 실제 개인정보를 넣지 않습니다. 기존 공개 이름·GitHub 링크는 사용자 승인에 따라 보존하며 이 범위를 설명서에 기록합니다.

## 반복 실행 주의

capture-card2~card5 스크립트는 증거 JSON을 새 난수로 덮어씁니다. AUTH-EXPLANATION.md에 원본 요청을 직접 복사했으므로 **현재 원본 증거를 임의로 다시 생성하지 않습니다.** 새 시험을 수행할 필요가 있으면 기록을 분리하고 설명서 인용과 대조합니다. 공식 원문과 CRITERIA.md의 47개 기준은 삭제하거나 요약으로 바꾸지 않습니다.

scripts/update-criteria.mjs는 검증 완료를 자동 추정하는 도구가 아니라 현재 확인 결과를 기록한 상태 갱신 스크립트입니다. 운영·실기·제출 진척이 생기면 결정 기록도 함께 갱신합니다. scripts/check-evidence.mjs는 submission-readiness.json의 시각·용량·길이 값을 갱신하므로 원본 증거 보존 범위와 상태 기록 갱신을 구분합니다.

최신 문서 상태 갱신은 앱 코드 변경이 아닙니다. 실제 앱은 위 90cc 커밋을 기준으로 비교합니다.
