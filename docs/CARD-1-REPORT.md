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

최초 로컬 시험의 한계: 위 인증된 화면은 합성 세션을 주입했습니다. 그 기록 자체는 실제 패스키 성공 증거가 아닙니다. 이후 아래 운영 추가 검증에서는 실제 가상 인증기 서명과 서버 흐름을 사용했습니다.

상태: 최초 로컬 기록을 보존했으며 아래 운영 추가 검증으로 비로그인 경계·자료 조회·HTML 검사를 확인했습니다. 실제 사용자 기기·공식 제출과 구분합니다.

## 운영 추가 검증

2026-10-15에 실제 운영 https://skt-aleph-project-1.vercel.app/ 를 확인했습니다. 근거는 verification/production/http-evidence.json과 verification/production/run-mv93637i-d8b509/production-evidence.json입니다.

| 기준 | 운영의 실제 결과 | 증거 |
|---|---|---|
| C13 | 공개 소개 원문과 앱 index.html이 일치하고 잠금 경계가 보입니다. | http-evidence.json의 exactIndexMatch·privateBoundaryPresent; verification/production/run-mv93637i-d8b509/public-page.png |
| C14 | 실제 운영 가상 인증기 로그인 후 A·B 각각 합성 자료 3개를 반환합니다. | production-evidence.json의 checks.isolation; account-a.png·account-b.png |
| C15 | 비로그인 화면에서 자료는 잠겨 있습니다. | verification/production/run-mv93637i-d8b509/locked.png |
| C16·C17 | 비로그인 GET /api/private/items는 401입니다. | http-evidence.json |
| C18 | 비로그인 HTML에 비공개 내용이 없습니다. privateContentInHTML=false입니다. | verification/production/run-mv93637i-d8b509/unauthenticated.html; checks.public |

서버 자료·세션을 직접 주입하지 않은 운영 가상 인증기 시험입니다. 초기 로컬 합성 세션 시험과 구분합니다. 사용자는 구글 비밀번호 관리자·로그인·두 키 등록 후 하나 삭제와 남은 키 로그인 성공을 직접 확인했습니다. 실제 기기 취소·일부 실패 동작·공식 제출은 별도로 구분하며 47개 전체 완주를 뜻하지 않습니다.
