# T08 인증 구현 설명서 — 제출 보류 중인 MD 첨부 초안

- 작성일: 2026-10-15 (한국 표준시)
- 공식 출처: https://aleph-omega.vercel.app/cortex?panel=tasks
- 작업 대상: 기존 SKT-ALEPH-Project-1-Profile입니다. 공개 소개 내용은 유지하고 별도의 비공개 공간을 추가했습니다.
- 상태: 로컬 HTTP·Chromium 가상 WebAuthn 인증기 시험과 증거 문서화를 수행했습니다. 이 파일은 단독으로 읽을 수 있는 MD 보고서 초안이며 **현재 제출은 보류**합니다.
- 미완료: 실제 사용자 기기의 등록·취소·저장 위치·두 키 시험, 운영 DB 적용·연결, 운영 환경 변수 설정, T08 배포와 공개 접근 검증, 고정 전체 커밋 소스 URL 확인, 공식 접수·승인입니다.
- 실제 개인정보 대신 virtual-a·virtual-b 계정과 가상 프로젝트 메모·관심 목록·회고를 사용했습니다. 기록의 Cookie·Set-Cookie는 [가림]으로 보존합니다. 시험별 계정·키 ID가 다른 것은 분리된 로컬 시험을 각각 수행했기 때문입니다.

## ① 무엇으로 붙였나

Node.js 24용 서버에 SimpleWebAuthn 라이브러리를 사용했습니다. package.json에 고정한 버전은 @simplewebauthn/server 14.0.3, @simplewebauthn/browser 14.0.0입니다. 브라우저는 WebAuthn 등록·로그인 API를 호출하고 서버 라이브러리가 질문·출처·RP ID·사용자 확인·서명을 검증합니다.

로그인 뒤에는 **서버 측 세션**으로 계정을 식별합니다. 무작위 세션 값은 HttpOnly·SameSite=Strict 쿠키로 보내며 서버에는 그 값의 SHA-256 해시와 계정·인증 키·만료 시각을 보관합니다. 세션 수명은 30분, 일회용 질문 수명은 5분입니다. 운영 HTTPS에서는 Secure 쿠키를 사용하도록 구현했습니다. 실제 로컬 시험은 localhost HTTP이므로 cookieFlags.secure는 false입니다. 운영의 실제 쿠키 동작은 아직 검증하지 않았습니다.

로컬 시험은 Git에서 제외하는 JSON 상태 저장소를 사용했습니다. 운영용 PgStore는 pg 8.23.1을 사용해 PostgreSQL 트랜잭션으로 상태를 저장하도록 구현했으나, 운영 DB 스키마·역할 적용과 실제 운영 연결은 수행하지 않았습니다. 운영 설정이 없으면 비공개 API는 준비 중이라는 503 응답을 내도록 구현했습니다.

개인 Chrome과 분리한 Chromium 가상 인증기로 실제 브라우저 WebAuthn API와 서명을 실행했습니다. 이는 실제 사용자 기기·Windows Hello·구글 비밀번호 관리자·물리 보안 키의 사용 증거가 아닙니다. 사용자 패스키 저장 위치는 **미확인**입니다.

## ② 왜 그걸 골랐나

등록 응답과 로그인 서명을 검증할 때 출처·RP ID·질문·사용자 확인을 함께 확인하기 위해 SimpleWebAuthn을 선택했습니다. 계정별 비공개 자료를 서버에서 제한하고 로그아웃·키 삭제 후 인증 상태를 폐기하려고 서버 세션을 사용했습니다. 특정 라이브러리나 DB 제품은 공식 과제의 지정 조건이 아닙니다.

사용자는 AI가 제안한 별도 저장소 방식에 대해 T08-C11을 지적했고, 기존 과제 1을 직접 수정하고 공개 내용을 유지하라고 결정했습니다. 카드 1부터 5까지 순서대로 진행하고 47개 기준을 빠짐없이 검증하며 제출 요구사항까지 점검하도록 명시적으로 승인했습니다.

