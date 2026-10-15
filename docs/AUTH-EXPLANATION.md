# T08 인증 구현 설명서 — 운영 검증·사용자 직접 확인·남은 한계

- 갱신일: 2026-10-15 (한국 표준시)
- 공식 출처: https://aleph-omega.vercel.app/cortex?panel=tasks
- 공개 결과물: https://skt-aleph-project-1.vercel.app/ 입니다. 공개 200·기존 소개 원문 일치·잠금 경계·비로그인 비공개 조회 401을 확인했습니다.
- 운영 배포: 653f9057cb63e5223b37b474f6f1fe1ceb61284c, dpl_HhDtMFtzJxQkicx29G4FXZNYdomd이며 READY입니다. 앱 코드는 최초 구현 90cc5592447b3dd22ed882b0600d8ee9f1632e68과 같습니다.
- 고정 소스 URL: https://github.com/PeterAhnn/SKT-ALEPH-Project-1-Profile/commit/653f9057cb63e5223b37b474f6f1fe1ceb61284c 입니다. verification/production/public-access.json에서 초기 쿠키가 0개인 무로그인 컨텍스트의 200을 확인했습니다. 제출 화면의 두 URL·확인 4줄·판단 3줄 초안을 입력하고 화면값을 확인했습니다. 파일 선택·업로드·실제 제출은 아직 하지 않았습니다.
- 완료: 승인된 DB SQL·전용 역할·인증서/호스트 검증 연결·전용 운영 환경 변수·T08 운영 배포·실제 HTTPS 서버에 대한 가상 인증기 자동 시험입니다.
- 사용자 직접 확인: 구글 비밀번호 관리자에서 로그인했고 패스키 2개 등록→1개 삭제→남은 키 로그인까지 성공했다고 답했습니다. 근거는 verification/real-device-user-confirmation.json이며 AI의 직접 관찰이 아닙니다.
- 미확인: 실제 기기 취소, 삭제된 실제 키의 서명 거절·0개 정책에 대한 사용자 직접 확인, 물리적으로 독립된 복구 기기 확보, 파일 선택·업로드·실제 제출·접수·심사·승인입니다. **공식 47개 기준 전체 통과를 주장하지 않습니다.**
- 운영 시험은 서버 자료·세션을 직접 주입하지 않고 실제 브라우저 API와 서명으로 수행했습니다. 요청/응답 80건과 화면 8개는 verification/production/run-mv93637i-d8b509/production-evidence.json 및 같은 폴더에 있습니다.
- 새 계정·비공개 자료는 합성 내용입니다. Cookie·Set-Cookie·세션·토큰은 [가림]이며 개인키를 파일로 저장하지 않았습니다. 기존 공개 소개의 이름·GitHub 링크는 사용자 승인에 따라 보존했습니다. 아래 로컬 원본 인용은 그대로 유지하고 운영 확인을 추가합니다.

## ① 무엇으로 붙였나

Node.js 24용 서버에 SimpleWebAuthn 라이브러리를 사용했습니다. package.json에 고정한 버전은 @simplewebauthn/server 14.0.3, @simplewebauthn/browser 14.0.0입니다. 브라우저는 WebAuthn 등록·로그인 API를 호출하고 서버 라이브러리가 질문·출처·RP ID·사용자 확인·서명을 검증합니다.

로그인 뒤에는 **서버 측 세션**으로 계정을 식별합니다. 무작위 세션 값은 HttpOnly·SameSite=Strict 쿠키로 보내며 서버에는 그 값의 SHA-256 해시와 계정·인증 키·만료 시각을 보관합니다. 세션 수명은 30분, 일회용 질문 수명은 5분입니다. 운영 HTTPS 시험에서 HttpOnly=true·Secure=true·SameSite=Strict를 확인했습니다. 아래 보존한 최초 로컬 시험은 localhost HTTP이므로 cookieFlags.secure=false입니다. 서로 다른 환경의 결과를 구분합니다.

로컬 시험은 Git에서 제외하는 JSON 상태 저장소를 사용했습니다. 운영은 pg 8.23.1의 PgStore와 승인된 기존 Supabase DB의 새 t08 스키마·전용 t08_runtime 역할을 사용합니다. SQL 적용·LOGIN·공식 CA/호스트 검증 연결·별도 풀 지속 저장·롤백·권한 거절과 기존 T07 7개 테이블 건수 보존을 verification/db-setup.json·db-runtime.json에서 확인했습니다. 서버 전용 운영 환경 변수 T08_DATABASE_URL·T08_DATABASE_CA·T08_ORIGIN을 적용했고 실제 비밀값은 공개하지 않았습니다. 작업용 비공개 파일은 로컬에 남아 있으므로 로컬에 비밀값이 전혀 없다고 주장하지 않습니다. Git·배포 제외와 ACL 제한의 보관 상태는 T08-HANDOFF.md에 적었습니다. 운영 설정이 없는 경우의 503 처리는 구현된 오류 흐름이며 과거 보호된 미리보기의 로그인 페이지를 앱 503으로 해석하지 않습니다.

개인 Chrome과 분리한 Chromium 가상 인증기로 실제 브라우저 WebAuthn API와 서명을 실행했습니다. 이 자동 시험은 사용자 실제 기기·Windows Hello·비밀번호 관리자·물리 보안 키의 사용 증거와 구분합니다.

사용자는 이후 실제 저장 위치와 사용 결과를 다음 두 응답으로 직접 확인했습니다. C26의 저장 위치는 **구글 비밀번호 관리자**입니다. AI가 화면이나 실제 기기 동작을 직접 관찰한 기록으로 바꾸지 않습니다.

> 구글 비밀번호 관리자 로그인 성공

> 패스키 2개 등록 → 1개 삭제 → 남은 키 로그인까지 성공했습니다.

근거: verification/real-device-user-confirmation.json입니다. 실제 기기 취소·삭제 키 서명 거절·마지막 키 0개 정책은 사용자 응답에 없으므로 해당 동작의 자동 시험과 분리합니다. 사용자 PIN·생체정보·개인키·세션 값을 받지 않았습니다.

## ② 왜 그걸 골랐나

등록 응답과 로그인 서명을 검증할 때 출처·RP ID·질문·사용자 확인을 함께 확인하기 위해 SimpleWebAuthn을 선택했습니다. 계정별 비공개 자료를 서버에서 제한하고 로그아웃·키 삭제 후 인증 상태를 폐기하려고 서버 세션을 사용했습니다. 특정 라이브러리나 DB 제품은 공식 과제의 지정 조건이 아닙니다.

사용자는 AI가 제안한 별도 저장소 방식에 대해 T08-C11을 지적했고, 기존 과제 1을 직접 수정하고 공개 내용을 유지하라고 결정했습니다. 카드 1부터 5까지 순서대로 진행하고 47개 기준을 빠짐없이 검증하며 제출 요구사항까지 점검하도록 명시적으로 승인했습니다.

## ③ 어디를 어떻게 고쳤나

아래 행 번호는 2026-10-15에 실제 앱 파일을 대조한 값입니다. 운영 소스 기준은 653f9057cb63e5223b37b474f6f1fe1ceb61284c이며 앱 코드는 최초 구현 90cc5592447b3dd22ed882b0600d8ee9f1632e68과 같습니다. 운영 배포 ID는 dpl_HhDtMFtzJxQkicx29G4FXZNYdomd이고 공개 별칭에서 실제 앱을 확인했습니다. 이전 Git 미리보기의 보호 로그인 페이지와 운영 승격 전 CLI 탐색의 302는 과거 관찰입니다.

