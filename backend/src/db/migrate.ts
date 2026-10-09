import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { Db } from './client.js';

const MIGRATIONS_DIR = fileURLToPath(new URL('../../migrations', import.meta.url));

/** Applies pending migrations in filename order, each in its own transaction. */
export async function migrate(db: Db): Promise<string[]> {
  await db.exec(
    'create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())',
  );
  const applied = new Set(
    (await db.query<{ name: string }>('select name from schema_migrations')).rows.map(
      (r) => r.name,
    ),
  );
  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => /^\d{3}_[a-z0-9_]+\.sql$/.test(f))
    .sort();

  const ran: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
    // The filename is constrained by the regex above, so inlining it is safe.
    await db.exec(
      `begin;\n${sql}\ninsert into schema_migrations (name) values ('${file}');\ncommit;`,
    );
    ran.push(file);
  }
  return ran;
}
