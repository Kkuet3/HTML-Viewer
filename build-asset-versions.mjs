import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { publicPages } from './public-files.mjs';

const versionedAssets = [
  'app.bundle.js',
  'lucide.min.js',
  'styles.min.css',
];

const versions = new Map();
for (const asset of versionedAssets) {
  const contents = await readFile(asset);
  const hash = createHash('sha256').update(contents).digest('hex').slice(0, 12);
  versions.set(asset, hash);
}

async function collectHtmlFiles(directory = '.') {
  const files = [];
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectHtmlFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      files.push(fullPath);
    }
  }
  return files;
}

const htmlFiles = [];
for (const entry of publicPages) {
  if (entry.endsWith('.html')) htmlFiles.push(entry);
  else htmlFiles.push(...await collectHtmlFiles(entry));
}
let changedCount = 0;

for (const file of htmlFiles) {
  const original = await readFile(file, 'utf8');
  let next = original;

  for (const [asset, hash] of versions) {
    const escaped = asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    next = next.replace(new RegExp(`${escaped}(?:\\?v=[a-f0-9]{8,64})?`, 'g'), `${asset}?v=${hash}`);
  }

  if (next !== original) {
    await writeFile(file, next, 'utf8');
    changedCount += 1;
  }
}

console.log(`Fingerprint URLs updated in ${changedCount} HTML file(s).`);
