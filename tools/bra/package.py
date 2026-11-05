"""Package only reviewed documents and the portable update device."""
from pathlib import Path, PurePosixPath
import hashlib
import json
import shutil
import subprocess
import tempfile
import zipfile

root = Path(__file__).resolve().parents[2]
output = root / "output" / "bra"
output.mkdir(parents=True, exist_ok=True)
entries = {}
for name in ("resume", "introduction", "experience"):
    entries[f"documents/{name}.md"] = (root / "career" / "downloads" / f"{name}.md").read_bytes()
for name in ("generate.mjs", "metrics.mjs", "verify.mjs", "README.md"):
    entries[f"device/{name}"] = (root / "tools" / "bra" / name).read_bytes()
for name in ("rituals", "attendance", "projects", "approvals"):
    entries[f"device/input/{name}.json"] = (root / "tools" / "bra" / "input" / f"{name}.json").read_bytes()
for name in ("data.json", "candidates.json", "candidates.md", "manifest.json"):
    entries[f"device/last-result/{name}"] = (root / "tools" / "bra" / "last-result" / name).read_bytes()
entries["device/verification.json"] = (root / "verification" / "bra" / "reproducibility.json").read_bytes()
entries["README.md"] = """# 안형섭 지원 문서와 기록 갱신 장치

기준일은 2026-10-20입니다. 보안컨설팅 지원을 위한 문서와 실행 장치입니다. 사용자 승인 후 https://skt-aleph-project-1.vercel.app/career/ 에 공개 배포했습니다. 플랫폼 제출은 아직 수행하지 않았습니다.

- documents/resume.md: 이력서입니다.
- documents/introduction.md: 자기소개서입니다. 사이트와 같은 본문을 사용합니다.
- documents/experience.md: 과제별 능력·상황·행동·결과를 담은 경력기술서입니다.
- device/README.md: Node.js 24를 사용하는 세 단계 실행 안내입니다.
- device/last-result: 기준일의 마지막 숫자·후보·입출력 해시입니다.
- device/verification.json: 새 폴더에서 두 번 실행한 결과와 마지막 결과가 일치한 실제 검사 기록입니다.
- MANIFEST.sha256: 이 묶음에 포함한 각 파일의 SHA-256입니다.

장치는 별도 설치·계정·API 키·외부 AI 호출 없이 실행합니다. 승인 전 후보는 사이트 숫자 파일에 포함되지 않습니다. 현재 후보는 7개이며 승인 문단은 0개입니다. 공개 사이트에는 검토한 data.json만 반영합니다.

본인 외 실명·연락처와 비밀값, 소설 원문·전체 리추얼 원자료·인증 DB는 이 묶음에 포함하지 않았습니다. 이력서의 이메일은 사용자가 공개하도록 지정한 연락 수단입니다. 다른 사람의 실명 표기를 제외한 T10 논문 공개 사본은 사이트에서 읽고 내려받습니다.

사용자는 현재 본편과 문서의 공개를 승인했습니다. 한 줄 소개의 본인 직접 작성 확인과 BR-A 동료 읽기 확인은 남아 있습니다. 공개 파일은 로그인 없이 HTTP 200으로 열리며 검토한 로컬 파일과 일치했습니다. 13번 앱 자리는 사용자가 확인한 일정 미정 상태입니다.
""".encode("utf-8")
manifest = "".join(f"{hashlib.sha256(data).hexdigest()}  {name}\n" for name, data in sorted(entries.items()))
entries["MANIFEST.sha256"] = manifest.encode("utf-8")
archive = output / "BR-A-안형섭-문서와장치.zip"
with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as bundle:
    for name, data in sorted(entries.items()):
        metadata = zipfile.ZipInfo(name, (1980, 1, 1, 0, 0, 0))
        metadata.compress_type = zipfile.ZIP_DEFLATED
        metadata.create_system = 3
        metadata.external_attr = 0o100644 << 16
        bundle.writestr(metadata, data, compresslevel=9)

node = shutil.which("node")
if not node:
    raise RuntimeError("Node.js 실행 파일을 찾을 수 없습니다.")
temporary = Path(tempfile.mkdtemp(prefix="package-replay-", dir=root / "verification" / "bra"))
with zipfile.ZipFile(archive) as bundle:
    if bundle.testzip() is not None:
        raise RuntimeError("ZIP CRC 검사가 실패했습니다.")
    for name in bundle.namelist():
        parsed = PurePosixPath(name)
        if parsed.is_absolute() or ".." in parsed.parts:
            raise RuntimeError("허용하지 않은 ZIP 경로입니다.")
    bundle.extractall(temporary)
device = temporary / "device"
subprocess.run([node, "generate.mjs", "--input", "input", "--out", "replayed-result"], cwd=device, check=True)
subprocess.run([node, "verify.mjs", "--input", "input", "--reference", "last-result", "--report", "package-verification.json"], cwd=device, check=True)
for name, data in entries.items():
    if (temporary / name).read_bytes() != data:
        raise RuntimeError("압축 해제 후 파일 대조가 실패했습니다.")
sha256 = hashlib.sha256(archive.read_bytes()).hexdigest()
(output / f"{archive.name}.sha256").write_text(f"{sha256}  {archive.name}\n", encoding="utf-8")
report = {"kind": "실제 ZIP CRC·압축 해제·파일 바이트·독립 실행·새 폴더 두 실행을 확인했습니다.", "archive": archive.name, "files": len(entries), "bytes": archive.stat().st_size, "sha256": sha256, "crc": True, "extractedFilesEqual": True, "standaloneReplay": True}
(root / "verification" / "bra" / "package-check.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report, ensure_ascii=False))
