# 카드 1 결과 — 로컬 검증

작업: 기존 소개 페이지의 공개 내용을 보존하고, 비공개 공간 경계와 인증이 필요한 자료 조회 API를 추가했습니다.

검증: 기존 `index.html`에서 T08 추가 구간만 제거하면 기준 커밋 `1cde218ce6381c549d5f127d15083c9b6b16f0ce`의 원문과 일치합니다. 실제 로컬 HTTP와 분리된 Chromium 화면 시험을 수행했습니다.

| 기준 | 실제 결과 | 증거 |
|---|---|---|
| C13 | 공개 소개 아래 별도 비공개 공간 경계가 보입니다. | verification/card1/public-and-locked.png |
| C14 | 합성 계정의 비공개 자료 3개가 인증된 화면에 표시됩니다. | verification/card1/synthetic-unlocked.png, browser-evidence.json |
| C15 | 비로그인 화면에서 비공개 내용은 숨겨져 있습니다. | verification/card1/locked.png, browser-evidence.json |
| C16 | 로그인하지 않은 실제 GET 요청이 거절됩니다. | verification/card1/http-evidence.json |
| C17 | 위 응답 상태는 401입니다. 타인 계정 경로는 403입니다. | verification/card1/http-evidence.json |
| C18 | 비로그인 HTML에 시험용 비공개 표식이 없습니다. | verification/card1/unauthenticated.html, http-evidence.json |

추가 확인: 기존 테마 전환과 390px 모바일 너비에서 가로 넘침이 없는 것을 확인했습니다. 서버 소스·로컬 자료·환경변수·문서 경로는 공개 서버에서 404입니다. 빌드도 통과했습니다.

시험의 한계: 인증된 화면은 시험 코드에서 합성 세션을 주입하여 확인했습니다. 이 결과는 실제 패스키 등록·로그인 성공을 뜻하지 않습니다. 카드 2~3에서 WebAuthn 흐름으로 다시 검증하고, 운영 배포와 실제 기기 시험은 별도로 기록합니다.

상태: 카드 1의 6개 기준은 로컬 합성 시험에서 검증했습니다. 운영 배포 검증은 대기 중입니다.