| 흐름 | 브라우저 시작 위치 | 서버 위치와 역할 |
|---|---|---|
| 등록 | assets/private.mjs 82행에서 등록을 시작하고 88~91행에서 질문·기기 등록 응답을 보냅니다. | server/auth.mjs 42행 registrationOptions가 질문을 생성·보관하고, 82행 consumeRegistration이 먼저 소비하며, 104행 registrationVerify가 검증합니다. 133~140행에서 공개키·세션을 저장합니다. 경로 연결은 304~305행입니다. |
| 로그인 | assets/private.mjs 100행에서 시작하고 104~106행에서 질문·서명을 보냅니다. | server/auth.mjs 162행 authenticationOptions가 질문을 생성하고, 194행 consumeAuthentication이 소비·키 소유자를 확인하며, 215행 authenticationVerify가 공개키로 검증합니다. 243행에서 새 세션을 저장합니다. 경로 연결은 307~308행입니다. |
| 로그아웃 | assets/private.mjs 114행에서 시작하고 117행에서 POST /api/logout을 보냅니다. | server/auth.mjs 250행 logout이 세션·관련 질문을 폐기하고 쿠키를 비웁니다. 경로 연결은 309행입니다. |
| 비공개 자료 조회 | assets/private.mjs 19행 refresh가 인증 상태를 확인하고 36행에서 GET /api/private/items를 요청합니다. | server/app.mjs 27행 currentUser가 서버 세션을 확인합니다. 60~68행이 비공개 조회이며 64행에서 타인 경로를 403으로 거절합니다. 67행은 URL의 계정 값 대신 인증된 user.id와 user.items만 반환합니다. |

패스키 삭제는 server/auth.mjs 270행 deleteCredential에서 본인 소유를 확인하고, 해당 키와 관련 인증 상태를 폐기합니다. 마지막 키 삭제 시 모든 세션을 끝내고 복구 수단이 없다는 메시지를 반환합니다. 화면의 삭제 안내는 assets/private.mjs 60~72행에 있습니다.

서버 저장 공개키 확인 화면과 **이 탭의 확인 기록 내려받기** 기능을 추가했습니다. assets/private.mjs 124행부터 현재 탭에서 모은 요청·응답과 사용자가 직접 선택한 저장 위치를 t08-browser-evidence.json으로 내려받습니다. 쿠키 값은 읽어 기록하지 않고 [가림]을 넣습니다. 이 기능이 있다는 사실은 실제 기기 시험이나 저장 위치 확인 완료를 뜻하지 않습니다. 카드 5 시험 내보내기의 storageLocation도 미확인입니다.

### 등록 질문 2개와 서버 보관 값 — C19·C20

verification/card2/registration-evidence.json의 freshChallenges와 serverRetainedChallenges입니다. 두 질문은 서로 다르며 서버 보관 값과 일치합니다.

```json
{
  "freshChallenges": [
    "wdYu95OSRWD1VvguyhynIZ7XRoSSrqAOA3GC6xAQDvg",
    "yPtKq3nsIWnA4y6xvg3Ew3F2sG1EHF59b3vNO-Th7_I"
  ],
  "serverRetainedChallenges": [
    "wdYu95OSRWD1VvguyhynIZ7XRoSSrqAOA3GC6xAQDvg",
    "yPtKq3nsIWnA4y6xvg3Ew3F2sG1EHF59b3vNO-Th7_I"
  ]
}
```

### 저장된 공개키 실제 값 — C21·C22

다음 값은 같은 파일의 storedPublicKey입니다. publicKey는 인증 서명을 확인하기 위해 서버에 저장한 공개키의 base64url 표현입니다. **공개키는 비밀번호가 아니며, 이 값만으로 개인키 서명을 만들 수 없습니다.** 서버는 개인키를 저장하지 않습니다. 아래 계정·키는 가상 인증기 시험 자료입니다.

```json
{
  "id": "geuBcNPPxohW-51SsszM_bqIOK-I-xW-shLSm_3ZS7w",
  "userId": "c804ffa0-9778-4ac9-a40c-52b4a730f47b",
  "name": "가상 인증기 A",
  "createdAt": "2026-10-15T04:12:56.227Z",
  "publicKey": "pQECAyYgASFYIGOhmuNQ2Ct8Wkjfn72hJqSKRsTspY51WHsa-vDUGehRIlggfPPoFS33c2CauAUtHrIujI2l80-sp68hU7S1Nf00bgw",
  "counter": 1,
  "transports": [
    "internal"
  ],
  "deviceType": "singleDevice",
  "backedUp": false,
  "aaguid": "01020304-0506-0708-0102-030405060708"
}
```

### 등록 요청 본문과 응답 — C23

다음은 브라우저가 보낸 POST /api/passkeys/register/verify의 실제 기록입니다. 본문에는 공개키·등록 확인 데이터가 있으며 개인키·비밀번호 필드는 없습니다. 이 기록과 WebAuthn API 흐름을 근거로 서버로 개인키를 보내지 않는 것을 확인했습니다. 실제 사용자의 비밀번호 관리자 내부 저장·동기화 정책까지 검사했다는 뜻은 아닙니다.

```json
{
  "request": {
    "method": "POST",
    "path": "/api/passkeys/register/verify",
    "cookie": "[가림]",
    "body": {
      "challengeId": "e4aec458-7056-46e5-8bc5-650c82adfaa8",
      "response": {
        "id": "geuBcNPPxohW-51SsszM_bqIOK-I-xW-shLSm_3ZS7w",
        "rawId": "geuBcNPPxohW-51SsszM_bqIOK-I-xW-shLSm_3ZS7w",
        "response": {
          "attestationObject": "o2NmbXRkbm9uZWdhdHRTdG10oGhhdXRoRGF0YVikSZYN5YgOjGh0NBcPZHZgW4_krrmihjLHmVzzuoMdl2NFAAAAAQECAwQFBgcIAQIDBAUGBwgAIIHrgXDTz8aIVvudUrLMzP26iDiviPsVvrIS0pv92Uu8pQECAyYgASFYIGOhmuNQ2Ct8Wkjfn72hJqSKRsTspY51WHsa-vDUGehRIlggfPPoFS33c2CauAUtHrIujI2l80-sp68hU7S1Nf00bgw",
          "clientDataJSON": "eyJ0eXBlIjoid2ViYXV0aG4uY3JlYXRlIiwiY2hhbGxlbmdlIjoiemptSDJMekhsajFsRlZqa0kzTUk1WjFHQ2ZSMV9WNnRKWHIydlNkRTliYyIsIm9yaWdpbiI6Imh0dHA6Ly9sb2NhbGhvc3Q6NjE3NDgiLCJjcm9zc09yaWdpbiI6ZmFsc2V9",
          "transports": [
            "internal"
          ],
          "publicKeyAlgorithm": -7,
          "publicKey": "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEY6Ga41DYK3xaSN-fvaEmpIpGxOyljnVYexr68NQZ6FF88-gVLfdzYJq4BS0esi6MjaXzT6ynryFTtLU1_TRuDA",
          "authenticatorData": "SZYN5YgOjGh0NBcPZHZgW4_krrmihjLHmVzzuoMdl2NFAAAAAQECAwQFBgcIAQIDBAUGBwgAIIHrgXDTz8aIVvudUrLMzP26iDiviPsVvrIS0pv92Uu8pQECAyYgASFYIGOhmuNQ2Ct8Wkjfn72hJqSKRsTspY51WHsa-vDUGehRIlggfPPoFS33c2CauAUtHrIujI2l80-sp68hU7S1Nf00bgw"
        },
        "type": "public-key",
        "clientExtensionResults": {
          "credProps": {
            "rk": true
          }
        },
        "authenticatorAttachment": "platform"
      }
    }
  },
  "response": {
    "status": 200,
    "body": {
      "registered": true,
      "user": {
        "id": "c804ffa0-9778-4ac9-a40c-52b4a730f47b",
        "name": "virtual-a"
      }
    }
  }
}
```

### 로그인 질문 2개 — C27·C28

verification/card3/authentication-evidence.json의 freshChallenges입니다. 서로 다른 로그인 질문이 기록되어 있습니다.

```json
{
  "freshChallenges": [
    "2sZUUlgwlEcAIiRwDCRFKRYct3gCyT6WtlluHYlmuOI",
    "Dsiqt34iV5NyumQsP46k8o_Enlg_aUmB8NNR0vJcxkY"
  ]
}
```


### 운영 추가 확인: 새 질문·공개키·등록 본문

