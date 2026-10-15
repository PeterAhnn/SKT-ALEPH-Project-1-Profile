# T08 제출 준비 점검표

- 갱신일: 2026-10-15 (한국 표준시)
- 공식 과제·제출 화면: https://aleph-omega.vercel.app/cortex?panel=tasks
- 앱 소스 커밋: 90cc5592447b3dd22ed882b0600d8ee9f1632e68입니다.
- 확인 근거: 공식 원문·기준표, 카드 1~5 로컬 증거, IMPLEMENTATION-REVIEW.md의 38개 시험 통과 기록, verification/submission-readiness.json, verification/public-access.json입니다.
- 체크 원칙: 준비·문서·로컬 자동 시험과 실제 기기·운영·공식 입력·접수·승인을 구분합니다. 체크된 준비 항목도 47개 전체 완주를 뜻하지 않습니다.

## 접수 조건과 URL 준비

- [x] 최신 사용자 제공 접수 문구를 보존했습니다. **공개 결과물 URL 또는 PDF·DOCX·MD·TXT 보고서 한 파일 중 하나**가 접수 필수 조건입니다. 카드 C01·C02의 URL 두 개 완주 기준과 구분했습니다. 근거: TASK-SOURCE.md·SUBMISSION.md입니다.
- [x] 소스는 실제 고정 전체 커밋 URL로 준비했습니다. https://github.com/PeterAhnn/SKT-ALEPH-Project-1-Profile/commit/90cc5592447b3dd22ed882b0600d8ee9f1632e68 이며 소문자 전체 40자리 해시입니다.
- [x] 소스 URL을 새 무로그인 Playwright Chromium 컨텍스트에서 GET 200으로 확인했습니다. 초기 쿠키 0개·로그인 없음·우회 없음입니다. 근거: verification/public-access.json의 source입니다.
- [ ] C01에 맞게 T08 공개 HTTPS 결과물 URL 한 개를 실제 결과물 필드에 제출해야 합니다. 기존 운영은 공개 200이나 T08 영역이 없습니다.
- [ ] C02에 맞게 고정 소스 URL을 실제 소스 필드에 입력·제출해야 합니다. 주소 준비·공개 200 확인은 완료했지만 공식 입력은 대기 중입니다.
- [ ] **모든 제출 URL**의 무로그인 접근과 T08 결과물 동작을 확인해야 합니다. 소스만 완료했습니다. Git 미리보기는 READY지만 Vercel 로그인 페이지이며 기존 운영은 과제 1 소개만 있습니다. 부분 완료 근거: verification/public-access.json입니다.
- [ ] 최종 업로드 직전 실제 제출 화면의 형식·파일 수·용량·경고를 다시 확인해야 합니다.

## 실제 시험과 기준 대조

- [x] 실제로 수행한 서버·저장소·인증 회귀시험 38개 통과 기록을 확인했습니다. 근거: IMPLEMENTATION-REVIEW.md·T08-HANDOFF.md와 tests/입니다. 이는 실제 사용자 기기 38회 시험이라는 뜻이 아닙니다.
- [x] 공식 기준 47개와 CRITERIA.md의 ID·원문이 일치하는 것을 대조했습니다. 근거: scripts/check-source.mjs의 npm run check입니다. 모든 기준의 운영·실기·공식 제출까지 통과했다는 뜻은 아닙니다.
- [x] 기존 공개 소개 원문 보존·비밀번호 입력란 부재를 검사했습니다. 근거: scripts/check-source.mjs·contracts/profile-baseline.html입니다.
- [x] 가상 인증기 자동 시험과 실제 기기 시험을 구분했습니다. 카드 1~5 보고서와 설명서에 실제 저장 위치·기기 취소·운영 결과가 미확인임을 표시했습니다.
- [ ] 사용자 실제 기기에서 등록·취소·저장 위치·독립 패스키 두 개·삭제 후 남은 키 성공과 삭제 키 거절을 확인해야 합니다.

## 설명서와 확인·판단 문안

- [x] AUTH-EXPLANATION.md에 공식 여섯 항목을 분리했습니다: ① 무엇으로 붙였나, ② 왜 그걸 골랐나, ③ 어디를 어떻게 고쳤나, ④ 안 열리는 것을 확인한 기록, ⑤ AI와 나, ⑥ 아직 못 막은 것.
- [x] 사용 기술과 등록·로그인·로그아웃·비공개 조회의 실제 파일·행 번호를 적었습니다. 앱 코드 기준은 90cc5592447b3dd22ed882b0600d8ee9f1632e68입니다.
- [x] 등록 질문 2개·로그인 질문 2개·저장 공개키·공개키 설명·등록 요청 본문을 직접 포함했습니다. 설명서의 원본 JSON 코드 블록 12개는 모두 파싱했습니다. 근거: AUTH-EXPLANATION.md·verification/submission-readiness.json입니다.
- [x] 네 확인의 실제 성공·거절 요청과 응답을 설명서에 연결했습니다. 비로그인 조회·양방향 타인 자료·질문 재사용·패스키 삭제 후 로그인이며 로컬 자동 시험으로 표시했습니다.
- [x] 실제 남은 한계를 최소 하나 구체적으로 적었습니다. 실제 기기 미확인, 운영 구성·배포 미완료, 마지막 키 복구 부재, 단일 상태 행의 확장 한계가 있습니다.
- [x] 확인 4줄과 판단 3줄을 각각 1,500자 이내로 작성했습니다. verification/submission-readiness.json의 마지막 기록은 457자·342자입니다. 이번 상태 갱신 후 길이를 다시 검사하며, 운영 배포 후 확인 방법의 실제 동작은 별도로 검증해야 합니다.
- [x] 사용자 판단은 기존 과제 1 직접 수정·공개 유지·카드 순서·47개 전수 검증·제출 조건 확인이라는 실제 승인과 별도 저장소 제안 거절로 작성했습니다.

