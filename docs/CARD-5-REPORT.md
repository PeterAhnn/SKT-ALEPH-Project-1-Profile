# 카드 5 결과 — 로컬 계정 격리와 설명서·제출 준비

- 작성일: 2026-10-15 (한국 표준시)
- 공식 카드: https://aleph-omega.vercel.app/cortex?panel=tasks
- 작업: 서로 다른 가상 자료를 가진 계정 2개로 양방향 접근을 시험한 JSON을 대조했습니다. 실제 증거를 포함한 인증 설명서와 제출 준비 초안을 작성했습니다.
- 범위: 가상 WebAuthn 인증기와 로컬 서버의 자동 시험입니다. 사용자 실제 기기·운영 DB·T08 운영 배포·공식 접수·승인은 완료하지 않았습니다.

## 실제로 확인한 계정 격리 결과

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
| 내보내기 비밀값 점검 | browserExportContainsCookieValues=false, browserExportContainsPrivateKey=false입니다. 실제 저장 위치는 미확인입니다. | isolation-evidence.json·browser-export.json |

거절 소스는 server/app.mjs 27행의 currentUser와 60~68행의 비공개 조회입니다. 64행에서 타인 계정 경로를 거절하고 67행에서 서버 세션의 user.id·user.items만 반환합니다. URL의 userId·owner는 조회 대상을 선택하는 값으로 사용하지 않습니다.

화면 증거는 verification/card5/account-a.png와 account-b.png입니다. 브라우저의 실제 요청/응답 내보내기 파일은 verification/card5/browser-export.json이며, 이 문서는 파일을 읽어 기록이 있음을 확인했습니다. 사용자 실제 저장 위치를 확인한 자료로 취급하지 않습니다.

## 카드 5의 19개 기준 상태

| 기준 | 확인된 결과와 남은 일 | 근거 |
|---|---|---|
| C01 | 기존 운영 주소는 200이지만 T08 영역이 없습니다. Git 자동 미리보기는 READY이나 Vercel 로그인 보호가 있습니다. T08 운영 배포·결과물 URL 공식 제출은 미완료입니다. | SUBMISSION.md·verification/public-access.json |
| C02 | 앱 전체 커밋 90cc5592447b3dd22ed882b0600d8ee9f1632e68의 소스 URL이 새 무로그인 컨텍스트에서 200입니다. 공식 입력은 대기 중입니다. | SUBMISSION.md·verification/public-access.json의 source |
| C03 | 소스 공개 접근은 확인했습니다. 미리보기는 Vercel 로그인 페이지이며 기존 운영 결과물에는 T08 영역이 없어 모든 제출 URL 조건은 부분 완료입니다. | verification/public-access.json |
| C10 | 기존 운영 첫 화면은 무로그인 200·기존 소개입니다. T08 운영 기능은 없으며 미리보기 첫 화면은 보호 로그인 페이지입니다. | verification/public-access.json의 production·preview |
| C11 | 기존 과제 1에 이어 수정했습니다. 카드 1 보고서에서 기존 공개 원문 보존을 확인했습니다. 최종 커밋·운영 화면 대조는 남았습니다. | CARD-1-REPORT.md |
| C12 | 새 계정·비공개 자료는 가상 내용이며 기계적 비밀값 패턴 검사 findings는 없습니다. 기존 공개 이름·GitHub 링크는 사용자 승인에 따라 보존했습니다. 모든 개인정보 부재 판정은 하지 않았습니다. | isolation-evidence.json·verification/submission-readiness.json·AUTH-EXPLANATION.md ⑥ |
| C36 | 가상 인증기 시험에서 virtual-a·virtual-b 두 계정과 서로 다른 자료를 확인했습니다. 실제 기기·운영은 미확인입니다. | isolation-evidence.json의 accounts·정상 조회 |
| C37 | A→B 자료 접근은 실제 로컬 요청에서 403입니다. | isolation-evidence.json의 A에서 B로 접근 |
| C38 | B→A 자료 접근도 실제 로컬 요청에서 403입니다. | isolation-evidence.json의 B에서 A로 접근 |
| C39 | 양쪽 모두 거절 전후 3→3개로 같습니다. | isolation-evidence.json의 countsBefore·countsAfter |
| C40 | 상대 계정 값을 URL에 넣어도 본인 owner와 자료만 반환됩니다. 요청·응답을 설명서에도 포함했습니다. | isolation-evidence.json·AUTH-EXPLANATION.md ④ |
| C41 | 거절과 본인 자료 반환 소스의 실제 행 번호를 설명서에 적었습니다. | AUTH-EXPLANATION.md ③·④ |
| C47 | 공식 인증 설명서 여섯 항목을 분리했습니다. 현재 MD 첨부 초안이며 제출은 보류했습니다. | AUTH-EXPLANATION.md |
| C48 | 실제 사용한 라이브러리 이름·버전·서버 세션·저장소를 적었습니다. | AUTH-EXPLANATION.md ① |
| C49 | 등록·로그인·로그아웃·비공개 조회 네 흐름의 실제 파일·행 번호를 대조해 적었습니다. 앱 소스 커밋은 90cc5592447b3dd22ed882b0600d8ee9f1632e68로 고정했습니다. | AUTH-EXPLANATION.md ③ |
| C50 | 네 확인의 실제 성공·거절 요청/응답을 설명서에 직접 포함했습니다. 모두 로컬 자동 시험이라는 한계를 표시했습니다. | AUTH-EXPLANATION.md ④ |
| C51 | 실제 기기 미확인, MCP 403과 CLI 대체 접근 확인·배포 미완료, 마지막 키 복구 부재, 단일 상태 행 확장 한계를 적었습니다. | AUTH-EXPLANATION.md ⑥·deployment-access.json |
| C52 | 공개 심사자가 새 등록 없이 소개와 잠긴 영역을 보는 확인 4줄을 작성했습니다. 후보 운영 주소의 실제 동작 검증 전입니다. | SUBMISSION.md |
| C53 | 사용자의 실제 결정과 AI 제안 거절을 판단 3줄로 적었습니다. | SUBMISSION.md·AUTH-EXPLANATION.md ⑤ |

