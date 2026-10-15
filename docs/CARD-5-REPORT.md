# 카드 5 결과 — 로컬·운영 검증·공식 접수 완료

- 갱신일: 2026-10-15 (한국 표준시)
- 공식 카드: https://aleph-omega.vercel.app/cortex?panel=tasks
- 운영 결과물: https://skt-aleph-project-1.vercel.app/ 입니다.
- 운영 배포: 653f9057cb63e5223b37b474f6f1fe1ceb61284c, dpl_HhDtMFtzJxQkicx29G4FXZNYdomd·READY입니다. 앱 코드는 최초 구현 90cc와 같습니다.
- 범위: 최초 로컬 원본과 실제 운영 HTTPS 서버의 가상 인증기 자동 시험을 구분합니다. 사용자의 저장 위치·로그인·두 키 등록·삭제 후 사용은 직접 응답으로 확인했습니다. 두 URL·확인 4줄·판단 3줄·동결 MD 한 파일을 실제 제출해 접수를 완료했습니다. 현재 강사 승인 대기이며 실제 기기 취소·일부 실패 동작·강사/마스터 승인·후행 채점은 별도 미확인입니다.

## 최초 로컬 계정 격리 원본 기록

근거는 verification/card5/isolation-evidence.json입니다. 시험 시각은 2026-10-15T04:22:28.26Z입니다.

| 요청·비교 | 실제 결과 | 증거 위치 |
|---|---|---|
| A의 본인 자료 GET /api/private/items | 200, owner=5a4a48bd-cbc6-45ac-afb4-140548cfe031, 가상 항목 3개입니다. | records의 A의 정상 조회 |
| B의 본인 자료 GET /api/private/items | 200, owner=0f8418db-32ab-4fcd-a4fc-516e3e69dc8b, 가상 항목 3개입니다. | records의 B의 정상 조회 |
| A→B 타인 경로 | GET /api/private/accounts/0f8418db-32ab-4fcd-a4fc-516e3e69dc8b/items는 403입니다. 본문은 “다른 계정의 비공개 자료는 볼 수 없습니다.”입니다. | records의 A에서 B로 접근 |
| B→A 타인 경로 | GET /api/private/accounts/5a4a48bd-cbc6-45ac-afb4-140548cfe031/items는 403입니다. 같은 거절 본문입니다. | records의 B에서 A로 접근 |
| 거절 전후 자료 건수 | A는 3→3개, B는 3→3개로 같습니다. | countsBefore·countsAfter |
| A가 URL에 B의 userId·owner를 지정 | 200이지만 owner는 A이고 A의 자료 3개만 돌아왔습니다. | records의 A가 주소에 B를 지정 |
| B가 URL에 A의 userId·owner를 지정 | 200이지만 owner는 B이고 B의 자료 3개만 돌아왔습니다. | records의 B가 주소에 A를 지정 |
| 내보내기 비밀값 점검 | browserExportContainsCookieValues=false, browserExportContainsPrivateKey=false입니다. 당시 로컬 시험에서는 사용자 실제 저장 위치를 확인하지 않았습니다. 이후 사용자 직접 확인은 별도로 기록합니다. | isolation-evidence.json·browser-export.json |

거절 소스는 server/app.mjs 27행의 currentUser와 60~68행의 비공개 조회입니다. 64행에서 타인 계정 경로를 거절하고 67행에서 서버 세션의 user.id·user.items만 반환합니다. URL의 userId·owner는 조회 대상을 선택하는 값으로 사용하지 않습니다.

화면 증거는 verification/card5/account-a.png와 account-b.png입니다. 브라우저의 실제 요청/응답 내보내기 파일은 verification/card5/browser-export.json이며, 이 문서는 파일을 읽어 기록이 있음을 확인했습니다. 사용자 실제 저장 위치를 확인한 자료로 취급하지 않습니다.


## 운영 추가 검증

근거는 verification/production/deployment.json·http-evidence.json과 verification/production/run-mv93637i-d8b509/production-evidence.json입니다. 운영 시험은 서버 자료·세션을 주입하지 않았고 실제 가상 인증기 서명으로 수행했습니다. 요청/응답 80건과 화면 8개를 남겼습니다.