다음 값은 verification/production/run-mv93637i-d8b509/production-evidence.json에서 직접 읽었습니다. 운영 등록 질문 2개와 로그인 질문 2개가 각각 다릅니다. 한 계정에 이름·등록일이 있는 독립 가상 인증기 공개키 2개가 저장되었습니다. 이는 공개키이며 비밀번호가 아니고, 개인키는 전송·기록하지 않습니다. 아래 자동 시험 당시 저장 위치 설명은 그대로 보존하며 이후 사용자 확인의 구글 비밀번호 관리자와 구분합니다.

```json
{
  "registrationChallenges": [
    "Jipp5Z9IWvYD26WPpZwGSBw9pQykR0LCf9cDyf2D18s",
    "JBbW6dEwwLrqSXE_satG8-qH1KKkunWtprVkDpxPJWM"
  ],
  "loginChallenges": [
    "A_swa-IbB4CxULitnqL4yRqqMHfEYwNOTDhdjiQFcRg",
    "6QeckqtMtckxUWz4qkvUUuFyyonrnqt3SBxGMAqswzE"
  ],
  "storedPublicKeys": [
    {
      "id": "aNHESKE-M_cnIhTPcV29gTQLBqWHCzFKlIvfkD9ClmQ",
      "name": "운영 자동 시험 A 첫 가상 인증기",
      "createdAt": "2026-10-15T05:16:31.996Z",
      "publicKey": "pQECAyYgASFYIJxCzb0s3_wNZvKGafQd0wHROh27swELdmBP9v1ShET0Ilgg4j60kwvkAmKhefZUs8vdIoit02UOaW5yKUCUklYR64g",
      "deviceType": "singleDevice",
      "backedUp": false,
      "transports": [
        "internal"
      ]
    },
    {
      "id": "mu-6dT_xK7vMAAT18kJpYvn7nvlbSI9oyX0Fkyn4BJM",
      "name": "운영 자동 시험 A 예비 가상 인증기",
      "createdAt": "2026-10-15T05:16:42.899Z",
      "publicKey": "pQECAyYgASFYIKRDVvk-L681g9DXr1VNRF7XpZU0NEjKiKDn6-XSj8kQIlggTix3_Lp8WNSqVnV1uMjXvIc6oqaIb-mpyKwgrCNORUY",
      "deviceType": "singleDevice",
      "backedUp": false,
      "transports": [
        "internal"
      ]
    }
  ],
  "storageLocation": "Chromium 메모리의 서로 독립한 가상 WebAuthn 인증기 2개입니다. 사용자 실제 저장 위치는 확인하지 않았습니다."
}
```

운영 서버로 보낸 등록 요청·응답 원본 한 건입니다. 등록 확인 데이터와 공개키 관련 필드가 있으며 개인키·비밀번호는 없습니다.

```json
{
  "label": "서비스 화면이 실제로 보낸 요청",
  "actor": "가상 계정 A",
  "request": {
    "method": "POST",
    "path": "/api/passkeys/register/verify",
    "cookie": "[가림]",
    "body": {
      "challengeId": "449674dc-3697-4605-a47d-628cca5c8d7a",
      "response": {
        "id": "aNHESKE-M_cnIhTPcV29gTQLBqWHCzFKlIvfkD9ClmQ",
        "rawId": "aNHESKE-M_cnIhTPcV29gTQLBqWHCzFKlIvfkD9ClmQ",
        "response": {
          "attestationObject": "o2NmbXRkbm9uZWdhdHRTdG10oGhhdXRoRGF0YVikYk7Y1DPOWFBvDJV7tmQ0mNNcyC4Qhm-YQb7XYJTXWBhFAAAAAQECAwQFBgcIAQIDBAUGBwgAIGjRxEihPjP3JyIUz3FdvYE0CwalhwsxSpSL35A_QpZkpQECAyYgASFYIJxCzb0s3_wNZvKGafQd0wHROh27swELdmBP9v1ShET0Ilgg4j60kwvkAmKhefZUs8vdIoit02UOaW5yKUCUklYR64g",
          "clientDataJSON": "eyJ0eXBlIjoid2ViYXV0aG4uY3JlYXRlIiwiY2hhbGxlbmdlIjoiQ0dMTVdrX3Jobk9oOUExaU94WGdSZE03SWFsSjl3cWM1cWotNzVLLUxRcyIsIm9yaWdpbiI6Imh0dHBzOi8vc2t0LWFsZXBoLXByb2plY3QtMS52ZXJjZWwuYXBwIiwiY3Jvc3NPcmlnaW4iOmZhbHNlfQ",
          "transports": [
            "internal"
          ],
          "publicKeyAlgorithm": -7,
          "publicKey": "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEnELNvSzf_A1m8oZp9B3TAdE6HbuzAQt2YE_2_VKERPTiPrSTC-QCYqF59lSzy90iiK3TZQ5pbnIpQJSSVhHriA",
          "authenticatorData": "Yk7Y1DPOWFBvDJV7tmQ0mNNcyC4Qhm-YQb7XYJTXWBhFAAAAAQECAwQFBgcIAQIDBAUGBwgAIGjRxEihPjP3JyIUz3FdvYE0CwalhwsxSpSL35A_QpZkpQECAyYgASFYIJxCzb0s3_wNZvKGafQd0wHROh27swELdmBP9v1ShET0Ilgg4j60kwvkAmKhefZUs8vdIoit02UOaW5yKUCUklYR64g"
        },
        "type": "public-key",
        "clientExtensionResults": {
          "credProps": {
            "rk": true
          }
        },
        "authenticatorAttachment": "platform"
      }
    }
  },
  "response": {
    "status": 200,
    "body": {
      "registered": true,
      "user": {
        "id": "c29e9d3c-bf3b-406e-be7f-04699d17033a",
        "name": "prod-mv93637i-d8b509-a"
      }
    }
  }
}
```

## ④ 안 열리는 것을 확인한 기록

아래의 **운영 추가 확인**은 실제 운영 HTTPS 서버에 가상 인증기로 접속한 기록입니다. 이어지는 최초 로컬 원본은 보존합니다. 두 환경 모두 사용자 실제 기기 시험으로 표시하지 않습니다. 성공·거절 값은 실제 증거 JSON에서 옮겼습니다.

### 운영 추가 확인: 네 가지 성공·거절과 세션 폐기

| 확인 | 실제 정상 요청·응답 | 실제 거절 요청·응답 |
|---|---|---|
| 로그인 없이 열기 | A의 GET /api/private/items → 200·합성 항목 3개입니다. | 비로그인 같은 GET → 401·패스키로 로그인해 주세요. |
| 남의 패스키·자료 | A·B 본인 키 로그인과 본인 자료는 200입니다. | B 키로 A 로그인 401, A→B·B→A 자료 요청은 각각 403입니다. |
| 질문 재사용·서명 | 정상 서명 검증은 200입니다. | 변조 서명 401, 성공한 질문·서명 재전송은 400입니다. |
| 삭제 후 로그인 | 첫 키 삭제 후 예비 키로 200입니다. | 삭제 키 401, 마지막 키 삭제 후 로그인 401·익명 재등록 409·구 세션 401입니다. |

운영 로그아웃 전 쿠키를 재전송하면 401입니다. HttpOnly·Secure·SameSite=Strict를 실제 응답에서 확인했습니다. 계정 자료는 A·B 각각 3→3개로 유지되며 URL에 상대 userId·owner를 넣어도 세션 본인 자료만 반환했습니다.

운영 요청 일부의 핵심 필드를 아래 JSON에 직접 발췌했습니다. Cookie·Set-Cookie는 [가림]을 유지했습니다. 생략한 서명 전체와 나머지 80개 요청의 원본은 위 production-evidence.json에 있습니다.

