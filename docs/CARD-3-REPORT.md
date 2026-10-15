# 카드 3 결과 — 가상 인증기 자동 시험

작업: 매번 새 질문을 보내는 패스키 로그인과 서버 세션·로그아웃을 구현했습니다. 실제 브라우저 가상 인증기의 서명을 SimpleWebAuthn 검증기로 확인했습니다.

| 기준 | 실제 결과·남은 일 | 증거 |
|---|---|---|
| C27 | 로그인 질문을 매번 새로 생성했습니다. | verification/card3/authentication-evidence.json |
| C28 | 서로 다른 실제 질문 값 2개를 AUTH-EXPLANATION.md ③에 직접 포함했습니다. 공식 제출은 대기 중입니다. | 같은 파일의 freshChallenges; docs/AUTH-EXPLANATION.md ③ |
| C29 | 실제 정상 서명은 통과하고 변조한 서명은 401로 거절했습니다. | 같은 파일의 records |
| C30 | 정상·실패 요청과 응답을 나란히 보관했습니다. | 같은 파일의 records |
| C31 | 이미 통과한 질문·서명을 그대로 재전송하자 400으로 거절했습니다. | 같은 파일의 records |
| C32 | 30분 서버 세션과 HttpOnly·SameSite=Strict 쿠키를 사용합니다. 서버에는 세션 값의 SHA-256 해시를 저장합니다. | server/auth.mjs, authentication-evidence.json |
| C33 | 로그아웃 전 쿠키를 직접 재전송하자 401이었습니다. | 같은 파일의 staleSession |
| C34 | 기록의 Cookie와 Set-Cookie는 [가림]으로 보관했습니다. | 같은 파일의 records 및 staleSession |
| C35 | 서비스 화면에 비밀번호 입력란이 없습니다. | 같은 파일의 passwordInputCount, scripts/check-source.mjs |

화면: verification/card3/logged-in.png, logged-out.png.

추가 검증: 잘못된 출처·RP ID·사용자 확인·다른 계정 키·만료·동시 검증·검증 도중 로그아웃·키 삭제를 거절했습니다. 질문을 먼저 소비하므로 실패에도 질문이 복구되지 않습니다. HTTPS 운영 쿠키에는 Secure가 적용됩니다. 로컬 localhost에서는 Secure를 사용하지 않습니다.

한계: 가상 인증기 자동 시험입니다. 실제 사용자 로그인 성공은 이후 직접 응답으로 확인했으며 운영 자동 시험과 아래에서 구분합니다. 질문 값·성공/거절 요청·로그아웃 후 거절 근거는 AUTH-EXPLANATION.md ③·④에 연결했습니다. 공식 제출은 하지 않았습니다.

상태: 최초 로컬 기록과 아래 운영 자동 시험을 구분해 보존합니다. 사용자 로그인 성공은 직접 확인했고 실제 기기 취소·삭제 키 실패 동작·공식 제출은 별도로 남아 있습니다.

## 운영 추가 검증

실제 운영 HTTPS에서 가상 인증기 서명과 서버 검증을 수행했습니다. verification/production/run-mv93637i-d8b509/production-evidence.json의 실제 결과입니다.

| 항목 | 실제 운영 응답 |
|---|---|
| 로그인 질문 2개 | 서로 다른 값이며 AUTH-EXPLANATION.md ③에 직접 포함했습니다. |
| 정상 서명 | 200입니다. |
| 변조 서명 | 401입니다. |
| 타인 키로 로그인 | B의 실제 가상 키로 A 로그인 시 401입니다. |
| 성공한 질문·서명 재사용 | 400입니다. |
| 로그아웃 전 쿠키 재사용 | 401입니다. |
| 운영 쿠키 | HttpOnly=true·Secure=true·SameSite=Strict입니다. |
| 비밀번호 입력란 | 0개입니다. |

원본 요청·응답 80건 중 관련 기록과 핵심 실제 값을 AUTH-EXPLANATION.md ④에 추가했습니다. 사용자 실제 로그인 성공은 별도 직접 응답으로 확인했으며 이 자동 요청의 기록으로 대체하지 않습니다. 공식 제출은 확인하지 않았습니다.

## 사용자 직접 확인 — 자동 시험과 구분

verification/real-device-user-confirmation.json에 사용자의 두 응답을 보존했습니다: “구글 비밀번호 관리자 로그인 성공”, “패스키 2개 등록 → 1개 삭제 → 남은 키 로그인까지 성공했습니다.”

이 응답은 실제 저장 위치·로그인·두 키 등록·하나 삭제·남은 키 성공을 확인합니다. AI 직접 관찰은 아닙니다. 실제 기기 취소·삭제된 실제 키 서명 거절·0개 정책의 사용자 확인은 없으며 위 자동 시험의 요청·응답과 구분합니다.
