import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const baseline = await readFile('contracts/profile-baseline.html', 'utf8');
assert.equal(createHash('sha256').update(baseline.replace(/\r\n/g, '\n')).digest('hex'), '2a9efd3ac7e7ce294087180099339e1f13708b8a1783ad14be6bae0e70298a18', '과제 1 기준 파일이 변경되었습니다.');
const current = await readFile('index.html', 'utf8');
const restored = current.replace(/<!-- T08 ADDITION START -->[\s\S]*?<!-- T08 ADDITION END -->\r?\n?/g, '');
assert.ok(restored.replace(/\r\n/g, '\n') === baseline.replace(/\r\n/g, '\n'), '기존 공개 소개 내용이 변경되었습니다.');
assert.ok(!/type\s*=\s*["']password["']/i.test(current), '비밀번호 입력란이 있습니다.');
console.log('기존 공개 소개 원문 보존 및 비밀번호 입력란 부재 확인 완료');
const source = await readFile('docs/TASK-SOURCE.md', 'utf8');
const criteria = await readFile('docs/CRITERIA.md', 'utf8');
const official = [...source.matchAll(/T08-(C\d+) ([^\r\n]+)/g)].map(match => [match[1], match[2].trim()]);
const tracked = [...criteria.matchAll(/^\| T08-(C\d+) \| ([^|]+) \|/gm)].map(match => [match[1], match[2].trim()]);
assert.equal(official.length, 47);
assert.equal(new Set(official.map(row => row[0])).size, 47);
assert.deepEqual(tracked, official, '공식 기준 47개 추적표에 누락 또는 원문 변경이 있습니다.');
console.log('공식 기준 47개 원문·추적표 일치 확인 완료');
