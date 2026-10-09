// Asks the .com registry whether names are registered: `npm run brand:check -- nom1 nom2`.
// Without arguments, checks the domain currently set in brand.json.
// "libre" means unregistered at the time of the check, not reserved for you.
import { readFile } from 'node:fs/promises';

const args = process.argv.slice(2);
const names =
  args.length > 0
    ? args
    : [JSON.parse(await readFile(new URL('./brand.json', import.meta.url), 'utf8')).domain];

for (const raw of names) {
  const label = raw.toLowerCase().replace(/\.com$/, '');
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) {
    console.log(`${raw}: nom invalide`);
    continue;
  }
  try {
    const res = await fetch(`https://rdap.verisign.com/com/v1/domain/${label}.com`);
    const verdict =
      res.status === 404 ? 'libre' : res.status === 200 ? 'déjà pris' : `réponse ${res.status}`;
    console.log(`${label}.com: ${verdict}`);
  } catch (err) {
    console.log(`${label}.com: vérification impossible (${err.message})`);
  }
}
