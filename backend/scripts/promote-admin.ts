// Usage: npm run promote-admin -w backend -- user@example.com
// Admin rights are only ever granted from the server side, never through the API.
import { createDb } from '../src/bootstrap.js';
import { loadConfig } from '../src/config.js';

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error('Usage: promote-admin <email>');
  process.exit(1);
}

const db = createDb(loadConfig());
const { rows } = await db.query(
  `update users set role = 'admin', updated_at = now() where email = $1 and deleted_at is null returning id`,
  [email],
);
console.log(rows.length > 0 ? `${email} is now an admin` : `No account found for ${email}`);
await db.close();
process.exit(rows.length > 0 ? 0 : 1);
