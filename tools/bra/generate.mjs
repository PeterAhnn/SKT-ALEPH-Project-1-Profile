import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { summarize } from './metrics.mjs';

export const outputFiles = ['data.json', 'candidates.json', 'candidates.md', 'manifest.json'];
const inputFiles = ['rituals.json', 'attendance.json', 'projects.json', 'approvals.json'];
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const sha256 = value => createHash('sha256').update(value).digest('hex');
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const textFields = /^(강점이 드러난 일화|강점을 위해 노력하고 생각한 것|내가 나눈 감사|나에게 남기는 말):\s*(.+)$/;
function redact(text) {
  if (/(?:bearer\s+\S+|(?:sk-|ghp_|github_pat_)[\w-]{12,}|-----BEGIN .*PRIVATE KEY|(?:password|token|api[_ -]?key)\s*[:=]\s*\S+)/i.test(text)) {
    throw new Error('후보 입력에 비밀값 의심 문구가 있습니다. 원문을 점검해 주세요.');
  }
  return text.replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '(연락처 가림)').replace(/01[016789][- ]?\d{3,4}[- ]?\d{4}/g, '(연락처 가림)');
}
export function makeCandidates(rituals) {
  const evidence = Array.isArray(rituals.evidence) ? [...rituals.evidence] : [];
  for (const day of rituals.days) for (const kind of ['open', 'close']) {
    if (!Array.isArray(day[kind])) continue;
    for (const line of day[kind]) {
      const match = textFields.exec(line);
      if (match) evidence.push({ date: day.date, kind, sourceField: match[1], text: match[2] });
    }
  }
  const candidates = new Map();
  for (const item of evidence) {
    if (!['open', 'close'].includes(item.kind) || typeof item.text !== 'string' || !item.text.trim() || typeof item.sourceField !== 'string' || !item.sourceField.trim()) throw new Error('문단 근거의 형식이 올바르지 않습니다.');
    const day = rituals.days.find(day => day.date === item.date);
    const value = day?.[item.kind];
    const contentCount = Array.isArray(value) ? value.filter(line => line.trim()).length : value;
    if (!day || !Number.isInteger(contentCount) || contentCount <= 0) throw new Error('내용이 있는 리추얼에 연결되지 않은 문단 근거입니다.');
    const evidenceText = redact(item.text.trim().normalize('NFC'));
    let ability;
    if (/상대|설명|질문|경청|기다|부탁|배려|오해/.test(evidenceText)) ability = '대인관계력';
    else if (/시간|계획|메모|미루|마무리|정리/.test(evidenceText)) ability = '자기조절력';
    else if (/부족|노력|따라가|포기|배우|확인|해결|힘들/.test(evidenceText)) ability = '자기동기력';
    else continue;
    const source = `리추얼 기록 · ${item.date} ${item.kind === 'open' ? '아침' : '마무리'} · ${item.sourceField}`;
    const id = sha256(json({ date: item.date, kind: item.kind, ability, evidenceText, source })).slice(0, 20);
    const text = `${item.date}에 남긴 기록에는 “${evidenceText}”라고 적혀 있다. 이 행동은 ${ability}을 돌아보는 근거다.`;
    candidates.set(id, { id, date: item.date, ability, text, source, evidenceText });
  }
  return [...candidates.values()].sort((a, b) => compare(`${a.date}:${a.id}`, `${b.date}:${b.id}`));
}
export async function generate(inputDirectory, outputDirectory) {
  const inputPath = resolve(inputDirectory);
  const outPath = resolve(outputDirectory);
  const relation = relative(outPath, inputPath);
  if (inputPath === outPath || (!relation.startsWith(`..${sep}`) && relation !== '..' && !relation.startsWith(sep) && !/^[A-Za-z]:/.test(relation))) throw new Error('결과 폴더는 입력 폴더를 포함할 수 없습니다.');
  const raw = await Promise.all(inputFiles.map(file => readFile(resolve(inputPath, file))));
  const [rituals, attendance, projects, approvals] = raw.map(bytes => JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, '')));
  const summary = summarize({ rituals, attendance, projects });
  if (approvals.asOf !== summary.asOf || !Array.isArray(approvals.approvedCandidateIds) || approvals.approvedCandidateIds.some(id => typeof id !== 'string')) throw new Error('승인 목록의 기준일 또는 형식이 올바르지 않습니다.');
  const candidates = makeCandidates(rituals);
  const ids = new Set(candidates.map(item => item.id));
  const approvedIds = new Set(approvals.approvedCandidateIds);
  if (approvedIds.size !== approvals.approvedCandidateIds.length || [...approvedIds].some(id => !ids.has(id))) throw new Error('중복되거나 현재 근거와 일치하지 않는 승인 ID가 있습니다. 후보를 다시 검토해 주세요.');
  const approvedParagraphs = candidates.filter(item => approvedIds.has(item.id)).map(({ evidenceText, ...paragraph }) => paragraph);
  const data = { ...summary, approvedParagraphs };
  const candidateDocument = `# 능력별 문단 후보\n\n기준일 ${summary.asOf}\n\n후보는 실제 기록을 정해 둔 규칙으로 분류한 AI의 해석이며 능력 검사 점수가 아닙니다. 자동으로 공개하지 않습니다. 본인 외 실명·연락처와 사실·공개 범위를 검토한 뒤 승인한 ID만 approvals.json에 적습니다.\n\n${candidates.map(item => `## ${item.date} ${item.ability}\n\n- ID: ${item.id}\n- 근거: ${item.source}\n- 현재 공개 반영: ${approvedIds.has(item.id) ? '승인됨' : '미승인'}\n\n${item.text}\n`).join('\n')}`;
  const results = { 'data.json': json(data), 'candidates.json': json(candidates), 'candidates.md': candidateDocument };
  const manifest = {
    version: 1, asOf: summary.asOf,
    inputs: inputFiles.map((file, index) => ({ file, sha256: sha256(raw[index]) })),
    outputs: Object.entries(results).map(([file, value]) => ({ file, sha256: sha256(value) })),
  };
  results['manifest.json'] = json(manifest);
  await mkdir(outPath, { recursive: true });
  for (const [file, value] of Object.entries(results)) await writeFile(resolve(outPath, file), value, 'utf8');
  return { data, candidates, manifest };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 4 || args[0] !== '--input' || args[2] !== '--out') throw new Error('사용법: node generate.mjs --input input --out last-result');
    const result = await generate(args[1], args[3]);
    console.log(`기준일 ${result.data.asOf}: 내용 기록 ${result.data.metrics.contentTotal}회, 후보 ${result.candidates.length}개, 승인 문단 ${result.data.approvedParagraphs.length}개를 생성했습니다.`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
