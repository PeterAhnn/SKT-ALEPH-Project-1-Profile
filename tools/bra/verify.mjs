import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { outputFiles } from './generate.mjs';

const exec = promisify(execFile);
const args = process.argv.slice(2);
if (args.length !== 6 || args[0] !== '--input' || args[2] !== '--reference' || args[4] !== '--report') {
  console.error('사용법: node verify.mjs --input input --reference last-result --report verification.json'); process.exit(1);
}
try {
  const input = resolve(args[1]);
  const reference = resolve(args[3]);
  const temporary = await mkdtemp(join(tmpdir(), 'bra-reproduce-'));
  const generator = fileURLToPath(new URL('./generate.mjs', import.meta.url));
  const first = join(temporary, 'first');
  const second = join(temporary, 'second');
  await exec(process.execPath, [generator, '--input', input, '--out', first], { cwd: temporary });
  await exec(process.execPath, [generator, '--input', input, '--out', second], { cwd: temporary });
  const files = [];
  for (const file of outputFiles) {
    const [golden, one, two] = await Promise.all([reference, first, second].map(folder => readFile(join(folder, file))));
    files.push({ file, twoRunsEqual: one.equals(two), referenceEqual: one.equals(golden), sha256: createHash('sha256').update(one).digest('hex') });
  }
  const report = { kind: '새 임시 폴더에서 같은 입력을 두 번 실행한 실제 결과', node: process.version, passed: files.every(file => file.twoRunsEqual && file.referenceEqual), files };
  await mkdir(dirname(resolve(args[5])), { recursive: true });
  await writeFile(resolve(args[5]), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  if (!report.passed) throw new Error('두 실행 또는 마지막 결과와 다른 파일이 있습니다. 보고서를 확인해 주세요.');
  console.log('새 폴더의 두 실행과 마지막 결과 4개 파일이 바이트·SHA-256까지 일치합니다.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
