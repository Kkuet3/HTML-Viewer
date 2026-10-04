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
- `13-about-panel.js`: brief help panel and keyboard focus.
- `15-preview-diagnostics.js`: isolated diagnostics UI and token-filtered preview messages.
- `16-editor-recovery.js`: optional IndexedDB snapshot/recovery for editable work.

## Preview contracts

- `Simple` renders through `iframe.srcdoc`, remains debounce-free and coalesces
  an input burst to the newest generation once per animation frame.
- `previewLifecycle` is the single coordinator for mode, phase, route,
  generation, pending request and expected navigation. Navigation, edits,
  reloads and mode changes all invalidate or advance that same generation.
- A render may commit only while its generation and project-session generation
  are current. Service-worker versions are issued monotonically and become
  visible only after the current request is acknowledged.
- `Archivos` syncs a virtual project to `preview-sw.js` under the scoped
  `__html_viewer_project__/` URL beneath the app's deployment path; the main application must never be controlled
  by that service worker.
- The project session id is reused across a full application reload when
  `sessionStorage` is available, preventing persistent-session growth while
  keeping storage optional.
- The project response layer preserves MIME types, byte ranges, `HEAD` requests,
  clean routes, root-relative assets, query strings, local `_redirects` rules
  and extensionless SPA fallbacks while leaving cross-origin requests on the
  network.
- Full-page windows and nested frames resolve local navigation inside the same
  project namespace, including clean routes, authored `<base>` URLs, dynamic
  links/frames, GET forms, query parameters and fragments. Directory indexes
  keep their trailing slash so relative requests work after navigation/reload.
- Preview instrumentation must not replace browser APIs such as `fetch`, XHR or
  element focus, nor suppress interactions inside the rendered application.
- Browser preference storage is optional. The editor must still start when
  `localStorage` is unavailable or blocked.