```json
{
  "unauthenticated": {
    "label": "로그인 없는 비공개 자료 조회",
    "actor": "가상 계정 A",
    "request": {
      "method": "GET",
      "path": "/api/private/items",
      "cookie": "[가림]"
    },
    "response": {
      "status": 401,
      "body": {
        "error": "패스키로 로그인해 주세요."
      }
    }
  },
  "normalRead": {
    "label": "A 정상 자료 조회",
    "actor": "가상 계정 A",
    "request": {
      "method": "GET",
      "path": "/api/private/items",
      "cookie": "[가림]"
    },
    "response": {
      "status": 200,
      "body": {
        "owner": "c29e9d3c-bf3b-406e-be7f-04699d17033a",
        "synthetic": true,
        "items": [
          {
            "id": "17987a0a-f4db-47d7-98d5-de4299c90ba1",
            "body": "prod-mv93637i-d8b509-a의 합성 자료입니다. 종이비행기 분류 도구의 화면을 준비합니다.",
            "title": "가상 프로젝트 메모"
          },
          {
            "id": "df4d9516-8181-4844-8d41-4773c1cacb52",
            "body": "prod-mv93637i-d8b509-a의 합성 자료입니다. 가상 연구실 달빛 1호와 별빛 2호를 비교합니다.",
            "title": "가상 관심 목록"
          },
          {
            "id": "80518e1d-68d7-4b78-ac7c-05f8f71e04fc",
            "body": "prod-mv93637i-d8b509-a의 합성 자료입니다. 오늘은 예제 자료로 패스키 동작을 연습했습니다.",
            "title": "가상 연습 회고"
          }
        ]
      }
    }
  },
  "aToB": {
    "label": "A에서 B 자료 접근 거절",
    "actor": "가상 계정 A",
    "request": {
      "method": "GET",
      "path": "/api/private/accounts/35064275-86a2-4ad1-b871-e83e1ce2accb/items",
      "cookie": "[가림]"
    },
    "response": {
      "status": 403,
      "body": {
        "error": "다른 계정의 비공개 자료는 볼 수 없습니다."
      }
    }
  },
  "bToA": {
    "label": "B에서 A 자료 접근 거절",
    "actor": "가상 계정 B",
    "request": {
      "method": "GET",
      "path": "/api/private/accounts/c29e9d3c-bf3b-406e-be7f-04699d17033a/items",
      "cookie": "[가림]"
    },
    "response": {
      "status": 403,
      "body": {
        "error": "다른 계정의 비공개 자료는 볼 수 없습니다."
      }
    }
  },
  "countsBefore": {
    "a": 3,
    "b": 3
  },
  "countsAfter": {
    "a": 3,
    "b": 3
  },
  "logout": {
    "label": "로그아웃 뒤 세션 폐기 확인",
    "actor": "가상 계정 A",
    "request": {
      "method": "POST",
      "path": "/api/logout",
      "cookie": "[가림]",
      "body": {}
    },
    "response": {
      "status": 200,
      "body": {
        "loggedOut": true
      },
      "setCookie": "[가림]"
    }
  },
  "staleSession": {
    "label": "로그아웃 전 쿠키 값을 다시 전송",
    "actor": "가상 계정 A",
    "request": {
      "method": "GET",
      "path": "/api/private/items",
      "cookie": "[가림]"
    },
    "response": {
      "status": 401,
      "body": {
        "error": "패스키로 로그인해 주세요."
      }
    }
  }
}
```

운영 정상 서명·변조·재사용·타인 키의 실제 요청·응답을 발췌합니다. 요청 본문의 필드는 원본 값이며 다음 블록에서는 credential ID·challengeId·서명 값을 원본에서 발췌합니다. 각 전체 응답 본문은 그대로 옮겼습니다.

```json
[
  {
    "label": "A 본인 패스키 정상 로그인: 서명 검증",
    "request": {
      "method": "POST",
      "path": "/api/passkeys/login/verify",
      "cookie": "[가림]",
      "body": {
        "challengeId": "bd30826e-3dcc-48df-8dec-2e1fd8706c72",
        "credentialId": "mu-6dT_xK7vMAAT18kJpYvn7nvlbSI9oyX0Fkyn4BJM",
        "signature": "MEQCIF1yJMajEKnHjXMrmgnFZr4AKGuDGeQ87qWwznrmblBoAiBO65GA3AqAnkKnVtaF-MDNBrCWAXk6fWAHGupd_D7Mww"
      }
    },
    "response": {
      "status": 200,
      "body": {
        "authenticated": true,
        "user": {
          "id": "c29e9d3c-bf3b-406e-be7f-04699d17033a",
          "name": "prod-mv93637i-d8b509-a"
        }
      },
      "setCookie": "[가림]"
    }
  },
  {
    "label": "변조 서명 거절",
    "request": {
      "method": "POST",
      "path": "/api/passkeys/login/verify",
      "cookie": "[가림]",
      "body": {
        "challengeId": "18053181-03f4-4901-bcec-457c9c050173",
        "credentialId": "mu-6dT_xK7vMAAT18kJpYvn7nvlbSI9oyX0Fkyn4BJM",
        "signature": "MEUCIQCHOAdKEbTjQ707Al29hmqk26r8oxOqT9D-o1wGYj7W8gIgaj6Ebj1BmGgcOU5661joe_INfiGY3wd0j1kYnEQJHsY"
      }
    },
    "response": {
      "status": 401,
      "body": {
        "error": "패스키 서명을 확인하지 못했습니다."
      }
    }
  },
  {
    "label": "이미 성공한 질문·서명 재사용",
    "request": {
      "method": "POST",
      "path": "/api/passkeys/login/verify",
      "cookie": "[가림]",
      "body": {
        "challengeId": "bd30826e-3dcc-48df-8dec-2e1fd8706c72",
        "credentialId": "mu-6dT_xK7vMAAT18kJpYvn7nvlbSI9oyX0Fkyn4BJM",
        "signature": "MEQCIF1yJMajEKnHjXMrmgnFZr4AKGuDGeQ87qWwznrmblBoAiBO65GA3AqAnkKnVtaF-MDNBrCWAXk6fWAHGupd_D7Mww"
      }
    },
    "response": {
      "status": 400,
      "body": {
        "error": "로그인 질문을 이미 사용했거나 찾을 수 없습니다. 다시 시작해 주세요."
      }
    }
  },
  {
    "label": "B 패스키 서명으로 A 로그인 시도",
    "request": {
      "method": "POST",
      "path": "/api/passkeys/login/verify",
      "cookie": "[가림]",
      "body": {
        "challengeId": "f84a0ed5-59b1-49a0-a879-b9370ca6e21a",
        "credentialId": "Io7SjzdDFuYL0t8Swcc0OjW5OvRXXlGvoHVkvxVVSY4",
        "signature": "MEYCIQC90g_k9wiPgzXbwj2Lc5TEGXmILzwC3crugqi3t9aUPAIhANS_OfbQ8GbWJQe1LZ6zTLMSAaOLGcU21W4HlI4S5q5n"
      }
    },
    "response": {
      "status": 401,
      "body": {
        "error": "이 계정에 등록된 패스키로 로그인해 주세요."
      }
    }
  }
]
```

운영 삭제 후 남은 키 성공·삭제 키 거절·0개 상태의 실제 요청 일부입니다. 서명 원본은 같은 증거 파일에 있고 아래에는 핵심 요청 필드와 실제 응답을 옮깁니다.

