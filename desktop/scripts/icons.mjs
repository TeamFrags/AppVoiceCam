// Regenerates the application icons from the mascot. Run after changing the mascot or palette:
//   npm run brand && npm run icons -w desktop
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '../..');
const brand = JSON.parse(await readFile(path.join(root, 'brand/brand.json'), 'utf8'));
const svg = await readFile(path.join(root, 'docs/brand/mascot.svg'));

// The mascot sits on the brand background so the icon reads on any taskbar colour.
const png = new Resvg(svg, {
  fitTo: { mode: 'width', value: 1024 },
  background: brand.colors.night.hex,
})
  .render()
  .asPng();

const tmp = await mkdtemp(path.join(tmpdir(), 'icons-'));
const source = path.join(tmp, 'icon.png');
await writeFile(source, png);
const result = spawnSync('npx', ['tauri', 'icon', source], {
  cwd: path.join(here, '..'),
  stdio: 'inherit',
  shell: true,
});
await rm(tmp, { recursive: true, force: true });
// Mobile icon sets are generated too; this application is desktop-only.
for (const unused of ['android', 'ios']) {
  await rm(path.join(here, '../src-tauri/icons', unused), { recursive: true, force: true });
}
process.exit(result.status ?? 1);