## 파일·개인정보·비밀값

- [x] 첨부 후보는 AUTH-EXPLANATION.md 한 파일이며 약 35KB로 8MB 이하입니다. 최대 10개·합계 8MB에 들어갑니다. 근거: verification/submission-readiness.json의 proposedAttachmentCount=1·proposedAttachmentWithinLimit=true와 실제 파일입니다. 실제 업로드는 하지 않았습니다.
- [x] 설명서 MD는 빈 파일이 아니고 파일명은 255자 이하입니다. 선택 화면 증거를 별도 필수 첨부물로 추가하지 않았습니다.
- [x] 새 시험 계정과 비공개 자료를 합성 내용으로 표시하고 기록의 Cookie·Set-Cookie는 [가림]으로 보존했습니다. 실제 개인키·DB 접속 비밀값·Bearer·가리지 않은 쿠키의 **기계적 패턴 검사**는 findings=[]입니다. 근거: scripts/check-evidence.mjs·verification/submission-readiness.json입니다.
- [ ] **전체 제출물에 실제 개인정보가 전혀 없다는 판정**은 하지 않았습니다. 기존 공개 소개의 이름·공개 GitHub 링크는 사용자 승인에 따라 보존했습니다. 이 보존 범위와 새 합성 자료·비밀값 가림 검사는 구분하며 C12를 무조건 완료로 체크하지 않습니다.

## 배포·접수·승인

- [x] 기존 프로젝트의 Vercel MCP 읽기 403과 CLI 읽기 200을 구분했습니다. CLI로 기존 팀·프로젝트·Git 연결을 확인했습니다. 근거: verification/deployment-access.json입니다.
- [x] 앱 커밋의 Git 자동 미리보기 READY와 보호 로그인 페이지 상태를 구분했습니다. 새 무로그인 컨텍스트에서 첫 화면과 /api/session 모두 Vercel 로그인으로 이동했습니다. 이는 앱 503 확인이 아닙니다. 근거: 상위 CLI 확인·verification/public-access.json입니다.
- [ ] DB SQL 사용자 승인·전용 역할 적용·운영 DB 연결·전용 환경 변수 구성이 남아 있습니다. 승인 답변 없이 SQL을 실행하지 않습니다.
- [ ] T08 운영 배포·공개 결과물·DB 지속 저장·운영 인증 흐름을 확인해야 합니다. 기존 운영 주소는 변경하지 않았습니다.
- [ ] 실제 제출 입력·파일 업로드·접수 결과를 확인해야 합니다.
- [ ] 강사·마스터 등 공식 승인 상태를 실제 화면에서 확인해야 합니다. 접수·완주·승인을 같은 상태로 표시하지 않습니다.

## 실제 준비값과 남은 상태

| 항목 | 현재 상태 | 근거 |
|---|---|---|
| 결과물 후보 | 기존 운영 200·과제 1 소개만 공개·T08 영역 없음 | verification/public-access.json의 production |
| 앱 미리보기 | Git 자동 배포 READY·Vercel 로그인 보호·앱 응답 미관찰 | 상위 CLI 확인·public-access.json의 preview |
| 전체 커밋 소스 | 위 90cc 전체 URL의 공개 200 확인·공식 입력 대기 | public-access.json의 source |
| 설명서 | 공식 6항목·원본 JSON 12개·첨부 후보 MD 한 파일 | AUTH-EXPLANATION.md |
| 확인·판단 문안 | 형식·길이 검사 통과·운영 재검증 대기 | SUBMISSION.md·submission-readiness.json |
| 비밀값 패턴 | 기계적 검사 findings=[]·전체 개인정보 부재 판정 아님 | submission-readiness.json |
| 실제 기기·운영 DB·T08 운영 배포 | 미완료 | 설명서 ⑥·DB-SETUP-PROPOSAL.md |
| 공식 입력·접수·승인 | 미완료·미확인 | 공식 처리 기록 없음 |

원본 시험 JSON을 다시 생성하지 않았습니다. 상태 갱신은 원본 증거의 값·시험 시각을 바꾸지 않습니다.
