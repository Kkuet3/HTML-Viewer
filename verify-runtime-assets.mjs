import { access, stat } from 'node:fs/promises';

const requiredRuntimeAssets = [
  'assets/vendor/monaco-editor/0.39.0/LICENSE.txt',
  'assets/vendor/monaco-editor/0.39.0/min/vs/loader.js',
  'assets/vendor/monaco-editor/0.39.0/min/vs/editor/editor.main.js',
  'assets/vendor/monaco-editor/0.39.0/min/vs/editor/editor.main.css',
  'assets/vendor/monaco-editor/0.39.0/min/vs/base/worker/workerMain.js',
  'assets/vendor/monaco-editor/0.39.0/min/vs/language/html/htmlWorker.js',
  'assets/vendor/monaco-editor/0.39.0/min/vs/language/css/cssWorker.js',
  'assets/vendor/monaco-editor/0.39.0/min/vs/language/typescript/tsWorker.js',
  'assets/fonts/inter-latin-v20.woff2',
  'assets/fonts/outfit-latin-v15.woff2',
  'assets/fonts/jetbrains-mono-latin-v24.woff2',
  'assets/fonts/OFL-Inter.txt',
  'assets/fonts/OFL-Outfit.txt',
  'assets/fonts/OFL-JetBrains-Mono.txt',
];

for (const file of requiredRuntimeAssets) {
  await access(file);
  const info = await stat(file);
  if (!info.isFile() || info.size === 0) {
    throw new Error(`Runtime asset is empty or invalid: ${file}`);
  }
}

console.log(`Verified ${requiredRuntimeAssets.length} local runtime assets.`);