```json
[
  {
    "label": "삭제된 패스키의 실제 서명 거절",
    "request": {
      "method": "POST",
      "path": "/api/passkeys/login/verify",
      "cookie": "[가림]",
      "body": {
        "challengeId": "ec1c2795-bd71-4314-95a8-7d022584c1f7",
        "credentialId": "aNHESKE-M_cnIhTPcV29gTQLBqWHCzFKlIvfkD9ClmQ"
      }
    },
    "response": {
      "status": 401,
      "body": {
        "error": "이 계정에 등록된 패스키로 로그인해 주세요."
      }
    }
  },
  {
    "label": "남은 예비 패스키 로그인: 서명 검증",
    "request": {
      "method": "POST",
      "path": "/api/passkeys/login/verify",
      "cookie": "[가림]",
      "body": {
        "challengeId": "257fbdd5-af28-48fb-af7d-c35b1e7607af",
        "credentialId": "mu-6dT_xK7vMAAT18kJpYvn7nvlbSI9oyX0Fkyn4BJM"
      }
    },
    "response": {
      "status": 200,
      "body": {
        "authenticated": true,
        "user": {
          "id": "c29e9d3c-bf3b-406e-be7f-04699d17033a",
          "name": "prod-mv93637i-d8b509-a"
        }
      },
      "setCookie": "[가림]"
    }
  },
  {
    "label": "패스키 0개 계정 로그인",
    "request": {
      "method": "POST",
      "path": "/api/passkeys/login/options",
      "cookie": "[가림]",
      "body": {
        "name": "prod-mv93637i-d8b509-a"
      }
    },
    "response": {
      "status": 401,
      "body": {
        "error": "이 계정에서 사용할 수 있는 패스키가 없습니다. 별칭과 등록 상태를 확인해 주세요."
      }
    }
  },
  {
    "label": "패스키 0개 계정의 익명 재등록 거절",
    "request": {
      "method": "POST",
      "path": "/api/passkeys/register/options",
      "cookie": "[가림]",
      "body": {
        "name": "prod-mv93637i-d8b509-a",
        "credentialName": "0개 계정 재등록 시도"
      }
    },
    "response": {
      "status": 409,
      "body": {
        "error": "이미 있는 별칭입니다. 기존 패스키로 로그인한 뒤 추가해 주세요."
      }
    }
  },
  {
    "label": "마지막 키 삭제 전 세션 재사용",
    "request": {
      "method": "GET",
      "path": "/api/private/items",
      "cookie": "[가림]"
    },
    "response": {
      "status": 401,
      "body": {
        "error": "패스키로 로그인해 주세요."
      }
    }
  }
]
```

### 최초 로컬 시험 원본

아래 네 확인과 코드 블록은 최초 로컬 시험의 원본 값입니다. 운영 재검증 결과가 생겼어도 이전 질문·키·시각을 덮어쓰지 않았습니다.

### 확인 1: 로그인 없이 열기

| 구분 | 실제 요청 | 실제 응답 |
|---|---|---|
| 인증된 정상 조회 | GET /api/private/items, Cookie: [가림] | 200, owner=5a4a48bd-cbc6-45ac-afb4-140548cfe031, 가상 항목 3개 |
| 비로그인 거절 | GET /api/private/items, 인증 쿠키 없음 | 401, 패스키로 로그인해 주세요. |

인증된 성공은 카드 5의 가상 인증기 로그인 후 요청이며, 비로그인 거절은 카드 1의 별도 HTTP 시험입니다. 성공·거절이 같은 세션으로 수행되었다고 주장하지 않습니다. 비로그인 공개 페이지는 200이고 비공개 표식은 없습니다.

```json
{
  "success": {
    "label": "A의 정상 조회",
    "request": {
      "method": "GET",
      "path": "/api/private/items",
      "cookie": "[가림]"
    },
    "response": {
      "status": 200,
      "body": {
        "owner": "5a4a48bd-cbc6-45ac-afb4-140548cfe031",
        "synthetic": true,
        "items": [
          {
            "id": "ba6b7bc0-5d7f-4c40-adc2-fd62506aa7c7",
            "title": "가상 프로젝트 메모",
            "body": "virtual-a의 합성 자료입니다. 종이비행기 분류 도구의 화면을 준비합니다."
          },
          {
            "id": "4c96f517-19c7-44c2-b6f5-fb4ad077c5e3",
            "title": "가상 관심 목록",
            "body": "virtual-a의 합성 자료입니다. 가상 연구실 달빛 1호와 별빛 2호를 비교합니다."
          },
          {
            "id": "6c65e436-73e8-4769-adcf-9ba54be143ab",
            "title": "가상 연습 회고",
            "body": "virtual-a의 합성 자료입니다. 오늘은 예제 자료로 패스키 동작을 연습했습니다."
          }
        ]
      }
    }
  },
  "rejection": {
    "request": "GET /api/private/items",
    "status": 401,
    "response": {
      "error": "패스키로 로그인해 주세요."
    }
  },
  "publicPage": {
    "status": 200,
    "privateMarkerPresent": false
  }
}
```

### 확인 2: 남의 패스키로 들어가 남의 자료 열기

두 가상 계정에 각각 패스키를 등록한 뒤 각 계정으로 로그인했습니다. 본인 조회는 200이며 다른 계정 경로는 양방향 모두 403입니다.

| 구분 | 실제 요청 | 실제 응답 |
|---|---|---|
| A의 본인 자료 | GET /api/private/items, A Cookie: [가림] | 200, owner=5a4a48bd-cbc6-45ac-afb4-140548cfe031, 3개 |
| A에서 B로 | GET /api/private/accounts/0f8418db-32ab-4fcd-a4fc-516e3e69dc8b/items, A Cookie: [가림] | 403, 다른 계정의 비공개 자료는 볼 수 없습니다. |
| B의 본인 자료 | GET /api/private/items, B Cookie: [가림] | 200, owner=0f8418db-32ab-4fcd-a4fc-516e3e69dc8b, 3개 |
| B에서 A로 | GET /api/private/accounts/5a4a48bd-cbc6-45ac-afb4-140548cfe031/items, B Cookie: [가림] | 403, 다른 계정의 비공개 자료는 볼 수 없습니다. |

```json
{
  "aSuccess": {
    "label": "A의 정상 조회",
    "request": {
      "method": "GET",
      "path": "/api/private/items",
      "cookie": "[가림]"
    },
    "response": {
      "status": 200,
      "body": {
        "owner": "5a4a48bd-cbc6-45ac-afb4-140548cfe031",
        "synthetic": true,
        "items": [
          {
            "id": "ba6b7bc0-5d7f-4c40-adc2-fd62506aa7c7",
            "title": "가상 프로젝트 메모",
            "body": "virtual-a의 합성 자료입니다. 종이비행기 분류 도구의 화면을 준비합니다."
          },
          {
            "id": "4c96f517-19c7-44c2-b6f5-fb4ad077c5e3",
            "title": "가상 관심 목록",
            "body": "virtual-a의 합성 자료입니다. 가상 연구실 달빛 1호와 별빛 2호를 비교합니다."
          },
          {
            "id": "6c65e436-73e8-4769-adcf-9ba54be143ab",
            "title": "가상 연습 회고",
            "body": "virtual-a의 합성 자료입니다. 오늘은 예제 자료로 패스키 동작을 연습했습니다."
          }
        ]
      }
    }
  },
  "aToBRejection": {
    "label": "A에서 B로 접근",
    "request": {
      "method": "GET",
      "path": "/api/private/accounts/0f8418db-32ab-4fcd-a4fc-516e3e69dc8b/items",
      "cookie": "[가림]"
    },
    "response": {
      "status": 403,
      "body": {
        "error": "다른 계정의 비공개 자료는 볼 수 없습니다."
      }
    }
  },
  "bSuccess": {
    "label": "B의 정상 조회",
    "request": {
      "method": "GET",
      "path": "/api/private/items",
      "cookie": "[가림]"
    },
    "response": {
      "status": 200,
      "body": {
        "owner": "0f8418db-32ab-4fcd-a4fc-516e3e69dc8b",
        "synthetic": true,
        "items": [
          {
            "id": "5bbfdb5b-00f9-4560-937d-d92ddc8a886a",
            "title": "가상 프로젝트 메모",
            "body": "virtual-b의 합성 자료입니다. 종이비행기 분류 도구의 화면을 준비합니다."
          },
          {
            "id": "f7454a35-127f-4154-83ff-aa326e711a20",
            "title": "가상 관심 목록",
            "body": "virtual-b의 합성 자료입니다. 가상 연구실 달빛 1호와 별빛 2호를 비교합니다."
          },
          {
            "id": "84c4bb76-95af-4bc3-a946-7218bc70cfcc",
            "title": "가상 연습 회고",
            "body": "virtual-b의 합성 자료입니다. 오늘은 예제 자료로 패스키 동작을 연습했습니다."
          }
        ]
      }
    }
  },
  "bToARejection": {
    "label": "B에서 A로 접근",
    "request": {
      "method": "GET",
      "path": "/api/private/accounts/5a4a48bd-cbc6-45ac-afb4-140548cfe031/items",
      "cookie": "[가림]"
    },
    "response": {
      "status": 403,
      "body": {
        "error": "다른 계정의 비공개 자료는 볼 수 없습니다."
      }
    }
  },
  "countsBefore": {
    "a": 3,
    "b": 3
  },
  "countsAfter": {
    "a": 3,
    "b": 3
  }
}
```

