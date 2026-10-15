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

한계: 가상 인증기 자동 시험입니다. 실제 사용자 기기와 T08 운영 배포 시험은 대기 중입니다. 질문 값·성공/거절 요청·로그아웃 후 거절 근거는 AUTH-EXPLANATION.md ③·④에 연결했습니다. 공식 제출은 하지 않았습니다.

상태: 카드 3 구현과 로컬 검증을 마쳤습니다. 자동 시험과 운영 결과를 구분합니다.
