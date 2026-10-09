// Prepares the files of a GitHub release after a signed build:
//   node desktop/scripts/release-manifest.mjs v0.2.0
// Writes, in src-tauri/target/release-assets/, the installer under a stable name and
// latest.json, the manifest installed copies read to find the next version.
// Needs APP_UPDATE_REPO (owner/name of the public releases repository).
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const tauriDir = path.join(here, '../src-tauri');
const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const tag = process.argv[2] ?? '';
const repo = process.env.APP_UPDATE_REPO;
if (!repo) fail('APP_UPDATE_REPO is required.');

const config = JSON.parse(await readFile(path.join(tauriDir, 'tauri.conf.json'), 'utf8'));
// Installed copies compare version numbers: a tag that disagrees with the program would
// publish an update nobody installs, or one that reinstalls forever.
if (tag !== `v${config.version}`) {
  fail(`Tag "${tag}" does not match version ${config.version} in tauri.conf.json.`);
}

const bundleDir = path.join(tauriDir, 'target/release/bundle/nsis');
const installers = (await readdir(bundleDir)).filter((f) =>
  f.endsWith(`_${config.version}_x64-setup.exe`),
);
if (installers.length !== 1) {
  fail(`Expected one installer for ${config.version} in ${bundleDir}, found ${installers.length}.`);
}
const installer = path.join(bundleDir, installers[0]);
const signature = await readFile(`${installer}.sig`, 'utf8').catch(() =>
  fail('No signature next to the installer: build with TAURI_SIGNING_PRIVATE_KEY set.'),
);

// Same file name for every version, so the website can link to the latest installer.
const slug = config.productName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const assetName = `${slug}-setup-x64.exe`;
const outDir = path.join(tauriDir, 'target/release-assets');
await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });
await copyFile(installer, path.join(outDir, assetName));
await writeFile(
  path.join(outDir, 'latest.json'),
  JSON.stringify(
    {
      version: config.version,
      pub_date: new Date().toISOString(),
      platforms: {
        'windows-x86_64': {
          signature,
          url: `https://github.com/${repo}/releases/download/${tag}/${assetName}`,
        },
      },
    },
    null,
    2,
  ) + '\n',
);
console.log(`wrote ${assetName} and latest.json in ${outDir}`);
