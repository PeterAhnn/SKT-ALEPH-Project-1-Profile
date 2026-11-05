"""Build the allowlisted BR-B portable package without publishing it."""
from pathlib import Path
import hashlib
import json
import zipfile


ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "career" / "apps" / "login-policy"
OUTPUT = ROOT / "output" / "brb"
ARCHIVE_NAME = "BR-B-안형섭-로그인정책비교앱.zip"
MAX_BYTES = 8_000_000
APP_FILES = (
    "index.html",
    "engine.mjs",
    "app.mjs",
    "styles.css",
    "data/paper-data.json",
    "README.md",
)

README = """# 로그인 정책 비교 앱 · 실행 묶음

이 앱은 로그인 방어 정책을 검토하는 사람이 요청 분포에 따른 공격 차단과 정상 요청 손실을 함께 비교하도록 돕습니다. T10 논문의 원본 합성 요청을 브라우저에서 계산합니다. 실제 운영 서비스의 효과나 개인정보 자료를 뜻하지 않습니다.

## 준비와 실행

Node.js 24가 필요합니다. Node.js 설치 후 인터넷 연결·npm 설치·계정·API 키·환경 변수 설정 없이 실행합니다. ZIP 안에서 파일을 직접 열지 말고 새 폴더에 모두 풉니다.

1. ZIP을 새 폴더에 모두 풉니다. 그 폴더에서 터미널을 엽니다.
2. `node serve.mjs`를 실행합니다. 포트가 사용 중이면 `node serve.mjs 8014`를 실행합니다.
3. 브라우저에서 `http://127.0.0.1:8013/`을 엽니다. 다른 포트를 지정했다면 주소의 포트도 바꿉니다. 안내 화면에서 앱 또는 논문을 엽니다.

서버는 이 컴퓨터의 127.0.0.1에서만 열립니다. 종료하려면 터미널에서 Ctrl+C를 누릅니다. 기존 소개 사이트의 계정 DB나 .env 파일을 읽지 않습니다.

## 앱에서 할 일 세 가지

1. 조건을 선택합니다. 요청 분포와 개별 시드 또는 전체 시드를 구분하고 한도 5회 또는 10회를 고릅니다. 시간 창은 60초로 고정합니다.
2. 정책 비교를 실행합니다. IP·계정·복합 기준의 공격 차단과 정상 요청 손실을 읽습니다. 직접 입력은 논문의 원래 시드·전체 집계와 구분한 별도 예시입니다.
3. 결과를 저장합니다. 저장한 결과의 조건·지표·합성 실험 범위를 확인합니다.

처음 화면에는 논문 제목과 앱이 누구를 어떻게 돕는지 보여야 합니다. 잘못된 값을 넣으면 수정 안내가 보이고 조건을 고쳐 비교를 다시 실행할 수 있어야 합니다. 원래 설정은 각 제한 기준에 공통으로 적용한 한도 5회(주분석) 또는 10회(민감도 분석)와 시간 창 60초이며, 개별 시드와 전체 집계는 구분합니다. 이 숫자는 실제 서비스에 권장하는 운영 설정이 아닙니다.

## 직접 입력의 형식

화면에서 직접 입력을 선택하면 1~500건의 JSON 배열을 사용할 수 있습니다. 각 객체의 필수 항목은 `timeMs`, `ipId`, `accountId`, `actorLabel`, `credentialValid`입니다. 형식 예시는 다음과 같습니다.

```json
[
  {"timeMs": 0, "ipId": "syn-demo-ip-1", "accountId": "syn-demo-account-1", "actorLabel": "attack", "credentialValid": false},
  {"timeMs": 1000, "ipId": "syn-demo-ip-1", "accountId": "syn-demo-account-2", "actorLabel": "benign", "credentialValid": true}
]
```

`timeMs`는 0 이상의 안전한 정수 밀리초입니다. `ipId`와 `accountId`는 `syn-` 뒤에 영문·숫자·밑줄·하이픈 1~80자를 붙인 예시 식별자만 사용합니다. `actorLabel`은 `attack` 또는 `benign`, `credentialValid`는 불리언입니다. 실제 IP 주소·계정·실명·연락처·비밀값을 입력하지 않습니다.

선택 항목은 요청마다 중복 없는 `requestId`, 같은 시각의 순서를 정하는 0 이상의 안전한 정수 `originalIndex`, 독립된 실행을 구분하는 `runId`입니다. 생략하면 자동 요청 ID·배열 순번·단일 실행을 사용합니다. 같은 `runId` 안에서는 시각과 `originalIndex`로 정렬하며 서로 다른 `runId`의 제한기 이력은 섞지 않습니다. 자세한 제약은 `app/README.md`를 확인합니다. 직접 입력 예시는 논문의 수치 재현과 구분합니다.

## 파일 위치

- `app/index.html`: 앱의 첫 화면입니다.
- `app/engine.mjs`: 합성 요청을 정책별로 계산하는 코드입니다.
- `app/app.mjs`: 조건·비교·저장 동작입니다.
- `app/styles.css`: 앱 화면 스타일입니다.
- `app/data/paper-data.json`: 논문에서 사용한 합성 데이터입니다.
- `app/README.md`: 앱의 목적·제약·실행 방법입니다.
- `paper/T10-paper.md`: 기존 사이트에 공개한 논문 MD 사본입니다.
- `serve.mjs`: 추가 패키지 없이 실행하는 로컬 서버입니다.
- `SHA256SUMS`: 자신을 제외한 각 포함 파일의 SHA-256입니다.

논문은 로컬 서버의 `/paper.html`에서 읽거나 `/paper/T10-paper.md`에서 받을 수 있습니다. 로컬 논문 화면은 포함된 MD를 문자 그대로 표시하므로 별도 렌더링 라이브러리가 필요하지 않습니다. 앱 계산과 저장은 브라우저에서 수행합니다. 이 묶음에는 인증 DB·패스키·리추얼 원문·비밀값·실제 이용자 기록을 포함하지 않습니다.

## 문제가 생겼을 때

- 파일을 직접 여는 file:// 방식 대신 위 HTTP 주소로 엽니다. 데이터를 fetch하는 브라우저 기능에는 HTTP가 필요합니다.
- `node`를 찾을 수 없으면 Node.js 24 설치 상태를 확인하고 터미널을 다시 엽니다.
- 포트 오류가 나면 `node serve.mjs 8014`로 바꾸고 `http://127.0.0.1:8014/`를 엽니다.
- 파일이 없다는 안내가 나오면 ZIP을 모두 풀었는지, `app/data/paper-data.json`이 있는지 확인합니다.
- 저장 파일은 브라우저의 다운로드 위치에서 확인합니다. 브라우저가 저장을 막았다면 허용 여부를 확인한 뒤 다시 저장합니다.

공개 배포와 플랫폼 제출 상태는 이 실행 묶음의 작동 여부와 별도로 확인합니다. 동료의 실제 감상이나 사용자 완성 판단을 자동 검사 결과로 대신하지 않습니다.
"""


