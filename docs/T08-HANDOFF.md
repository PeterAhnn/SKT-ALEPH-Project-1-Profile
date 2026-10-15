# T08 이어서 진행할 위치 — 접수 완료·강사 승인 대기

## 승인 범위와 기준점

기존 과제 1 프로젝트를 직접 수정하고 공개 소개를 유지합니다. 카드 1~5 순서·기준 47개 누락 없는 검증·단계별 증거·제출 조건 점검이 승인 범위입니다.

저장소는 PeterAhnn/SKT-ALEPH-Project-1-Profile, 브랜치는 t08-passkey입니다. 기존 공개 기준은 1cde218ce6381c549d5f127d15083c9b6b16f0ce입니다. 이후 main을 빠른 앞으로 병합해 원격 main과 t08-passkey를 02077c4eb8096119ecb9d06072900ffcdf1a1f3c로 동기화했습니다. 강제 push는 하지 않았습니다. 최초 앱 구현 90cc와 운영 배포 653f9057cb63e5223b37b474f6f1fe1ceb61284c의 앱 코드는 같습니다. 사용자 SKT-ALEPH-project-guide (1).md는 수정하거나 커밋하지 않습니다.

## 현재 완료

- 카드 1~5 로컬 HTTP·가상 인증기·회귀 38개·공개 원문/47개 기준 원문 대조·빌드가 통과했습니다. 기존 원본은 verification/card1~card5에 보존했습니다.
- 사용자가 승인한 DB SQL·t08 전용 역할 LOGIN·RLS·최소 권한·공식 CA/호스트 검증·별도 PgStore 풀의 지속 저장·롤백·권한 거절을 검증했습니다. T07 기존 테이블 7개의 건수는 전후 같습니다.
- 운영 서버 전용 T08_DATABASE_URL·T08_DATABASE_CA·T08_ORIGIN을 구성했습니다. 실제 비밀값은 공개하지 않았습니다.
- 운영 배포는 dpl_HhDtMFtzJxQkicx29G4FXZNYdomd·READY, 소스 653f입니다. 공개 별칭 https://skt-aleph-project-1.vercel.app/ 에 연결했습니다.
- 운영 HTTPS 가상 인증기 시험 요청 80건·화면 8개가 통과했습니다. 서버 상태·세션을 직접 주입하지 않았습니다. 가상 계정 A/B의 패스키는 모두 삭제했고 합성 자료만 남습니다.
- 초기 쿠키가 0개인 별도 컨텍스트에서 운영과 https://github.com/PeterAhnn/SKT-ALEPH-Project-1-Profile/commit/653f9057cb63e5223b37b474f6f1fe1ceb61284c 의 공개 200을 확인했습니다. 소개 원문 보존·잠금·입력란 0개·세션 조회 200·비공개 조회 401과 비공개 경로 13개가 반환한 404 응답도 확인했습니다.
- 사용자가 경고를 확인하고 제출을 승인한 뒤 두 URL·확인 4줄·판단 3줄·T08-AUTH-EXPLANATION-FINAL.md 한 파일을 실제 제출했습니다. 업로드와 “T08 제출을 마쳤습니다”를 확인했고 현재는 강사 승인 대기입니다.

## 근거 위치

- DB: verification/db-setup.json·db-runtime.json, docs/DB-SETUP-PROPOSAL.md입니다.
- 운영 배포/HTTP: verification/production/deployment.json·http-evidence.json입니다.
- 운영 서명/격리/삭제: verification/production/run-mv93637i-d8b509/production-evidence.json과 같은 폴더의 화면 8개입니다.
- 별도 공개 읽기: verification/production/public-access.json·public-and-locked.png·locked-boundary.png입니다.
- 문서/패턴/용량 검사: scripts/check-evidence.mjs·verification/submission-readiness.json입니다. 전체 개인정보 부재나 실제 기기/공식 처리를 자동 판정하지 않습니다.

## 남은 일

1. 사용자는 구글 비밀번호 관리자 로그인과 패스키 2개 등록→1개 삭제→남은 키 로그인 성공을 직접 확인했습니다. verification/real-device-user-confirmation.json에 정확한 응답을 보존했습니다. AI 직접 관찰이나 자동 시험으로 바꾸지 않습니다. 실제 기기 취소·삭제 키 실패·0개 정책의 사용자 직접 확인은 없으며 REAL-DEVICE-CHECK.md에서 구분합니다.
2. 실제 기기 기록을 검토·비밀값 가림 처리한 뒤 가상 인증기 기록과 분리해 보관해야 합니다. 심사자는 이 절차를 수행하지 않고 공개 소개까지만 봅니다.
3. 실제 제출과 접수는 완료했습니다. 과제 탭의 강사 승인 대기 화면을 보존합니다. 강사·마스터 승인과 후행 채점은 확인하지 않았으며 접수 완료를 승인 완료로 표시하지 않습니다.
4. C12는 기존 공개 이름·GitHub 링크의 승인에 따른 보존과 새 합성 자료·가린 비밀값 검사를 구분합니다. 모든 개인정보가 없다고 자동 판정하지 않습니다.

