# App source layout

`index.html` loads the generated `app.bundle.js`. Edit these source files, then
run `node build.mjs` to regenerate and fingerprint the served bundle.

- `00-config-state.js`: constants, DOM handles, state, initial project data.
- `01-history.js`: undo/redo snapshots and text change tracking.
- `02-file-path-records.js`: path normalization, MIME helpers, file records.
- `03-project-preview-service-worker.js`: project preview service worker sync.
- `04-models-entry-utils.js`: Monaco models, entry file selection, small UI helpers.
- `05-reference-resolution.js`: HTML/CSS reference rewriting.
- `06-virtual-assets.js`: Blob/Data URL snapshots and asset URL caches.
- `07-preview-editor.js`: preview rendering and editor bootstrapping.
- `08-layout-preview-controls.js`: split layout and preview toolbar controls.
- `09-import-export-theme.js`: modals, import/export, drag/drop, theme toggle.
- `10-editor-mode-assets.js`: unified/split mode and asset preview UI.
- `11-explorer-tabs.js`: file explorer, tabs, folder/file operations.
- `12-mobile-init.js`: mobile controls and final app initialization.
