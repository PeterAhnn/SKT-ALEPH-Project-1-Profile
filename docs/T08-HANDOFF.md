# T08 이어서 진행할 위치

## 승인 범위와 작업 대상

사용자는 기존 과제 1 프로젝트를 직접 이어 수정하고 공개 내용은 보존하도록 승인했습니다. 카드 1~5 순서와 통과 기준 47개·단계별 증거 보고·제출 요구사항 점검이 최우선입니다.

기존 저장소: PeterAhnn/SKT-ALEPH-Project-1-Profile. 작업 브랜치: t08-passkey. 기존 공개 기준 커밋은 1cde218ce6381c549d5f127d15083c9b6b16f0ce입니다. 사용자 파일 `SKT-ALEPH-project-guide (1).md`는 수정하거나 커밋하지 않습니다.

## 현재까지 실제 수행

- 카드 1~5의 구현과 로컬 HTTP·가상 WebAuthn 인증기 시험을 수행했습니다.
- 각 결과는 CARD-1-REPORT.md부터 CARD-5-REPORT.md와 verification/card1~card5에 있습니다.
- `npm test` 38개, `npm run check`의 공개 원문·기준 47개 보존, `npm run build`가 통과했습니다.
- 등록 검증 중 로그아웃·취소 경합과 조회 실패 안내 문제를 수정하고 별도 검토자가 재검증했습니다. IMPLEMENTATION-REVIEW.md를 확인합니다.
- AUTH-EXPLANATION.md는 공식 여섯 항목과 실제 자동 시험 요청·응답을 포함한 약 35KB MD 첨부 초안입니다. SUBMISSION.md와 SUBMISSION-CHECKLIST.md도 있습니다.

## 남은 일

1. DB-SETUP-PROPOSAL.md의 SQL은 사용자 승인 대기입니다. 아직 DB 스키마·역할·로그인 비밀값·운영 자료를 만들지 않았습니다. 답변 없이 실행하지 않습니다.
2. Vercel MCP는 해당 팀에서 403이지만, CLI 64.2.0의 기존 자격으로 프로젝트와 팀·Git 연결·공개 도메인을 확인했습니다. 재연결이 필수라고 단정하지 않습니다.
3. 기존 Vercel 대상은 skt-aleph-project-1-profile, team peter-ahns-projects, public domain skt-aleph-project-1.vercel.app, production branch main입니다. 실제 프로젝트 ID는 CLI 읽기 결과와 verification/deployment-access.json을 확인합니다.
4. 운영 DB·환경변수·실제 배포·새 시크릿 공개 접근은 검증해야 합니다. 운영 설정이 없으면 비공개 API는 503이며 로컬 파일 저장으로 대체하지 않습니다.
5. 사용자 실제 기기에서 등록·취소·저장 위치·독립 패스키 2개·삭제 후 로그인·삭제 키 거절을 확인해야 합니다. 가상 인증기 시험을 실제 기기 사용으로 표시하지 않습니다.
6. 공식 과제 제출은 하지 않았습니다. 사용자의 이번 요청은 제출 준비와 요구사항 점검입니다. 접수와 강사·마스터 승인도 미확인입니다.

## 실행과 증거 보관

`npm start`로 http://localhost:8008에서 확인합니다. 실제 PIN·생체인증·패스키 저장 선택은 사용자가 직접 수행합니다. 화면의 ‘과제 확인 기록 보관’에서 저장 위치를 직접 선택하고 이 탭의 요청·응답을 내려받을 수 있습니다. 쿠키와 개인키는 기록하지 않습니다. 새로고침하면 탭 기록은 초기화됩니다.

실제 기기 기록은 verification/private/에 먼저 보관합니다. 검토·비밀값 가림 없이 공개 커밋에 넣지 않습니다. 실제 연락처·신분증 번호·새로운 실제 개인정보를 넣지 않습니다. 기존 공개 이름·GitHub 링크는 사용자 명시 승인에 따라 보존하며 이 범위를 설명서에 기록합니다.

## 반복 실행 주의

capture-card2~card5 스크립트는 증거 JSON을 새 난수로 덮어씁니다. AUTH-EXPLANATION.md에 원본 요청을 직접 복사했으므로 다시 실행하면 설명서 인용도 최신 증거와 대조해야 합니다. 공식 원문과 CRITERIA.md의 47개 기준은 삭제하거나 요약으로 바꾸지 않습니다.

`scripts/update-criteria.mjs`는 검증 완료를 자동 추정하는 도구가 아니라 현재 확인 결과를 기록한 상태 갱신 스크립트입니다. 운영·실기·제출 진척이 생기면 그 결정 기록도 함께 갱신합니다.
