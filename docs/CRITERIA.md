# T08 통과 기준 47개 추적표

- 출처: https://aleph-omega.vercel.app/cortex?panel=tasks
- 공식 원문 확인 기록: 2026-10-15 작업 대화에서 재확인한 카드 1~5입니다. 전체 문구와 안내는 `TASK-SOURCE.md`에 보존합니다.
- 작업 대상: 기존 `SKT-ALEPH-Project-1-Profile`입니다. 기존 공개 소개 내용은 유지하고 비공개 영역만 추가합니다.
- 갱신 상태: 47개 기준 모두에 실제 로컬 근거 또는 미완료 사유를 연결했습니다. 로컬·가상 인증기·실제 기기·운영·공식 제출을 구분합니다. 전체 과제 통과를 뜻하지 않습니다.
- 증거 위치 열은 실제 파일이 생성되고 내용을 확인한 뒤 채웁니다. `미수집`은 증거 파일이 없다는 뜻입니다.
- 합성 인증기 시험과 실제 기기 패스키 시험은 구분합니다. 실제 저장 위치·기기 승인·공식 접수 결과를 추정하지 않습니다.

## 카드 1 — 무엇을 잠글지 먼저 가른다 (6개)

| 기준 | 공식 원문 | 상태 | 증거 위치 |
|---|---|---|---|
| T08-C13 | 공개 영역과 비공개 영역이 화면에서 구분되어 보인다. | 로컬 검증 통과 / 운영 대기 | docs/CARD-1-REPORT.md; verification/card1/ |
| T08-C14 | 비공개 영역에 들어 있는 항목이 세 개 이상이다. | 로컬 검증 통과 / 운영 대기 | docs/CARD-1-REPORT.md; verification/card1/ |
| T08-C15 | 패스키로 들어가지 않은 상태에서는 비공개 영역의 내용이 화면에 보이지 않는다. | 로컬 검증 통과 / 운영 대기 | docs/CARD-1-REPORT.md; verification/card1/ |
| T08-C16 | 패스키로 들어가지 않은 상태에서 비공개 자료를 서버에 직접 요청하면 거절된다. | 로컬 검증 통과 / 운영 대기 | docs/CARD-1-REPORT.md; verification/card1/ |
| T08-C17 | 그 거절이 401 또는 403으로 이뤄진다. | 로컬 검증 통과 / 운영 대기 | docs/CARD-1-REPORT.md; verification/card1/ |
| T08-C18 | 로그인하지 않은 상태로 받은 페이지의 소스 어디에도 비공개 내용이 들어 있지 않다. | 로컬 검증 통과 / 운영 대기 | docs/CARD-1-REPORT.md; verification/card1/ |

## 카드 2 — 패스키를 등록한다 (8개)

| 기준 | 공식 원문 | 상태 | 증거 위치 |
|---|---|---|---|
| T08-C19 | 서버가 등록용 질문(challenge)을 만들어 보내고, 그 값을 서버가 확인할 때까지 보관한다. | 가상 인증기·설명서 근거 확인 / 실기·운영 대기 | docs/AUTH-EXPLANATION.md ③; verification/card2/registration-evidence.json |
| T08-C20 | 등록 요청마다 질문 값이 서로 다르다는 기록이 제출문에 있다. | 가상 인증기·설명서 근거 확인 / 실기·운영 대기 | docs/AUTH-EXPLANATION.md ③; verification/card2/registration-evidence.json |
| T08-C21 | 등록이 끝나면 서버에 공개키가 저장된다. | 가상 인증기·설명서 근거 확인 / 실기·운영 대기 | docs/AUTH-EXPLANATION.md ③; verification/card2/registration-evidence.json |
| T08-C22 | 서버에 저장된 값이 제출문에 있고, 그 값이 공개키이며 비밀번호가 아니라는 설명이 함께 적혀 있다. | 가상 인증기·설명서 근거 확인 / 실기·운영 대기 | docs/AUTH-EXPLANATION.md ③; verification/card2/registration-evidence.json |
| T08-C23 | 개인키가 서버로 전송되지 않는다는 사실이, 등록 요청 본문을 적은 기록으로 확인된다. | 가상 인증기·설명서 근거 확인 / 실기·운영 대기 | docs/AUTH-EXPLANATION.md ③; verification/card2/registration-evidence.json |
| T08-C24 | 등록한 패스키에 사람이 알아볼 수 있는 이름이 붙는다. | 가상 인증기·설명서 근거 확인 / 실기·운영 대기 | docs/AUTH-EXPLANATION.md ③; verification/card2/registration-evidence.json |
| T08-C25 | 등록을 중간에 취소하면 화면에 안내가 나오고, 서버에 아무것도 저장되지 않는다. | 모의 취소·경합 시험 통과 / 실제 기기 취소 대기 | docs/CARD-2-REPORT.md; tests/registration.test.mjs; verification/card2/cancelled.png |
| T08-C26 | 패스키를 저장한 곳이 어디인지(구글 비밀번호 관리자·기기 자체·보안 키 중 무엇인지)가 제출문에 적혀 있다. | 미완료: 사용자 실제 패스키 저장 위치 미확인 | docs/AUTH-EXPLANATION.md ① 및 ⑥ |