| 운영 확인 | 실제 결과 |
|---|---|
| 공개 소개·잠금 | 공개 200·index.html 원문 일치·잠금 경계·비로그인 HTML의 비공개 자료 없음입니다. |
| 비로그인 비공개 API | 401입니다. |
| 비밀 파일·서버 소스 경로 | /.env, /server/auth.mjs, /verification/private/runtime-credentials.json은 각각 404입니다. |
| 등록·로그인 새 질문 | 각각 실제 다른 값 2개이며 설명서에 직접 추가했습니다. |
| 한 계정 패스키 2개 | 공개키·이름·등록일이 있는 독립 가상 키 2개를 확인했습니다. |
| 로그인 | 정상 200·변조 서명 401·타인 키 401·성공 질문 재사용 400입니다. |
| 계정 격리 | A→B·B→A 모두 403, 각 자료 건수 3→3개, URL의 상대 계정값 지정에도 본인 자료만 반환했습니다. |
| 로그아웃 | 구 쿠키 재사용 401이며 HttpOnly·Secure·SameSite=Strict입니다. |
| 삭제 후 로그인 | 삭제 키 401·남은 키 200·0개 상태 로그인 401·익명 재등록 409·구 세션 401입니다. |
| 시험 종료 상태 | 이번 실행의 A·B 가상 키는 모두 삭제했고 합성 계정·자료만 남깁니다. |

## 카드 5의 19개 기준 상태

| 기준 | 현재 확인 결과와 남은 일 | 근거 |
|---|---|---|
| C01 | 운영 결과물 HTTPS URL을 실제 제출하고 접수를 확인했습니다. | verification/platform-submission.json |
| C02 | 653f 전체 소스 URL을 공개 200으로 확인한 뒤 실제 제출하고 접수를 확인했습니다. | verification/platform-submission.json·production/public-access.json |
| C03 | 운영 결과물과 최신 소스 653f 모두 초기 쿠키 0·무로그인 200을 확인했습니다. 보호된 초기 미리보기는 과거 관찰입니다. | http-evidence.json·verification/production/public-access.json |
| C10 | 누구나 등록 없이 기존 공개 소개·잠금 영역을 봅니다. | production-evidence.json의 checks.public |
| C11 | 기존 과제 1을 수정했고 공개 원문 보존·운영 원문 일치를 확인했습니다. | scripts/check-source.mjs·http-evidence.json |
| C12 | 새 계정·자료는 합성이고 비밀값을 가렸습니다. 기존 공개 이름·GitHub 링크는 사용자 승인 보존이며 전체 개인정보 부재를 자동 판정하지 않았습니다. | AUTH-EXPLANATION.md ⑥·submission-readiness.json |
| C36 | 운영에서 가상 패스키 계정 2개·서로 다른 자료 각 3개를 확인했습니다. 사용자의 실제 저장 위치·두 키 사용은 별도 직접 응답으로 확인했습니다. | checks.registration·isolation |
| C37 | 운영 A→B 자료 조회 403입니다. | records의 A에서 B 자료 접근 거절 |
| C38 | 운영 B→A 자료 조회 403입니다. | records의 B에서 A 자료 접근 거절 |
| C39 | 운영 양쪽 자료 건수가 거절 전후 각각 3→3개입니다. | checks.isolation.countsBefore·countsAfter |
| C40 | 상대 userId·owner를 URL에 넣어도 서버 세션 본인 자료만 200입니다. | records의 주소 계정 지정 요청 |
| C41 | 거절 소스 위치를 실제 파일·행 번호로 설명서에 연결했습니다. | AUTH-EXPLANATION.md ③·④ |
| C47 | 공식 6항목의 단독 MD 설명서를 작성하고 운영 실제 값을 추가했습니다. | AUTH-EXPLANATION.md |
| C48 | 실제 구현 방식·라이브러리·버전·세션·저장소를 적었습니다. | 설명서 ① |
| C49 | 등록·로그인·로그아웃·비공개 조회 네 흐름을 실제 소스로 연결했습니다. | 설명서 ③ |
| C50 | 로컬 원본과 운영의 네 확인 성공·거절 요청/응답을 직접 포함했습니다. 실제 사용자 기기 시험과 구분했습니다. | 설명서 ④·production-evidence.json |
| C51 | 실제 기기 일부 실패 동작 미확인·시험 합성 자료 잔존·마지막 키 복구 부재·단일 행의 확장 한계 등을 구체적으로 적었습니다. | 설명서 ⑥ |
| C52 | 공개 심사자가 새 등록 없이 소개·잠금을 보는 확인 4줄을 작성했습니다. | SUBMISSION.md |
| C53 | 사용자의 실제 기존 프로젝트 선택·공개 보존·카드 순서·47개 전수 검증·제출 조건 판단을 3줄로 적었습니다. | SUBMISSION.md·설명서 ⑤ |