상대 자료 건수는 A 3→3개, B 3→3개로 유지되었습니다. URL의 userId·owner를 상대 계정으로 바꾸어도 서버 세션 본인의 owner와 자료만 200으로 돌아왔습니다. 아래 두 요청도 기록에 있습니다. 거절과 조회 범위 결정 소스는 server/app.mjs 62~67행입니다.

```json
{
  "aSpoofedQuery": {
    "label": "A가 주소에 B를 지정",
    "request": {
      "method": "GET",
      "path": "/api/private/items?userId=0f8418db-32ab-4fcd-a4fc-516e3e69dc8b&owner=0f8418db-32ab-4fcd-a4fc-516e3e69dc8b",
      "cookie": "[가림]"
    },
    "response": {
      "status": 200,
      "body": {
        "owner": "5a4a48bd-cbc6-45ac-afb4-140548cfe031",
        "synthetic": true,
        "items": [
          {
            "id": "ba6b7bc0-5d7f-4c40-adc2-fd62506aa7c7",
            "title": "가상 프로젝트 메모",
            "body": "virtual-a의 합성 자료입니다. 종이비행기 분류 도구의 화면을 준비합니다."
          },
          {
            "id": "4c96f517-19c7-44c2-b6f5-fb4ad077c5e3",
            "title": "가상 관심 목록",
            "body": "virtual-a의 합성 자료입니다. 가상 연구실 달빛 1호와 별빛 2호를 비교합니다."
          },
          {
            "id": "6c65e436-73e8-4769-adcf-9ba54be143ab",
            "title": "가상 연습 회고",
            "body": "virtual-a의 합성 자료입니다. 오늘은 예제 자료로 패스키 동작을 연습했습니다."
          }
        ]
      }
    }
  },
  "bSpoofedQuery": {
    "label": "B가 주소에 A를 지정",
    "request": {
      "method": "GET",
      "path": "/api/private/items?userId=5a4a48bd-cbc6-45ac-afb4-140548cfe031&owner=5a4a48bd-cbc6-45ac-afb4-140548cfe031",
      "cookie": "[가림]"
    },
    "response": {
      "status": 200,
      "body": {
        "owner": "0f8418db-32ab-4fcd-a4fc-516e3e69dc8b",
        "synthetic": true,
        "items": [
          {
            "id": "5bbfdb5b-00f9-4560-937d-d92ddc8a886a",
            "title": "가상 프로젝트 메모",
            "body": "virtual-b의 합성 자료입니다. 종이비행기 분류 도구의 화면을 준비합니다."
          },
          {
            "id": "f7454a35-127f-4154-83ff-aa326e711a20",
            "title": "가상 관심 목록",
            "body": "virtual-b의 합성 자료입니다. 가상 연구실 달빛 1호와 별빛 2호를 비교합니다."
          },
          {
            "id": "84c4bb76-95af-4bc3-a946-7218bc70cfcc",
            "title": "가상 연습 회고",
            "body": "virtual-b의 합성 자료입니다. 오늘은 예제 자료로 패스키 동작을 연습했습니다."
          }
        ]
      }
    }
  }
}
```

### 확인 3: 이미 쓴 질문 재사용과 서명 실패

| 구분 | 실제 요청 | 실제 응답 |
|---|---|---|
| 정상 서명 | POST /api/passkeys/login/verify, challengeId=df57f9b2-3fd4-4abd-8c03-e88ea5f8064a | 200, authenticated=true |
| 같은 질문·서명 재전송 | 위와 동일한 challengeId·response를 그대로 재전송 | 400, 로그인 질문을 이미 사용했거나 찾을 수 없습니다. 다시 시작해 주세요. |
| 변조 서명 | POST /api/passkeys/login/verify, challengeId=1881b18c-6ada-41ef-a178-d7fedb667539 | 401, 패스키 서명을 확인하지 못했습니다. |

```json
{
  "success": {
    "request": {
      "method": "POST",
      "path": "/api/passkeys/login/verify",
      "cookie": "[가림]",
      "body": {
        "challengeId": "df57f9b2-3fd4-4abd-8c03-e88ea5f8064a",
        "response": {
          "id": "Z9gM03SUA-PROMrcSA9ZGJYD2SlVwA-imE9RpLiGIok",
          "rawId": "Z9gM03SUA-PROMrcSA9ZGJYD2SlVwA-imE9RpLiGIok",
          "response": {
            "authenticatorData": "SZYN5YgOjGh0NBcPZHZgW4_krrmihjLHmVzzuoMdl2MFAAAAAw",
            "clientDataJSON": "eyJ0eXBlIjoid2ViYXV0aG4uZ2V0IiwiY2hhbGxlbmdlIjoiSUF5c0ZBRHBFbmtHdE1yRU0zQi1oUk96cWVpX0ExU01yQlk1NHluX05XVSIsIm9yaWdpbiI6Imh0dHA6Ly9sb2NhbGhvc3Q6NTQwMDYiLCJjcm9zc09yaWdpbiI6ZmFsc2V9",
            "signature": "MEYCIQCQs3L0bA7_9dhHjeZ_s0IIEU8ogrqoI_6-qJQ0pXVwDgIhAIsCKoe8egL0VKFKnUxZubHU8k6nyjQJl0nBIQ9LVI33",
            "userHandle": "YzBjYThkZDctNzA0Yi00NDNmLWJkMzktOTQwODZlODAwZjli"
          },
          "type": "public-key",
          "clientExtensionResults": {},
          "authenticatorAttachment": "platform"
        }
      }
    },
    "response": {
      "status": 200,
      "body": {
        "authenticated": true,
        "user": {
          "id": "c0ca8dd7-704b-443f-bd39-94086e800f9b",
          "name": "virtual-a"
        }
      },
      "setCookie": "[가림]"
    }
  },
  "replayRejection": {
    "request": {
      "method": "POST",
      "path": "/api/passkeys/login/verify",
      "cookie": "[가림]",
      "body": {
        "challengeId": "df57f9b2-3fd4-4abd-8c03-e88ea5f8064a",
        "response": {
          "id": "Z9gM03SUA-PROMrcSA9ZGJYD2SlVwA-imE9RpLiGIok",
          "rawId": "Z9gM03SUA-PROMrcSA9ZGJYD2SlVwA-imE9RpLiGIok",
          "response": {
            "authenticatorData": "SZYN5YgOjGh0NBcPZHZgW4_krrmihjLHmVzzuoMdl2MFAAAAAw",
            "clientDataJSON": "eyJ0eXBlIjoid2ViYXV0aG4uZ2V0IiwiY2hhbGxlbmdlIjoiSUF5c0ZBRHBFbmtHdE1yRU0zQi1oUk96cWVpX0ExU01yQlk1NHluX05XVSIsIm9yaWdpbiI6Imh0dHA6Ly9sb2NhbGhvc3Q6NTQwMDYiLCJjcm9zc09yaWdpbiI6ZmFsc2V9",
            "signature": "MEYCIQCQs3L0bA7_9dhHjeZ_s0IIEU8ogrqoI_6-qJQ0pXVwDgIhAIsCKoe8egL0VKFKnUxZubHU8k6nyjQJl0nBIQ9LVI33",
            "userHandle": "YzBjYThkZDctNzA0Yi00NDNmLWJkMzktOTQwODZlODAwZjli"
          },
          "type": "public-key",
          "clientExtensionResults": {},
          "authenticatorAttachment": "platform"
        }
      }
    },
    "response": {
      "status": 400,
      "body": {
        "error": "로그인 질문을 이미 사용했거나 찾을 수 없습니다. 다시 시작해 주세요."
      }
    }
  },
  "invalidSignatureRejection": {
    "request": {
      "method": "POST",
      "path": "/api/passkeys/login/verify",
      "cookie": "[가림]",
      "body": {
        "challengeId": "1881b18c-6ada-41ef-a178-d7fedb667539",
        "response": {
          "id": "Z9gM03SUA-PROMrcSA9ZGJYD2SlVwA-imE9RpLiGIok",
          "rawId": "Z9gM03SUA-PROMrcSA9ZGJYD2SlVwA-imE9RpLiGIok",
          "response": {
            "authenticatorData": "SZYN5YgOjGh0NBcPZHZgW4_krrmihjLHmVzzuoMdl2MFAAAAAg",
            "clientDataJSON": "eyJ0eXBlIjoid2ViYXV0aG4uZ2V0IiwiY2hhbGxlbmdlIjoiRHNpcXQzNGlWNU55dW1Rc1A0Nms4b19FbmxnX2FVbUI4Tk5SMHZKY3hrWSIsIm9yaWdpbiI6Imh0dHA6Ly9sb2NhbGhvc3Q6NTQwMDYiLCJjcm9zc09yaWdpbiI6ZmFsc2V9",
            "signature": "MEUCIQC3LgnJdLiHerCoMasBFhMuGB5O8luAhFl3a5o2GE5K1gIgD5UOgpYb0JztS_KdrE8NpnwirOV2d-Foi_nF7CLKaOY",
            "userHandle": "YzBjYThkZDctNzA0Yi00NDNmLWJkMzktOTQwODZlODAwZjli"
          },
          "type": "public-key",
          "clientExtensionResults": {},
          "authenticatorAttachment": "platform"
        }
      }
    },
    "response": {
      "status": 401,
      "body": {
        "error": "패스키 서명을 확인하지 못했습니다."
      }
    }
  }
}
```

