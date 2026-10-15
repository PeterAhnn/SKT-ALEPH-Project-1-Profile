import pg from 'pg';

const { Pool } = pg;
const stateCollections = ['users', 'credentials', 'challenges', 'sessions', 'rates'];

function unavailable() {
  return Object.assign(new Error('저장소에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.'), { status: 503 });
}

function isRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

// Reject values JSON.stringify would silently change or discard.
function validateJSON(value, ancestors = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (!Array.isArray(value) && !isRecord(value)) throw unavailable();
  if (ancestors.has(value) || Object.getOwnPropertySymbols(value).length) throw unavailable();
  ancestors.add(value);
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.hasOwn(value, index)) throw unavailable();
      validateJSON(value[index], ancestors);
    }
  } else {
    for (const item of Object.values(value)) validateJSON(item, ancestors);
  }
  ancestors.delete(value);
}

function validateState(state) {
  if (!isRecord(state) || stateCollections.some(key => !Object.hasOwn(state, key) || !isRecord(state[key]))) throw unavailable();
  validateJSON(state);
}

function poolOptions(connectionString, ca, production) {
  try {
    if (typeof connectionString !== 'string' || !connectionString.trim()) throw unavailable();
    const url = new URL(connectionString);
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.pathname.slice(1) || url.hash) throw unavailable();
    if (ca !== undefined && (typeof ca !== 'string' || !ca.trim())) throw unavailable();
    const host = url.hostname.replace(/^\[|\]$/g, '');
    const local = ['localhost', '127.0.0.1', '::1'].includes(host);
    const sslMode = url.searchParams.get('sslmode');
    if (sslMode === 'disable' && (production || !local)) throw unavailable();
    // Build explicit options instead of letting URL sslmode/sslrootcert override
    // certificate verification. Custom authorities may be supplied as PEM text.
    const ssl = !production && local && sslMode === 'disable'
      ? false
      : { rejectUnauthorized: true, ...(ca === undefined ? {} : { ca }) };
    return {
      host,
      port: url.port ? Number(url.port) : 5432,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: decodeURIComponent(url.pathname.slice(1)),
      ssl,
      max: 2,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 10000,
      statement_timeout: 10000,
      query_timeout: 12000,
      idle_in_transaction_session_timeout: 15000,
      application_name: 't08-profile-passkey',
    };
  } catch {
    // Neither the URL nor driver diagnostics may enter responses or logs.
    throw unavailable();
  }
}

/** Persistent implementation of LocalStore.transact(action). */
export class PgStore {
  #pool;

  constructor({ connectionString, ca, production = process.env.NODE_ENV === 'production' } = {}) {
    this.#pool = new Pool(poolOptions(connectionString, ca, production));
    // pg already removes failed idle clients; do not print connection details.
    this.#pool.on('error', () => {});
  }

  async transact(action) {
    if (typeof action !== 'function') throw new TypeError('저장소 작업 함수가 필요합니다.');
    let client;
    let transactionStarted = false;
    let actionFailure;
    let discardClient = false;
    try {
      client = await this.#pool.connect();
      await client.query('BEGIN');
      transactionStarted = true;
      const selected = await client.query("SELECT state FROM t08.app_state WHERE slot = 'main' FOR UPDATE");
      if (selected.rowCount !== 1) throw unavailable();
      validateState(selected.rows[0].state);
      const draft = structuredClone(selected.rows[0].state);
      let result;
      try {
        result = await action(draft);
      } catch (error) {
        actionFailure = { error };
        throw error;
      }
      validateState(draft);
      const updated = await client.query(
        "UPDATE t08.app_state SET state = $1::jsonb, updated_at = now() WHERE slot = 'main'",
        [JSON.stringify(draft)],
      );
      if (updated.rowCount !== 1) throw unavailable();
      const committed = await client.query('COMMIT');
      if (committed.command !== 'COMMIT') throw unavailable();
      transactionStarted = false;
      return result;
    } catch {
      discardClient = !actionFailure;
      if (client && transactionStarted) {
        try { await client.query('ROLLBACK'); }
        catch { discardClient = true; }
      }
      if (actionFailure) throw actionFailure.error;
      throw unavailable();
    } finally {
      // An uncertain connection is destroyed, so it cannot reenter the pool.
      if (client) client.release(discardClient);
    }
  }

  async close() {
    try { await this.#pool.end(); }
    catch { throw unavailable(); }
  }
}