문서에 증거가 연결된 것은 공식 제출 완료와 다릅니다. 특히 C01·C02의 “제출되어 있다”는 상태는 아직 충족하지 않았습니다.

## 남긴 문서와 증거

- docs/AUTH-EXPLANATION.md: 등록 질문 2개·로그인 질문 2개·저장 공개키 실제 값·등록 본문·네 확인의 성공/거절 기록·소스 위치·한계를 포함한 단일 MD 설명서입니다.
- docs/SUBMISSION.md: T08 운영 반영 전의 후보 결과물 주소와 공개 200을 확인한 전체 커밋 소스 URL, 확인 4줄·실제 판단 3줄, 접수 조건·완주 기준 구분을 담은 제출 준비 초안입니다.
- verification/card5/isolation-evidence.json: 계정 2개·양방향 403·자료 건수·URL 계정 값 변경의 실제 자동 시험 기록입니다.
- verification/card5/account-a.png·account-b.png·browser-export.json: 계정 화면과 브라우저 요청/응답 기록입니다.
- verification/deployment-access.json: 기존 Vercel MCP 관리 읽기의 403과 공식 CLI의 프로젝트 읽기 200을 구분한 기록입니다. 앱의 계정 격리 403과 별개입니다. manualDeploymentExecuted=false와 automaticGitPreview의 READY·공개 보호·productionT08Deployed=false를 구분합니다.
- verification/public-access.json: 새 무로그인 컨텍스트에서 소스 전체 커밋 200, Git 미리보기의 Vercel 로그인 보호, 기존 운영 주소의 기존 소개 200·T08 영역 부재를 확인한 기록입니다. 미리보기 /api/session도 로그인 페이지이며 앱 503을 관찰하지 않았습니다.
- verification/submission-readiness.json: 설명서 형식·문안 길이·MD 한 파일 크기·기계적 비밀값 패턴 검사입니다. 전체 개인정보 부재·실제 기기·운영·공식 제출 완료 판정이 아닙니다.

## 미완료와 제출 조건

실제 사용자 기기의 패스키 저장 위치·등록 취소·두 키 사용은 미확인입니다. 앱 소스 전체 커밋과 그 URL의 공개 200 접근은 확인했습니다. Git 자동 미리보기는 READY이나 Vercel 로그인 보호가 있고, 기존 운영 주소에는 T08 영역이 없습니다. DB SQL 사용자 승인·전용 역할 적용·연결, 전용 환경 변수, T08 운영 배포·결과물 공개 접근, 전체 개인정보 검토, 공식 접수·승인은 남아 있습니다. SQL 승인 답변은 아직 없습니다.

현재 제출 화면은 공개 결과물 URL 또는 PDF·DOCX·MD·TXT 보고서 한 파일 중 하나를 접수 필수 근거로 요구합니다. 파일을 택해 접수할 수 있더라도 완주 기준 C01·C02의 결과물·소스 HTTPS URL을 각각 제출해야 한다는 기준은 별도로 추적합니다. 최대 파일 수 10개·합계 8MB 등은 최종 업로드 직전에 다시 점검합니다.

상태: 카드 5의 로컬 계정 격리 기록 대조와 설명서·제출 초안 작성을 마쳤습니다. 47개 기준 전체 완주·운영 검증·제출·승인 완료로 표시하지 않습니다.
