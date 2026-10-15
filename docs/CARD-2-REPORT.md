# 카드 2 결과 — 가상 인증기 자동 시험

작업: 실제 SimpleWebAuthn 등록 질문 생성·검증·취소·공개키 저장·패스키 목록을 구현했습니다. 브라우저 흐름은 개인 Chrome과 분리된 Chromium 가상 인증기에서 실행했습니다.

| 기준 | 실제 검증·남은 일 | 증거 |
|---|---|---|
| C19 | 질문을 서버에서 생성하고, 검증 전 서버 보관 값과 일치하는 것을 확인했습니다. | verification/card2/registration-evidence.json |
| C20 | 연속한 등록 질문 2개의 실제 값을 비교해 서로 다른 것을 확인했고 AUTH-EXPLANATION.md ③에 직접 포함했습니다. 공식 제출은 대기 중입니다. | 같은 파일의 freshChallenges; docs/AUTH-EXPLANATION.md ③ |
| C21 | 실제 등록 완료 후 공개키가 저장되었습니다. | 같은 파일의 storedPublicKey |
| C22 | 저장 공개키 실제 값과 공개키이며 비밀번호가 아니라는 설명을 AUTH-EXPLANATION.md ③에 직접 포함했습니다. | 같은 파일의 storedPublicKey.publicKey; docs/AUTH-EXPLANATION.md ③ |
| C23 | 브라우저가 보낸 등록 본문을 보관했고 개인키·비밀번호 필드가 없는 것을 확인했습니다. | 같은 파일의 records |
| C24 | 사람이 알아볼 수 있는 이름과 등록 날짜가 화면에 표시됩니다. | verification/card2/registered.png |
| C25 | NotAllowedError 취소를 모의 발생시켜 안내가 나오고 계정·패스키 건수가 증가하지 않는 것을 확인했습니다. 실제 기기 취소는 미확인입니다. | verification/card2/cancelled.png, registration-evidence.json |
| C26 | 자동 시험은 Chromium 가상 인증기이며, 이후 사용자가 실제 저장 위치를 구글 비밀번호 관리자로 직접 확인했습니다. | verification/real-device-user-confirmation.json |

추가 검증: 잘못된 질문·출처·RP ID·사용자 확인 없음·잘못된 등록 응답·질문 재사용을 실제 서버 라이브러리가 거절했습니다. 익명 요청으로 기존 계정에 새 패스키를 추가할 수 없습니다. 질문은 5분 후 만료되고 브라우저에 연결되며, 소비한 질문은 검증 실패에도 복구되지 않습니다.

한계: 이 결과를 Windows Hello·구글 비밀번호 관리자·보안 키의 실제 등록으로 간주하지 않습니다. 사용자 실제 저장 위치·로그인·두 키 등록과 삭제 후 사용은 직접 응답으로 확인했습니다. 실제 기기 취소는 남아 있습니다. 운영 자동 등록은 아래에서 추가 검증했습니다.

상태: 카드 2 구현·자동 시험과 AUTH-EXPLANATION.md의 근거 연결을 마쳤습니다. 운영 자동 검증은 아래 추가 기록에 있습니다. 구글 비밀번호 관리자와 두 키 사용은 사용자 직접 확인을 받았으며 실제 기기 취소·공식 제출은 대기 중입니다.

## 운영 추가 검증

실제 운영 HTTPS에서 가상 인증기 등록을 수행했습니다. 근거는 verification/production/run-mv93637i-d8b509/production-evidence.json입니다.

- 등록 질문 2개가 서로 다릅니다. checks.registration.freshChallenges의 실제 값과 등록 본문을 AUTH-EXPLANATION.md ③에 추가했습니다.
- 한 계정에 독립 가상 인증기 2개의 공개키·이름·등록일이 저장되었습니다. checks.registration.publicKeys와 two-passkeys.png를 확인했습니다.
- 공개키이며 비밀번호가 아니라는 설명을 실제 저장 값과 연결했습니다. 운영 등록 요청에도 개인키·비밀번호는 없습니다.
- 질문 비교 뒤 서버 취소 요청은 200으로 처리되었습니다. 이 취소 요청과 초기 NotAllowedError 모의 화면 시험을 실제 사용자 기기의 취소 조작으로 표시하지 않습니다.
- C26의 사용자 실제 저장 위치는 이후 직접 응답에서 구글 비밀번호 관리자로 확인했습니다. 운영 자동 시험 저장 위치는 Chromium 메모리의 독립 가상 인증기이며 Windows Hello·비밀번호 관리자·물리 보안 키 사용 기록이 아닙니다.

상태: 로컬·운영 자동 등록과 설명서 연결을 확인했습니다. 구글 비밀번호 관리자와 두 키 사용은 사용자 직접 확인을 받았으며 실제 기기 취소·공식 제출은 대기 중입니다.

## 사용자 직접 확인 — 자동 시험과 구분

verification/real-device-user-confirmation.json에 사용자의 두 응답을 보존했습니다: “구글 비밀번호 관리자 로그인 성공”, “패스키 2개 등록 → 1개 삭제 → 남은 키 로그인까지 성공했습니다.”

이 응답은 실제 저장 위치·로그인·두 키 등록·하나 삭제·남은 키 성공을 확인합니다. AI 직접 관찰은 아닙니다. 실제 기기 취소·삭제된 실제 키 서명 거절·0개 정책의 사용자 확인은 없으며 위 자동 시험의 요청·응답과 구분합니다.
