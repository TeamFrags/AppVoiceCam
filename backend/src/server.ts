import { buildApp } from './app.js';
import { createDeps } from './bootstrap.js';
import { migrate } from './db/migrate.js';
import { purgeOldPageViews } from './modules/analytics.js';

const deps = createDeps();
await migrate(deps.db);
const app = await buildApp(deps);

// Enforces the audience-data retention period without needing a cron job.
const purge = () => purgeOldPageViews(deps.db).catch((err) => app.log.error(err));
await purge();
setInterval(purge, 24 * 3600 * 1000).unref();

const shutdown = async () => {
  await app.close();
  await deps.kv.close();
  await deps.db.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ host: deps.config.HOST, port: deps.config.PORT });
