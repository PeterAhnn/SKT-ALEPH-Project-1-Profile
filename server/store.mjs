import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export function emptyState() {
  return { users: {}, credentials: {}, challenges: {}, sessions: {}, rates: {} };
}

// Local development only. Serializes changes and atomically replaces the file.
export class LocalStore {
  #state;
  #tail = Promise.resolve();
  constructor({ path, state = emptyState() } = {}) { this.path = path; this.#state = state; }
  async transact(action) {
    const previous = this.#tail;
    let release;
    this.#tail = new Promise(resolve => { release = resolve; });
    await previous;
    try {
      if (this.path) {
        try { this.#state = JSON.parse(await readFile(this.path, 'utf8')); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
      }
      const draft = structuredClone(this.#state);
      const result = await action(draft);
      if (this.path) {
        await mkdir(dirname(this.path), { recursive: true });
        const temp = `${this.path}.${process.pid}.tmp`;
        await writeFile(temp, JSON.stringify(draft), { mode: 0o600 });
        await rename(temp, this.path);
      }
      this.#state = draft;
      return result;
    } finally { release(); }
  }
}

export class UnavailableStore {
  async transact() { const error = new Error('저장소 연결을 준비하고 있습니다. 잠시 후 다시 시도해 주세요.'); error.status = 503; throw error; }
}
