// Single entry point that regenerates every build artifact the site serves.
// Run after editing anything under src/app/, styles.css, seo-pages.css, or the
// set of icons used in the UI:
//
//   node build.mjs
//
// Individual generation steps can still be run on their own; this entry point
// also verifies runtime dependencies and fingerprints browser-cached assets.

console.log('Building HTML Viewer assets...\n');

await import('./build-app-bundle.mjs');   // src/app/* -> app.bundle.js
await import('./build-lucide-subset.mjs'); // vendor/lucide.full.min.js -> lucide.min.js (subset)
await import('./build-css.mjs');           // styles.css/seo-pages.css -> *.min.css
await import('./verify-runtime-assets.mjs'); // fail fast if local Monaco/fonts are incomplete
await import('./build-asset-versions.mjs');  // content hashes in HTML asset URLs

console.log('\nAll assets built.');