로그인 뒤 식별 방식은 위에서 설명한 30분 서버 세션입니다. POST /api/logout의 정상 응답은 200·loggedOut=true였고, 로그아웃 전 쿠키를 다시 보내 GET /api/private/items를 요청하면 401로 거절되었습니다. 쿠키 값은 가렸습니다.

```json
{
  "logout": {
    "request": {
      "method": "POST",
      "path": "/api/logout",
      "cookie": "[가림]",
      "body": {}
    },
    "response": {
      "status": 200,
      "body": {
        "loggedOut": true
      },
      "setCookie": "[가림]"
    }
  },
  "staleSession": {
    "request": "GET /api/private/items",
    "cookie": "[가림]",
    "response": {
      "status": 401,
      "body": {
        "error": "패스키로 로그인해 주세요."
      }
    }
  },
  "cookieFlags": {
    "httpOnly": true,
    "sameSite": "Strict",
    "secure": false,
    "note": "localhost 시험에서는 Secure가 false입니다. HTTPS 운영 쿠키는 Secure입니다."
  },
  "passwordInputCount": 0
}
```

### 확인 4: 패스키 삭제 뒤 로그인

한 계정에 독립 가상 인증기 A·B로 등록한 패스키 2개가 있었습니다. 각각의 이름과 등록 날짜를 화면에 표시했습니다.

```json
{
  "registered": [
    {
      "id": "hknMXKAOALV406BLn9_1oPJI0cnlUW21lD-8015UlI0",
      "name": "가상 인증기 A",
      "createdAt": "2026-10-15T04:20:15.052Z",
      "publicKey": "pQECAyYgASFYIJc4NRbEerwSdS5pkgT5soBg6CwzuA8BMjcoW9sqXj_kIlgglcJQ36dDV7ANmtFo8GZ4yN9TYleKNdAx-McUwIWuSZo"
    },
    {
      "id": "1Mx1PPkv33-N_5bUBFDQTtdLcLbEaW88IYeeBxyAgK0",
      "name": "가상 인증기 B",
      "createdAt": "2026-10-15T04:20:15.147Z",
      "publicKey": "pQECAyYgASFYII9qnp0ceVTYZFrtBwhDoVGF6FEbUDCtCSzZ65biuVvDIlggt4_5Ejkz0rkxb9FEBR-Y383cvjI5V5yjHDd-3det63I"
    }
  ],
  "deleteFirst": {
    "request": {
      "method": "DELETE",
      "path": "/api/passkeys/hknMXKAOALV406BLn9_1oPJI0cnlUW21lD-8015UlI0",
      "cookie": "[가림]"
    },
    "response": {
      "status": 200,
      "body": {
        "deleted": true,
        "remaining": 1,
        "loggedOut": false,
        "message": "패스키를 삭제했습니다. 남은 패스키 1개를 사용할 수 있습니다."
      }
    }
  }
}
```

| 구분 | 실제 요청 | 실제 응답 |
|---|---|---|
| 남은 B로 로그인 | POST /api/passkeys/login/verify, credential ID=1Mx1PPkv33-N_5bUBFDQTtdLcLbEaW88IYeeBxyAgK0 | 200, authenticated=true |
| 삭제한 A로 로그인 | POST /api/passkeys/login/verify, credential ID=hknMXKAOALV406BLn9_1oPJI0cnlUW21lD-8015UlI0 | 401, 이 계정에 등록된 패스키로 로그인해 주세요. |

삭제한 키 음성 시험에서는 클라이언트의 allowCredentials 목록만 삭제된 A의 ID로 바꾸어 서명을 생성했습니다. 서버의 키 저장 상태·질문·검증기를 바꾸지 않았습니다. 이는 삭제된 키를 서버가 거절하는지 확인하기 위한 시험이며 실제 사용자 키를 삭제한 기록이 아닙니다.

```json
{
  "remainingKeySuccess": {
    "request": {
      "method": "POST",
      "path": "/api/passkeys/login/verify",
      "cookie": "[가림]",
      "body": {
        "challengeId": "91426ed8-7274-420f-a057-162fdf30f826",
        "response": {
          "id": "1Mx1PPkv33-N_5bUBFDQTtdLcLbEaW88IYeeBxyAgK0",
          "rawId": "1Mx1PPkv33-N_5bUBFDQTtdLcLbEaW88IYeeBxyAgK0",
          "response": {
            "authenticatorData": "SZYN5YgOjGh0NBcPZHZgW4_krrmihjLHmVzzuoMdl2MFAAAAAg",
            "clientDataJSON": "eyJ0eXBlIjoid2ViYXV0aG4uZ2V0IiwiY2hhbGxlbmdlIjoia1Rwci10TlJPSU9MQnhuVlNtVmNYLUlQVE9PTmlEVkZpSVpxUThxTmtWbyIsIm9yaWdpbiI6Imh0dHA6Ly9sb2NhbGhvc3Q6NTgzMjYiLCJjcm9zc09yaWdpbiI6ZmFsc2V9",
            "signature": "MEUCIGl13G0acI1v5vafvJp-wS2fTLCv1W6COc0IaC1aNDBXAiEAx8R429RNbwc378ZzvQJUX9Tg2bMgmCJpAvImYKgx948",
            "userHandle": "Njk3NzVkODItNzYwOS00NWNlLWI0MjMtNWVjZmFiODYxZWU4"
          },
          "type": "public-key",
          "clientExtensionResults": {},
          "authenticatorAttachment": "platform"
        }
      }
    },
    "response": {
      "status": 200,
      "body": {
        "authenticated": true,
        "user": {
          "id": "69775d82-7609-45ce-b423-5ecfab861ee8",
          "name": "virtual-a"
        }
      },
      "setCookie": "[가림]"
    }
  },
  "deletedKeyRejection": {
    "request": {
      "method": "POST",
      "path": "/api/passkeys/login/verify",
      "cookie": "[가림]",
      "body": {
        "challengeId": "84a197a2-8f84-41bf-b0a1-2664572d173a",
        "response": {
          "id": "hknMXKAOALV406BLn9_1oPJI0cnlUW21lD-8015UlI0",
          "rawId": "hknMXKAOALV406BLn9_1oPJI0cnlUW21lD-8015UlI0",
          "response": {
            "authenticatorData": "SZYN5YgOjGh0NBcPZHZgW4_krrmihjLHmVzzuoMdl2MFAAAAAg",
            "clientDataJSON": "eyJ0eXBlIjoid2ViYXV0aG4uZ2V0IiwiY2hhbGxlbmdlIjoianZQVFBDc0xKVHlSSGdLb3BuY1RwQlVuNVZCVm5UWUlOd3dSZW15MF83NCIsIm9yaWdpbiI6Imh0dHA6Ly9sb2NhbGhvc3Q6NTgzMjYiLCJjcm9zc09yaWdpbiI6ZmFsc2V9",
            "signature": "MEQCICC1H64Wu9oiFJp7L5E4HrkVQRudmTy8EclWFFNLmXC6AiAZvpxcCJdFhaPASo3yaSdFIQk3_avWDwNrp8OpLT-_3g",
            "userHandle": "Njk3NzVkODItNzYwOS00NWNlLWI0MjMtNWVjZmFiODYxZWU4"
          },
          "type": "public-key",
          "clientExtensionResults": {},
          "authenticatorAttachment": "platform"
        }
      }
    },
    "response": {
      "status": 401,
      "body": {
        "error": "이 계정에 등록된 패스키로 로그인해 주세요."
      }
    }
  },
  "negativeTestMethod": "삭제된 키로 서명하기 위해 클라이언트 allowCredentials만 삭제된 키 ID로 바꾸었습니다. 서버 검증과 저장 상태는 바꾸지 않았습니다."
}
```

