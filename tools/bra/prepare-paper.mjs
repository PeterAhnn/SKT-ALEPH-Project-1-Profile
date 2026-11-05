import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const original = await readFile(resolve(root, '../SKT-ALEPH-Project-10-Paper/paper/T10-안형섭-논문.md'), 'utf8');
const paper = original.replace(/\r\n/g, '\n')
  .replace('Blocki와 Zhang의 DALock은', 'DALock 연구는')
  .replace(/^\[(\d+)\] .*?(\(\d{4}\)\.)/gm, '[$1] $2');
const note = '> 공개본 안내: 연구 내용과 수치는 원문을 유지했습니다. 참고문헌은 다른 사람의 실명을 제외하고 제목·발행기관·원문 주소로 표기했습니다. 부록의 재현 패키지는 T10에 별도로 제출한 자료를 가리킵니다.\n\n';
const publicPaper = paper.replace(/^(# [^\n]+\n\n)/, `$1${note}`);
const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
function inline(text) {
  return escape(text).replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g, '<a href="$2" rel="noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}
const lines = publicPaper.split('\n');
const blocks = [];
for (let index = 0; index < lines.length;) {
  let line = lines[index];
  if (!line.trim()) { index++; continue; }
  if (line.startsWith('```')) {
    const code = [];
    while (++index < lines.length && !lines[index].startsWith('```')) code.push(lines[index]);
    blocks.push(`<pre><code>${escape(code.join('\n'))}</code></pre>`); index++; continue;
  }
  const heading = /^(#{1,6}) (.+)$/.exec(line);
  if (heading) { blocks.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`); index++; continue; }
  if (line.startsWith('|') && /^\|[\s:|\-]+$/.test(lines[index + 1] || '')) {
    const cells = row => row.split('|').slice(1, -1).map(value => value.trim());
    const header = cells(line).map(value => `<th scope="col">${inline(value)}</th>`).join('');
    index += 2;
    const rows = [];
    while (index < lines.length && lines[index].startsWith('|')) {
      rows.push(`<tr>${cells(lines[index++]).map(value => `<td>${inline(value)}</td>`).join('')}</tr>`);
    }
    blocks.push(`<div class="table-scroll" tabindex="0" role="region" aria-label="논문 표 가로 스크롤"><table><thead><tr>${header}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`);
    continue;
  }
  if (line.startsWith('> ')) { blocks.push(`<aside class="paper-note">${inline(line.slice(2))}</aside>`); index++; continue; }
  const paragraph = [line];
  while (++index < lines.length && lines[index].trim() && !/^(#|\||```|> )/.test(lines[index])) paragraph.push(lines[index]);
  blocks.push(`<p>${inline(paragraph.join(' '))}</p>`);
}
const html = `<!doctype html>
<html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="안형섭의 합성 로그인 요청 제한 비교 논문"><title>로그인 요청 제한 비교 논문 | 안형섭</title><link rel="stylesheet" href="./career.css"><style>
.paper-header{padding:24px max(20px,calc((100% - 1000px)/2));border-bottom:1px solid #dce3ed;display:flex;gap:24px;flex-wrap:wrap}.paper{max-width:1000px;margin:0 auto;padding:48px 24px 80px;line-height:1.95;overflow-wrap:anywhere}.paper h1{font-size:clamp(1.7rem,4vw,2.6rem);line-height:1.5;letter-spacing:-.03em}.paper h2{margin-top:64px;font-size:1.7rem}.paper h3{margin-top:36px;font-size:1.2rem}.paper p{margin:20px 0}.paper a{text-decoration:underline;color:#2458b8}.paper code{font-family:Consolas,monospace;font-size:.88em;background:#eef2f7;padding:2px 5px;border-radius:3px}.paper pre{overflow:auto;padding:20px;background:#eef2f7}.paper pre code{padding:0}.paper-note{padding:18px 22px;background:#eef4ff;border-left:3px solid #3366e8;font-size:.9rem}.table-scroll{overflow-x:auto;margin:28px 0}.paper table{border-collapse:collapse;width:100%;font-size:.88rem;min-width:600px}.paper th,.paper td{border:1px solid #dce3ed;padding:12px;text-align:left;vertical-align:top}.paper th{background:#f4f7fb}.paper th:not(:first-child),.paper td:not(:first-child){min-width:85px}.paper *{max-width:100%}@media print{.paper-header{display:none}.paper{max-width:none;padding:0;font-size:10pt}.paper h2{break-after:avoid}.table-scroll{overflow:visible}.paper table{min-width:0;font-size:8pt}}
</style></head><body><header class="paper-header"><a href="./#work">소개 사이트로 돌아가기</a><a href="./downloads/T10-paper.md" download>논문 MD 받기</a></header><main class="paper">${blocks.join('\n')}</main></body></html>`;
await mkdir(resolve(root, 'career/downloads'), { recursive: true });
await writeFile(resolve(root, 'career/downloads/T10-paper.md'), publicPaper, 'utf8');
await writeFile(resolve(root, 'career/paper.html'), html, 'utf8');
const hash = text => createHash('sha256').update(text).digest('hex');
await writeFile(resolve(root, 'docs/bra/PAPER-PUBLIC-COPY.md'), `# T10 논문 공개 사본 대조\n\n원문은 수정하지 않았습니다. 공개 사본에서는 본문의 문헌 저자 이름과 참고문헌의 개인 저자 목록만 제거했고, 연구 제목·기관·연도·출처 주소·수치·해석을 유지했습니다. T10 원 제출물의 재현 ZIP은 이번 공개 파일에 포함하지 않습니다.\n\n- 원문 SHA-256: ${hash(original)}\n- 공개 MD SHA-256: ${hash(publicPaper)}\n- 공개 HTML SHA-256: ${hash(html)}\n- 공개 파일: career/paper.html, career/downloads/T10-paper.md\n`, 'utf8');
console.log('T10 원문을 보존하고 개인 저자명 표기만 정리한 공개 사본을 생성했습니다.');