## 카드 3 — 패스키로 들어간다 (9개)

| 기준 | 공식 원문 | 상태 | 증거 위치 |
|---|---|---|---|
| T08-C27 | 로그인할 때도 서버가 매번 새 질문을 만들어 보낸다. | 가상 인증기·설명서 근거 확인 / 실기·운영 대기 | docs/CARD-3-REPORT.md; docs/AUTH-EXPLANATION.md; verification/card3/ |
| T08-C28 | 로그인 요청마다 질문 값이 서로 다르다는 기록이 제출문에 있다. | 가상 인증기·설명서 근거 확인 / 실기·운영 대기 | docs/CARD-3-REPORT.md; docs/AUTH-EXPLANATION.md; verification/card3/ |
| T08-C29 | 서버가 저장해 둔 공개키로 서명을 확인한 뒤에만 통과시킨다. | 가상 인증기·설명서 근거 확인 / 실기·운영 대기 | docs/CARD-3-REPORT.md; docs/AUTH-EXPLANATION.md; verification/card3/ |
| T08-C30 | 서명 확인에 성공한 요청과 실패한 요청이 나란히 적혀 있다. | 가상 인증기·설명서 근거 확인 / 실기·운영 대기 | docs/CARD-3-REPORT.md; docs/AUTH-EXPLANATION.md; verification/card3/ |
| T08-C31 | 이미 한 번 쓴 질문으로 다시 로그인하려는 요청과 그 거절 응답이 적혀 있다. | 가상 인증기·설명서 근거 확인 / 실기·운영 대기 | docs/CARD-3-REPORT.md; docs/AUTH-EXPLANATION.md; verification/card3/ |
| T08-C32 | 로그인 뒤 무엇으로 사람을 알아보는지(세션·토큰 중 무엇인지)가 제출문에 적혀 있다. | 가상 인증기·설명서 근거 확인 / 실기·운영 대기 | docs/CARD-3-REPORT.md; docs/AUTH-EXPLANATION.md; verification/card3/ |
| T08-C33 | 로그아웃한 뒤 같은 값으로 다시 요청했을 때의 거절 응답이 적혀 있다. | 가상 인증기·설명서 근거 확인 / 실기·운영 대기 | docs/CARD-3-REPORT.md; docs/AUTH-EXPLANATION.md; verification/card3/ |
| T08-C34 | 적어 둔 기록에서 세션·토큰 값이 가려져 있다. | 가상 인증기·설명서 근거 확인 / 실기·운영 대기 | docs/CARD-3-REPORT.md; docs/AUTH-EXPLANATION.md; verification/card3/ |
| T08-C35 | 제출물 어디에도 비밀번호를 입력하는 칸이 없다. | 가상 인증기·설명서 근거 확인 / 실기·운영 대기 | docs/CARD-3-REPORT.md; docs/AUTH-EXPLANATION.md; verification/card3/ |

## 카드 4 — 기기를 잃어버렸을 때 (5개)

| 기준 | 공식 원문 | 상태 | 증거 위치 |
|---|---|---|---|
| T08-C42 | 한 계정에 패스키가 두 개 등록되어 있다. | 독립 가상 인증기 2개 시험 통과 / 실기·운영 대기 | docs/CARD-4-REPORT.md; docs/AUTH-EXPLANATION.md ④; verification/card4/ |
| T08-C43 | 등록된 패스키 목록을 화면에서 볼 수 있고, 각각의 이름과 등록한 날짜가 보인다. | 독립 가상 인증기 2개 시험 통과 / 실기·운영 대기 | docs/CARD-4-REPORT.md; docs/AUTH-EXPLANATION.md ④; verification/card4/ |
| T08-C44 | 패스키 하나를 지운 뒤 남은 하나로 들어갈 수 있다. | 독립 가상 인증기 2개 시험 통과 / 실기·운영 대기 | docs/CARD-4-REPORT.md; docs/AUTH-EXPLANATION.md ④; verification/card4/ |
| T08-C45 | 지운 패스키로는 더 이상 들어갈 수 없다는 기록이 적혀 있다. | 독립 가상 인증기 2개 시험 통과 / 실기·운영 대기 | docs/CARD-4-REPORT.md; docs/AUTH-EXPLANATION.md ④; verification/card4/ |
| T08-C46 | 패스키가 하나도 남지 않았을 때 어떻게 되는지가 화면과 제출문에 적혀 있다. | 독립 가상 인증기 2개 시험 통과 / 실기·운영 대기 | docs/CARD-4-REPORT.md; docs/AUTH-EXPLANATION.md ④; verification/card4/ |