def main():
    entries = {f"app/{name}": (APP / name).read_bytes() for name in APP_FILES}
    entries["paper/T10-paper.md"] = (ROOT / "career" / "downloads" / "T10-paper.md").read_bytes()
    entries["serve.mjs"] = (ROOT / "tools" / "brb" / "serve.mjs").read_bytes()
    entries["README.md"] = README.encode("utf-8")
    entries["SHA256SUMS"] = "".join(
        f"{hashlib.sha256(data).hexdigest()}  {name}\n"
        for name, data in sorted(entries.items())
    ).encode("utf-8")

    OUTPUT.mkdir(parents=True, exist_ok=True)
    archive = OUTPUT / ARCHIVE_NAME
    temporary = OUTPUT / f"{ARCHIVE_NAME}.tmp"
    try:
        with zipfile.ZipFile(temporary, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as bundle:
            for name, data in sorted(entries.items()):
                metadata = zipfile.ZipInfo(name, (1980, 1, 1, 0, 0, 0))
                metadata.compress_type = zipfile.ZIP_DEFLATED
                metadata.create_system = 3
                metadata.external_attr = 0o100644 << 16
                bundle.writestr(metadata, data, compresslevel=9)
        if temporary.stat().st_size > MAX_BYTES:
            raise RuntimeError("ZIP이 8,000,000바이트를 넘었습니다. 공개 파일 크기를 확인해 주세요.")
        temporary.replace(archive)
    finally:
        if temporary.exists():
            temporary.unlink()

    sha256 = hashlib.sha256(archive.read_bytes()).hexdigest()
    (OUTPUT / f"{ARCHIVE_NAME}.sha256").write_text(f"{sha256}  {ARCHIVE_NAME}\n", encoding="utf-8")
    print(json.dumps({
        "archive": str(archive),
        "files": len(entries),
        "bytes": archive.stat().st_size,
        "maxBytes": MAX_BYTES,
        "sha256": sha256,
        "allowlistedOnly": True,
        "verification": "CRC·압축 해제·새 임시 폴더 실행은 별도 검사에서 확인합니다.",
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
