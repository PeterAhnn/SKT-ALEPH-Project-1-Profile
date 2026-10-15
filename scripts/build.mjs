import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('public/assets', { recursive: true });
for (const file of ['index.html', 'assets/private.css', 'assets/private.mjs']) await copyFile(file, `public/${file}`);
await copyFile('node_modules/@simplewebauthn/browser/dist/bundle/index.umd.min.js', 'public/assets/webauthn.js');
console.log('공개 파일만 public에 복사했습니다.');