## ③ 어디를 어떻게 고쳤나

아래 행 번호는 2026-10-15에 실제 작업 파일을 대조한 값입니다. 소스 URL의 전체 커밋은 아직 미확정이므로 제출 전 최종 커밋에서 다시 확인해야 합니다.

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

## ④ 안 열리는 것을 확인한 기록

모든 기록은 로컬 자동 시험입니다. 운영 배포와 실제 사용자 기기의 통과 결과로 표시하지 않습니다. 성공·거절의 상태 코드와 본문은 각 JSON 파일의 실제 값을 옮겼습니다.

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

사용자가 실제 패스키 저장 위치·기기 시험 결과를 확인했다는 판단은 아직 기록하지 않았습니다.

## ⑥ 아직 못 막은 것

1. **실제 사용자 기기의 동작·저장 위치는 미확인입니다.** 자동 시험의 가상 인증기 결과만 있습니다. 실제 기기에서 등록·취소·두 키 사용·삭제 후 로그인과 저장 위치를 확인해야 합니다. 물리 기기 분실·동기화 계정 복구 결과는 이 시험으로 증명하지 못합니다.
2. **운영 배포·지속 저장 검증이 남았습니다.** verification/deployment-access.json은 상위 작업에서 직접 확인한 Vercel MCP 관리 API 읽기 응답입니다. peter-ahns-projects 범위에서 기존 skt-aleph-project-1-profile에 GET /v9/projects/{idOrName}을 요청하자 403·forbidden이었습니다. 이는 로컬 앱의 정상 계정 격리 거절 403과 다릅니다. 이후 상위 작업에서 공식 Vercel CLI 64.2.0의 기존 자격으로 project inspect를 실행하여 기존 프로젝트 ID·소유 팀·Node.js 24를 확인했습니다. **MCP 연결은 403이지만 CLI 대체 접근은 확인했으며, 아직 배포하지 않았습니다.** 남은 운영 조건은 DB SQL 사용자 승인·적용, 전용 환경 변수 구성, 실제 배포·지속 저장 검증입니다. SQL 승인에 대한 사용자 답변은 아직 없습니다. 운영에서 공개키·질문·세션이 유지되는지는 확인하지 못했습니다.
3. **마지막 패스키를 모두 잃거나 삭제하면 기존 계정으로 돌아갈 수 없습니다.** 비밀번호·이메일·복구 코드가 없습니다. 마지막 키 삭제는 모든 세션을 끝내며 기존 계정·가상 자료가 남습니다. 이 제한을 삭제 전 확인 문구와 삭제 후 메시지에 표시했습니다.
4. **운영 DB의 단일 상태 행은 확장에 한계가 있습니다.** server/pg-store.mjs 95행의 SELECT … FOR UPDATE로 한 행을 잠그고, 108행에서 전체 JSON 상태를 갱신합니다. 상태 변경 요청이 직렬화되고 자료가 커질수록 읽기·복제·쓰기 비용이 늘어납니다. 소규모 과제 구현이며 다수 사용자의 동시 요청 부하·장기 운영 규모를 검증하지 않았습니다.
5. **공개 자료 개인정보 점검과 고정 제출 소스는 확정 전입니다.** 기존 공개 소개 유지와 C12의 제출물 개인정보 금지 조건을 함께 검토해야 합니다. 새 시험 자료는 가상 내용이지만 전체 공개 소스·기존 소개·최종 첨부물 검사와 전체 커밋 확인은 남아 있습니다.

현재 접수 화면은 공개 결과물 URL 또는 PDF·DOCX·MD·TXT 보고서 한 파일을 허용하지만, 카드 C01·C02의 결과물·소스 HTTPS URL 제출 기준은 별도입니다. 이 MD 한 파일이 접수 형식에 맞더라도 **47개 기준 완주·운영 검증·공식 접수·승인 완료를 뜻하지 않습니다.**

