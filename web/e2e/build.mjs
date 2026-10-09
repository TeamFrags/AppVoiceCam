// Builds the site against the local API. NEXT_PUBLIC_* values are fixed at build time, so the
// output of this build must never be uploaded: use `npm run build:web` for production.
import { spawnSync } from 'node:child_process';

const result = spawnSync('npx', ['next', 'build'], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    NEXT_TELEMETRY_DISABLED: '1',
    NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
    NEXT_PUBLIC_API_URL: 'http://localhost:4000',
  },
});
process.exit(result.status ?? 1);