## 로컬 비공개 파일 보관 상태

verification/private/에는 runtime-credentials.json, production-runtime.env, server-verifier.json의 임시 비공개 파일 3개가 남아 있습니다. 실제 비밀값·기기 호스트명·인증 검증 값은 이 문서나 공개 기록에 쓰지 않습니다.

자동 승인 검토가 삭제 명령을 차단하여 **삭제 완료가 아닙니다.** 구체적인 차단 사유는 제공되지 않았습니다. 파일을 삭제하지 않은 상태에서 ACL 상속을 제거하고 Administrator·SYSTEM만 읽도록 제한했습니다. 세 파일은 Git·배포 제외 대상입니다. 이 보관 상태를 비밀값이 로컬에 전혀 없다는 뜻으로 표현하지 않습니다.

실제 기기 기록도 verification/private/에 먼저 보관하고 검토·가림 없이 공개 커밋에 넣지 않습니다.

## 실행과 반복 시험 주의

npm start로 http://localhost:8008에서 로컬 확인을 시작합니다. 실제 PIN·생체인증·패스키 저장 선택은 사용자가 직접 수행합니다. 운영 URL의 화면에서 저장 위치를 직접 선택해 이 탭의 요청/응답을 내려받을 수 있으며 새로고침하면 탭 기록은 초기화됩니다.

capture-card2~card5는 최초 증거를 새 난수로 덮어쓰므로 임의로 재실행하지 않습니다. 운영 시험도 별도 실행 폴더로 분리하고 설명서 인용과 대조합니다. scripts/update-criteria.mjs는 실제 진척에 따라 갱신하고 scripts/check-evidence.mjs는 상태 검사 JSON을 갱신한다는 점을 구분합니다.

과거 상태: Vercel MCP 403·CLI 대체 읽기 200·보호된 Git 미리보기·승격 전 CLI 302가 있었습니다. 이후 승인된 DB 구성과 운영 승격/공개 검증을 완료했습니다. 과거 차단·302를 현재 운영 미완료로 일반화하지 않습니다. 사용자 실제 기기는 위 일부 흐름을 직접 확인했고, 공식 접수는 완료했고 강사 승인 대기입니다. 공식 47개 전체 통과 판정·강사/마스터 승인·후행 채점은 확인하지 않았습니다.

## 제출 직전 초안 기록과 접수 완료

- 두 URL·확인 4줄(365자)·판단 3줄(338자)·MD 한 파일 선택을 실제 화면에서 확인했습니다. 첨부는 T08-AUTH-EXPLANATION-FINAL.md 52,543바이트이며 SHA-256은 verification/submission-payload.json에 있습니다.
- 공개 URL과 보고서 파일을 함께 선택하여 정확히 하나를 권장한다는 경고가 표시됐습니다. 화면은 현재 상태로도 접수된다고 안내합니다. C01·C02의 URL과 설명서 여섯 항목을 함께 준비한 상태입니다.
- 위 선택·경고 문구는 제출 직전 기록입니다. 사용자가 “경고를 확인했고, 이 초안으로 제출해 주세요.”라고 승인한 뒤 버튼을 한 번 눌렀고 업로드와 접수를 완료했습니다. 현재 상태는 verification/platform-submission.json의 강사 승인 대기입니다.


## 최종 제출물과 후속 운영 배포

제출한 문안은 확인 4줄 365자·판단 3줄 338자입니다. 제출 파일 T08-AUTH-EXPLANATION-FINAL.md는 52,543바이트이고 SHA-256은 958349eb7843230c30ff71266c25abc968ad5ed5b4fba4364d51b91942fdeb8a입니다. 작성 원본 AUTH-EXPLANATION.md와 FINAL 두 파일은 선택 전 동결본이며 업로드 후 수정하지 않습니다. 파일 안의 접수 전 문구는 작성 시점 기록입니다.

후속 Git 운영 배포는 dpl_6RUgTKmUAEamY6tfMCoSqVgYcgXW·READY이며 공개 별칭에 연결됐습니다. verification/production/main-rollout.json에서 동일 HTML 200·세션 조회 200·비공개 조회 401을 재확인했습니다. 제출 소스 URL은 653f 동결 앱 소스로 유지하고 후속 main의 앱 코드도 같습니다.

verification/platform-submission.json의 “T08 제출을 마쳤습니다”, “강사 승인 대기”, “과제를 제출했습니다. 강사 승인을 기다려 주세요.”가 현재 공식 상태입니다. 현재 승인 대기 탭을 보존하며 같은 제출을 반복하지 않습니다.