마지막 B 삭제 후에는 remaining=0·loggedOut=true였고 새 로그인 질문 요청도 401로 거절되었습니다. 비밀번호·이메일 복구 기능은 없습니다. 계정과 가상 자료는 남습니다.

```json
{
  "deleteLast": {
    "request": {
      "method": "DELETE",
      "path": "/api/passkeys/1Mx1PPkv33-N_5bUBFDQTtdLcLbEaW88IYeeBxyAgK0",
      "cookie": "[가림]"
    },
    "response": {
      "status": 200,
      "body": {
        "deleted": true,
        "remaining": 0,
        "loggedOut": true,
        "message": "마지막 패스키를 삭제했습니다. 모든 세션을 종료했으며 이 계정에 다시 로그인할 수 없습니다. 계정과 가상 자료는 남지만 복구 수단은 없습니다."
      }
    }
  },
  "noPasskeyLoginRejection": {
    "request": {
      "method": "POST",
      "path": "/api/passkeys/login/options",
      "cookie": "[가림]",
      "body": {
        "name": "virtual-a"
      }
    },
    "response": {
      "status": 401,
      "body": {
        "error": "이 계정에서 사용할 수 있는 패스키가 없습니다. 별칭과 등록 상태를 확인해 주세요."
      }
    }
  },
  "lastKeyPolicy": "패스키 0개면 기존 계정 로그인과 비밀번호·이메일 복구를 제공하지 않습니다. 기존 가상 자료는 삭제하지 않습니다."
}
```

### 화면·원자료 위치

- 카드 1: verification/card1/public-and-locked.png, locked.png, synthetic-unlocked.png, unauthenticated.html, http-evidence.json, browser-evidence.json입니다.
- 카드 2: verification/card2/registered.png, cancelled.png, registration-evidence.json입니다. 취소는 NotAllowedError 모의 시험이며 실제 기기 취소는 미확인입니다.
- 카드 3: verification/card3/logged-in.png, logged-out.png, authentication-evidence.json입니다.
- 카드 4: verification/card4/two-passkeys.png, remaining-passkey-login.png, no-passkeys.png, deletion-evidence.json입니다.
- 카드 5: verification/card5/account-a.png, account-b.png, isolation-evidence.json, browser-export.json입니다.

## ⑤ AI와 나

- **AI에게 맡긴 일:** 기존 소개에 비공개 공간과 패스키 등록·로그인·로그아웃·키 관리·서버 계정 제한 코드를 추가하고, 가상 인증기 자동 시험과 요청·응답 증거·설명서·제출 초안을 작성하도록 맡겼습니다.
- **내가 직접 판단한 일:** 사용자는 T08-C11에 맞춰 기존 과제 1을 직접 수정하고 공개 내용을 유지하기로 결정했습니다. 카드 1~5 순서, 기준 47개 전수 검증, 단계별 증거 보고, 제출 조건 확인을 명시적으로 승인했습니다.
- **AI 제안을 따르지 않은 일:** AI의 별도 과제 8 저장소 제안을 따르지 않았습니다. 사용자가 “1번에서 만든 것을 수정해야 하는 것 아니냐”고 지적하여 기존 과제 1에 이어 붙이는 방식으로 정정했습니다.

사용자의 실제 저장 위치·두 키 등록·하나 삭제 뒤 남은 키 로그인 성공은 위 직접 응답으로 기록했습니다. 자동 시험의 요청·응답을 사용자의 실제 동작 기록으로 바꾸지 않았습니다.

## ⑥ 아직 못 막은 것

1. **실제 기기의 일부 실패 동작은 사용자 확인이 없습니다.** 사용자는 구글 비밀번호 관리자·로그인·패스키 2개 등록·1개 삭제·남은 키 로그인 성공을 직접 확인했습니다. 실제 기기 취소·삭제된 실제 키의 서명 401·0개 정책은 직접 확인했다고 답하지 않았습니다. 삭제 키·0개 상태는 운영 가상 인증기 자동 시험으로만 검증했습니다. 같은 동기화 보관함의 두 패스키가 물리적으로 독립된 복구 수단이라는 판단도 하지 않았습니다.
2. **시험 합성 계정과 자료가 남습니다.** 이번 운영 자동 시험의 가상 계정 2개는 합성 자료 각 3개를 남깁니다. 시험 패스키는 모두 삭제해 aPasskeys=0·bPasskeys=0입니다. 이 결과를 계정·자료 전체 삭제로 표현하지 않습니다.
3. **마지막 패스키를 모두 잃거나 삭제하면 기존 계정으로 돌아갈 수 없습니다.** 비밀번호·이메일·복구 코드가 없습니다. 마지막 키 삭제 후 모든 세션을 끝내며 기존 계정·합성 자료는 남습니다. 실제 운영 자동 시험에서도 로그인 401·익명 재등록 409·구 세션 401로 확인했습니다.
4. **단일 상태 행의 확장 한계가 있습니다.** server/pg-store.mjs 95행의 SELECT … FOR UPDATE와 108행의 전체 JSON 갱신은 상태 변경을 직렬화합니다. 자료 증가에 따른 복제·쓰기 비용과 다수 사용자 부하·장기 운영 규모를 검증하지 않았습니다. DB 연결·지속 저장 성공은 이런 확장성 검증을 뜻하지 않습니다.
5. **전체 개인정보 부재와 공식 제출은 자동 판정하지 않았습니다.** 기존 소개의 이름·공개 GitHub 링크는 사용자의 공개 내용 보존 승인에 따라 유지했습니다. 새 시험 자료는 합성 내용이고 비밀값은 가렸습니다. 기계적 패턴 findings=[]는 기존 실명까지 포함해 모든 개인정보가 없다는 판정이 아닙니다. 결과물·소스 URL은 제출 화면에 초안으로 입력했지만 실제 제출·파일 업로드·접수·심사·승인은 확인하지 않았습니다.

과거 관찰: verification/public-access.json의 초기 미리보기는 Vercel 로그인 보호였고 운영 승격 전 CLI 탐색도 302였습니다. 이후 verification/production/deployment.json의 운영 승격과 http-evidence.json의 공개 앱 200을 확인했습니다. 과거 보호 관찰을 현재 운영 상태로 사용하지 않습니다.

현재 접수 화면은 공개 결과물 URL 또는 PDF·DOCX·MD·TXT 보고서 한 파일을 허용하지만, C01·C02의 URL 두 개 공식 제출 기준은 별도입니다. 이 단독 MD는 로컬 원본과 운영 추가 확인을 모두 포함합니다. **운영 자동 시험 통과와 공식 47개 기준 전체 완주·실제 기기·공식 접수·승인은 구분합니다.**
