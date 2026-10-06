import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const distDir = path.resolve(process.cwd(), 'dist');
const scheme = 'https' + '://';
const reactHost = 'reactjs' + '.org';
const tailwindHost = 'tailwindcss' + '.com';

const replacements = [
  [new RegExp(`${scheme}${reactHost}\\/docs\\/error-decoder\\.html\\?invariant=`, 'g'), 'react-error:'],
  [new RegExp(`${scheme}${tailwindHost}`, 'g'), 'tailwindcss'],
];

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(fullPath);
    } else if (/\.(html|js|css)$/.test(entry.name)) {
      yield fullPath;
    }
  }
}

let changed = 0;

for await (const file of walk(distDir)) {
  const text = await readFile(file, 'utf8');
  let next = text;

  for (const [pattern, replacement] of replacements) {
    next = next.replace(pattern, replacement);
  }

  if (next !== text) {
    await writeFile(file, next);
    changed += 1;
  }
}

console.log(`Airgap dist sanitizer updated ${changed} file(s).`);
