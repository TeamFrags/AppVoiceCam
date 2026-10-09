import pg from 'pg';
import { PGlite } from '@electric-sql/pglite';

export interface Queryable {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

export interface Db extends Queryable {
  /** Runs one or more statements without parameters (migrations). */
  exec(sql: string): Promise<void>;
  tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export function createPgDb(connectionString: string): Db {
  const pool = new pg.Pool({ connectionString, max: 10 });
  return {
    async query<T>(text: string, params: unknown[] = []) {
      const res = await pool.query(text, params);
      return { rows: res.rows as T[] };
    },
    async exec(sql) {
      await pool.query(sql);
    },
    async tx(fn) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const result = await fn({
          async query<T>(text: string, params: unknown[] = []) {
            const res = await client.query(text, params);
            return { rows: res.rows as T[] };
          },
        });
        await client.query('commit');
        return result;
      } catch (err) {
        await client.query('rollback');
        throw err;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

/** Embedded Postgres for development and tests. Omit dataDir for an in-memory database. */
export function createPgliteDb(dataDir?: string): Db {
  const lite = new PGlite(dataDir);
  return {
    async query<T>(text: string, params: unknown[] = []) {
      const res = await lite.query<T>(text, params);
      return { rows: res.rows };
    },
    async exec(sql) {
      await lite.exec(sql);
    },
    tx(fn) {
      return lite.transaction((tx) =>
        fn({
          async query<T>(text: string, params: unknown[] = []) {
            const res = await tx.query<T>(text, params);
            return { rows: res.rows };
          },
        }),
      );
    },
    close: () => lite.close(),
  };
}
