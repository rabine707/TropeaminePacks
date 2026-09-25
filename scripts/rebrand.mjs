import { readFile, writeFile, unlink } from 'node:fs/promises';

const files = [
  'app/layout.tsx',
  'app/not-found.tsx',
  'components/collection-app.tsx',
  'README.md',
  'DEPLOYMENT.md',
  'package.json',
  'package-lock.json',
];

const replacements = [
  ['>inkbound<span className="brand-period">.</span>', '>Tropeamine Packs<span className="brand-period">.</span>'],
  ['className="footer-brand">inkbound.</Link>', 'className="footer-brand">Tropeamine Packs</Link>'],
  ['inkbound-v1', 'tropeamine-packs-v1'],
  ['inkbound-collection.json', 'tropeamine-packs-collection.json'],
  ['"name": "inkbound"', '"name": "tropeamine-packs"'],
  ['INKBOUND', 'TROPEAMINE PACKS'],
  ['Inkbound', 'Tropeamine Packs'],
];

for (const file of files) {
  let text = await readFile(file, 'utf8');
  let next = text;
  for (const [from, to] of replacements) next = next.split(from).join(to);
  if (next !== text) {
    await writeFile(file, next, 'utf8');
    console.log(`Updated ${file}`);
  }
}

await unlink('scripts/rebrand.mjs');
await unlink('.github/workflows/rebrand-once.yml');