## 근거와 상태 구분

- 최초 로컬 자료는 verification/card1~card5와 앞의 원본 표에 보존했습니다. 이전 질문·키·시각을 최신 운영 값으로 덮어쓰지 않았습니다.
- 승인·DB SQL·전용 역할·공식 CA/호스트·PgStore 지속 저장·롤백·권한 거절은 verification/db-setup.json·db-runtime.json과 DB-SETUP-PROPOSAL.md에 있습니다.
- 최신 운영의 실제 요청 80건·화면 8개는 verification/production/run-mv93637i-d8b509/에 있습니다.
- 초기 verification/public-access.json의 보호 preview·과거 운영은 당시 관찰이며 최신 운영 판정에는 production 증거를 사용합니다. 승격 전 CLI 302도 앱 응답이 아니었습니다.
- AUTH-EXPLANATION.md는 실제 운영 질문·공개키·등록 본문·성공/거절을 직접 읽을 수 있는 단독 MD입니다.
- C01·C02의 두 URL을 실제 제출했습니다. 업로드·접수 완료와 강사 승인 대기는 verification/platform-submission.json에서 확인했습니다. 승인·후행 채점과 구분합니다.

## 남은 일

사용자는 구글 비밀번호 관리자·로그인·패스키 2개 등록→1개 삭제→남은 키 성공을 직접 확인했습니다. 실제 기기 취소·삭제 키 서명 거절·0개 정책에 대한 사용자 직접 확인은 없습니다. 근거는 verification/real-device-user-confirmation.json입니다. 실제 제출·접수는 완료했고 강사 승인 대기입니다. 강사/마스터 승인·후행 채점은 별도로 확인해야 합니다. **운영 자동 시험 통과를 공식 47개 전체 통과로 표시하지 않습니다.**

접수 화면의 공개 결과물 URL 또는 PDF·DOCX·MD·TXT 보고서 한 파일 조건과 C01·C02의 결과물·소스 URL 두 개 완주 기준은 구분합니다. 이번 제출은 52,543바이트 MD 한 파일과 제한 이내 문안으로 접수했습니다.


## 공식 접수와 후속 Git 운영 동기화

사용자가 경고를 확인하고 이 문안의 제출을 승인했습니다. 제출 버튼을 한 번 눌러 파일 업로드와 “T08 제출을 마쳤습니다”를 확인했고, 후속 화면에서 강사 승인 대기를 확인했습니다. 제출 내용은 URL 두 개·확인 4줄 365자·판단 3줄 338자·T08-AUTH-EXPLANATION-FINAL.md 한 파일입니다. 근거는 verification/platform-submission.json입니다.

main과 t08-passkey는 빠른 앞으로 병합을 통해 02077c4eb8096119ecb9d06072900ffcdf1a1f3c로 동기화됐습니다. 강제 push 없이 생성된 Git 운영 배포 dpl_6RUgTKmUAEamY6tfMCoSqVgYcgXW의 READY·별칭·동일 앱 200·세션 200·비공개 401을 확인했습니다. 근거는 verification/production/main-rollout.json이며 제출 소스는 653f로 유지합니다.

동결 AUTH·FINAL 파일의 접수 전 문구는 작성 시점 기록으로 남깁니다. C12 전체 개인정보 부재와 실제 기기 취소 등 남은 미확인을 접수 사실만으로 통과 처리하지 않습니다. 마스터 승인과 후행 채점도 미확인입니다.