## 카드 5 — 정말 안 열리는지 확인하고, 어떻게 붙였는지 적는다 (19개)

| 기준 | 공식 원문 | 상태 | 증거 위치 |
|---|---|---|---|
| T08-C01 | 결과물 URL 필드에 HTTPS URL 한 개가 제출되어 있다. | 미완료: T08 운영 결과물 URL 미확정·미제출 | docs/SUBMISSION.md; docs/SUBMISSION-CHECKLIST.md |
| T08-C02 | 소스 URL 필드에 HTTPS URL 한 개가 제출되어 있다. | 고정 소스 URL 공개 200 확인 / 공식 입력 대기 | docs/SUBMISSION.md; verification/public-access.json |
| T08-C03 | 제출한 모든 URL(결과물·소스)은 계정 생성·로그인·인증·초대·비밀번호·OAuth·CAPTCHA 없이 새 시크릿 창에서 열린다. | 소스 공개 200 / 미리보기 로그인 보호 / T08 운영 URL 확인 대기 | verification/public-access.json; docs/SUBMISSION-CHECKLIST.md |
| T08-C10 | 결과물 주소의 첫 화면은 공개 소개 페이지이고, 심사하는 사람이 아무것도 등록하지 않아도 열린다. | 로컬 공개 첫 화면 확인 / T08 운영 배포 대기 | verification/card1/public-and-locked.png; docs/CARD-5-REPORT.md |
| T08-C11 | 1번 과제에서 만든 소개 페이지에 이어 붙였고, 1번의 공개 내용이 그대로 남아 있다. | 기존 공개 원문 보존 검사 통과 / 운영 배포 대기 | scripts/check-source.mjs; contracts/profile-baseline.html; docs/CARD-5-REPORT.md |
| T08-C12 | 제출물에 실제 개인정보가 없고, 넣은 내용이 만들어 넣은 것이라는 사실이 적혀 있다. | 새 자료는 가상 내용 / 최종 비밀값 검사 및 기존 공개 이름 보존 범위 기록 | docs/AUTH-EXPLANATION.md; docs/CARD-5-REPORT.md |
| T08-C36 | 패스키를 등록한 계정이 두 개이고, 각각에 서로 다른 비공개 내용이 들어 있다. | 가상 계정 양방향 격리·건수 보존·소스 위치 확인 / 운영 대기 | verification/card5/isolation-evidence.json; docs/AUTH-EXPLANATION.md ③·④ |
| T08-C37 | 한쪽 패스키로 들어가 다른 쪽의 비공개 자료를 읽으려는 요청과 그 거절 응답이 적혀 있다. | 가상 계정 양방향 격리·건수 보존·소스 위치 확인 / 운영 대기 | verification/card5/isolation-evidence.json; docs/AUTH-EXPLANATION.md ③·④ |
| T08-C38 | 반대 방향(다른 쪽에서 첫 쪽으로)의 요청도 똑같이 거절된 기록이 적혀 있다. | 가상 계정 양방향 격리·건수 보존·소스 위치 확인 / 운영 대기 | verification/card5/isolation-evidence.json; docs/AUTH-EXPLANATION.md ③·④ |
| T08-C39 | 거절 앞뒤로 반대편의 자료 건수가 같다는 기록이 적혀 있다. | 가상 계정 양방향 격리·건수 보존·소스 위치 확인 / 운영 대기 | verification/card5/isolation-evidence.json; docs/AUTH-EXPLANATION.md ③·④ |
| T08-C40 | 주소나 요청 본문에 다른 계정을 적어 보낸 요청과, 그래도 내 자료만 돌아온 응답이 적혀 있다. | 가상 계정 양방향 격리·건수 보존·소스 위치 확인 / 운영 대기 | verification/card5/isolation-evidence.json; docs/AUTH-EXPLANATION.md ③·④ |
| T08-C41 | 위 거절을 만들어 내는 소스의 위치가 제출문에 적혀 있다. | 가상 계정 양방향 격리·건수 보존·소스 위치 확인 / 운영 대기 | verification/card5/isolation-evidence.json; docs/AUTH-EXPLANATION.md ③·④ |
| T08-C47 | 인증 구현 설명서의 여섯 항목(① 무엇으로 붙였나, ② 왜 그걸 골랐나, ③ 어디를 어떻게 고쳤나, ④ 안 열리는 것을 확인한 기록, ⑤ AI와 나, ⑥ 아직 못 막은 것)이 각각 나뉘어 적혀 있다. | 설명서·확인법·실제 판단 초안 작성·대조 / 공식 제출 대기 | docs/AUTH-EXPLANATION.md; docs/SUBMISSION.md; docs/CARD-5-REPORT.md |
| T08-C48 | ①에 직접 구현·라이브러리·인증 서비스 중 무엇을 썼는지와 그 이름이 적혀 있다. | 설명서·확인법·실제 판단 초안 작성·대조 / 공식 제출 대기 | docs/AUTH-EXPLANATION.md; docs/SUBMISSION.md; docs/CARD-5-REPORT.md |
| T08-C49 | ③에 등록·로그인·로그아웃·비공개 자료 조회 네 흐름이 소스의 어디를 지나는지 적혀 있다. | 설명서·확인법·실제 판단 초안 작성·대조 / 공식 제출 대기 | docs/AUTH-EXPLANATION.md; docs/SUBMISSION.md; docs/CARD-5-REPORT.md |
| T08-C50 | ④에 확인 네 가지(로그인 없이 열기, 남의 패스키로 열기, 이미 쓴 질문 재사용, 패스키 삭제 뒤 로그인)가 모두 있고, 각각 성공한 요청과 거절된 요청이 나란히 적혀 있다. | 설명서·확인법·실제 판단 초안 작성·대조 / 공식 제출 대기 | docs/AUTH-EXPLANATION.md; docs/SUBMISSION.md; docs/CARD-5-REPORT.md |
| T08-C51 | ⑥에 아직 못 막은 것이 최소 하나 구체적으로 적혀 있다. 없다고만 적으면 통과하지 않는다. | 설명서·확인법·실제 판단 초안 작성·대조 / 공식 제출 대기 | docs/AUTH-EXPLANATION.md; docs/SUBMISSION.md; docs/CARD-5-REPORT.md |
| T08-C52 | 짧은 확인 방법에 ① 어디로 가나요, ② 세 단계 안에 무엇을 하나요, ③ 무엇이 보이면 통과인가요, ④ 안 될 때는 무엇이 보이나요가 각각 나뉘어 적혀 있다. | 설명서·확인법·실제 판단 초안 작성·대조 / 공식 제출 대기 | docs/AUTH-EXPLANATION.md; docs/SUBMISSION.md; docs/CARD-5-REPORT.md |
| T08-C53 | 제출문에 ① AI에게 맡긴 일, ② 내가 직접 판단한 일, ③ AI 제안을 따르지 않은 일(없다면 왜 없었는지)이 각각 나뉘어 적혀 있다. | 설명서·확인법·실제 판단 초안 작성·대조 / 공식 제출 대기 | docs/AUTH-EXPLANATION.md; docs/SUBMISSION.md; docs/CARD-5-REPORT.md |

## 수량과 상태를 확인하는 규칙

- 카드별 기준 수는 6·8·9·5·19개이며 합계는 47개입니다. 번호가 C01~C53에서 연속하지 않는 것은 원문에 따른 것입니다. 없는 번호를 새 기준으로 만들지 않습니다.
- 기능을 구현했더라도 실행 근거가 없으면 미검증을 유지합니다. 실패하거나 사용자 실제 기기 확인이 필요한 경우 해당 사실과 남은 행동을 적습니다.
- C01·C02는 실제 제출 확인이 필요한 기준입니다. 주소를 준비하거나 제출 문안을 작성한 상태를 제출 완료로 기록하지 않습니다.
- 제출 화면은 공개 결과물 URL 또는 PDF·DOCX·MD·TXT 보고서 한 파일 중 하나로 접수할 수 있다고 안내합니다. 이는 C01·C02의 완주 기준과 구분합니다.
- 자동 시험 기록을 실제 기기·보안 키·비밀번호 관리자에서 수행한 기록으로 바꾸어 적지 않습니다.
