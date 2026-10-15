import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const findings = [];
let checkedFiles = 0;
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.name === 'private') continue;
    if (entry.isDirectory()) { await walk(path); continue; }
    if (!/\.(md|json|mjs|html|css|sql)$/i.test(path)) continue;
    const text = await readFile(path, 'utf8');
    checkedFiles++;
    for (const [name, pattern] of [
      ['개인키 PEM', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
      ['DB 접속 비밀값', /postgres(?:ql)?:\/\/[^\s:/]+:[^\s@]+@(?!(?:HOST|host)\b)/],
      ['Bearer 비밀값', /Bearer\s+[A-Za-z0-9_-]{20,}/],
      ['가리지 않은 쿠키 기록', /"(?:cookie|setCookie)"\s*:\s*"(?!\[가림\])[^"\r\n]+"/],
    ]) if (pattern.test(text)) findings.push({ path, name });
  }
}
for (const dir of ['assets', 'api', 'server', 'tests', 'scripts', 'docs', 'verification', 'contracts']) await walk(dir);
assert.deepEqual(findings, [], '공개 예정 파일에 비밀값 의심 항목이 있습니다.');
const report = await readFile('docs/AUTH-EXPLANATION.md', 'utf8');
assert.equal([...report.matchAll(/^## [①②③④⑤⑥]/gm)].length, 6);
for (const match of report.matchAll(/```json\s*([\s\S]*?)```/g)) JSON.parse(match[1]);
const submission = await readFile('docs/SUBMISSION.md', 'utf8');
const checks = submission.slice(submission.indexOf('어디로 가나요:'), submission.indexOf('## AI와 내 판단')).replace(/\r\n/g, '\n').trim();
const decisions = submission.slice(submission.indexOf('AI에게 맡긴 일:'), submission.indexOf('## 접수 조건')).replace(/\r\n/g, '\n').trim();
assert.equal(checks.split('\n').length, 4);
assert.equal(decisions.split('\n').length, 3);
assert.ok(checks.length <= 1500);
assert.ok(decisions.length <= 1500);
const result = { checkedAt: new Date().toISOString(), checkedFiles, findings, authExplanationBytes: Buffer.byteLength(report), maxFiles: 10, totalByteLimit: 8 * 1024 * 1024, proposedAttachmentCount: 1, proposedAttachmentWithinLimit: Buffer.byteLength(report) <= 8 * 1024 * 1024, checkTextLength: checks.length, decisionTextLength: decisions.length, note: '기계적인 비밀값 패턴 검사와 문서 형식 검사입니다. 모든 개인정보 부재나 운영·실기·공식 제출 완료를 자동 판정하지 않습니다. 기존 공개 소개의 이름·공개 GitHub 링크는 사용자 승인에 따라 보존했습니다.' };
await writeFile('verification/submission-readiness.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
