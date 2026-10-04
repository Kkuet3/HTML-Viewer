import { cp, mkdir, readdir, lstat, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { publicDirectories, publicFiles } from './public-files.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const destination = path.resolve(root, 'dist');
// This script can only replace this project's generated dist directory.
if (path.dirname(destination) !== root || path.basename(destination) !== 'dist') {
  throw new Error('Invalid distribution directory');
}
const previous = await lstat(destination).catch(error => {
  if (error.code !== 'ENOENT') throw error;
});
if (previous?.isSymbolicLink()) throw new Error('Refusing to replace a linked dist directory');
// Validate all inputs before removing a previous build.
for (const entry of [...publicFiles, ...publicDirectories]) await lstat(path.join(root, entry));
await rm(destination, { recursive: true, force: true });
await mkdir(destination);
for (const entry of [...publicFiles, ...publicDirectories]) {
  await cp(path.join(root, entry), path.join(destination, entry), {
    recursive: true,
    filter: async source => {
      const info = await lstat(source);
      if (info.isSymbolicLink()) throw new Error(`Linked public asset is not supported: ${source}`);
      // Keep runtime files and third-party licenses, omit authoring notes.
      return publicFiles.includes(entry) || (!path.basename(source).startsWith('.') && !/\.md$/i.test(source));
    }
  });
}
// Preserve virtual project paths containing underscores when served by Pages.
await writeFile(path.join(destination, '.nojekyll'), '');
async function measure(directory) {
  let count = 0, bytes = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const child = await measure(name); count += child.count; bytes += child.bytes;
    } else { count++; bytes += (await lstat(name)).size; }
  }
  return { count, bytes };
}
const { count, bytes } = await measure(destination);
console.log(`dist ready: ${count} files, ${(bytes / 1024 / 1024).toFixed(2)} MB.`);
