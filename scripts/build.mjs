import { mkdir, copyFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { careerPublicFiles } from '../tools/bra/public-files.mjs';
await mkdir('public/assets', { recursive: true });
for (const file of ['index.html', 'assets/private.css', 'assets/private.mjs']) await copyFile(file, `public/${file}`);
await copyFile('node_modules/@simplewebauthn/browser/dist/bundle/index.umd.min.js', 'public/assets/webauthn.js');
for (const [file] of careerPublicFiles) {
  const destination = `public/career/${file}`;
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(`career/${file}`, destination);
}
console.log('공개 파일만 public에 복사했습니다.');
