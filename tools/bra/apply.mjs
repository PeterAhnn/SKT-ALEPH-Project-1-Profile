import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { generate } from './generate.mjs';

const input = fileURLToPath(new URL('./input/', import.meta.url));
const output = fileURLToPath(new URL('./last-result/', import.meta.url));
const { data } = await generate(input, output);
await writeFile(new URL('../../career/data.json', import.meta.url), `${JSON.stringify(data, null, 2)}\n`, 'utf8');
console.log('숫자와 승인된 문단만 로컬 career/data.json에 반영했습니다. 공개 배포는 별도 검토가 필요합니다.');
