import { createDb } from '../bootstrap.js';
import { loadConfig } from '../config.js';
import { migrate } from './migrate.js';

const db = createDb(loadConfig());
const ran = await migrate(db);
console.log(ran.length > 0 ? `Applied: ${ran.join(', ')}` : 'Already up to date');
await db.close();
