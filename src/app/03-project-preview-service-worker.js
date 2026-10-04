function canUseProjectPreviewServiceWorker() {
  return Boolean(
    window.isSecureContext &&
    'serviceWorker' in navigator &&
    (location.protocol === 'http:' || location.protocol === 'https:')
  );
}

function markProjectPreviewDirty(path = null, { all = false } = {}) {
  projectPreviewDirtySerial += 1;
  if (all || !path) {
    projectPreviewNeedsFullSync = true;
    projectPreviewFullDirtySerial = projectPreviewDirtySerial;
    projectPreviewDirtyPaths.clear();
    return;
  }

  const cleanPath = normalizeProjectPath(path);
  if (cleanPath) {
    projectPreviewDirtyPaths.set(cleanPath, projectPreviewDirtySerial);
  }
}

function yieldToMainThread() {
  return new Promise(resolve => {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => resolve(), { timeout: 50 });
    } else {
      setTimeout(resolve, 0);
    }
  });
}

function withTimeout(promise, timeoutMs, fallbackValue = null) {
  return new Promise(resolve => {
    const timeoutId = setTimeout(() => resolve(fallbackValue), timeoutMs);
    Promise.resolve(promise)
      .then(value => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch(() => {
        clearTimeout(timeoutId);
        resolve(fallbackValue);
      });
  });
}

function isProjectPreviewServiceWorkerScript(scriptUrl = '') {
  try {
    const url = new URL(scriptUrl, location.href);
    return url.origin === location.origin && url.pathname === new URL(PROJECT_PREVIEW_SW_URL).pathname;
  } catch {
    return String(scriptUrl || '').includes('preview-sw.js');
  }
}

function isCurrentProjectPreviewScope(scopeUrl = '') {
  try {
    const url = new URL(scopeUrl, location.href);
    return url.pathname === PROJECT_PREVIEW_SW_SCOPE;
  } catch {
    return String(scopeUrl || '').endsWith(PROJECT_PREVIEW_SW_SCOPE);
  }
}

function cleanupLegacyProjectPreviewServiceWorkers() {
  if (!canUseProjectPreviewServiceWorker()) return;
  navigator.serviceWorker.getRegistrations()
    .then(registrations => {
      registrations.forEach(registration => {
        const worker = registration.active || registration.waiting || registration.installing;
        if (!worker || !isProjectPreviewServiceWorkerScript(worker.scriptURL)) return;
        if (isCurrentProjectPreviewScope(registration.scope)) return;
        registration.unregister().catch(() => {});
      });
    })
    .catch(() => {});
}

function waitForProjectPreviewServiceWorker(registration) {
  if (registration.active) return Promise.resolve(registration.active);

  const worker = registration.installing || registration.waiting;
  if (!worker) return Promise.resolve(null);

  return new Promise(resolve => {
    const finish = () => {
      if (worker.state === 'activated') {
        worker.removeEventListener('statechange', finish);
        resolve(registration.active || worker);
      } else if (worker.state === 'redundant') {
        worker.removeEventListener('statechange', finish);
        resolve(null);
      }
    };
    worker.addEventListener('statechange', finish);
    finish();
  });
}

cleanupLegacyProjectPreviewServiceWorkers();

async function ensureProjectPreviewServiceWorker() {
  if (!canUseProjectPreviewServiceWorker()) return null;
  if (projectPreviewServiceWorker?.state === 'activated') return projectPreviewServiceWorker;
  projectPreviewServiceWorker = null;
  projectPreviewServiceWorkerPromise = null;

  if (!projectPreviewServiceWorkerPromise) {
    projectPreviewServiceWorkerPromise = navigator.serviceWorker.register(PROJECT_PREVIEW_SW_URL, { scope: PROJECT_PREVIEW_SW_SCOPE, updateViaCache: 'none' })
      .then(async registration => {
        registration.update?.().catch(() => {});
        const worker = await withTimeout(
          waitForProjectPreviewServiceWorker(registration),
          PROJECT_PREVIEW_SW_READY_TIMEOUT_MS,
          registration.active || null
        );
        if (!worker) {
          projectPreviewServiceWorkerPromise = null;
          return null;
        }
        projectPreviewServiceWorker = worker;
        return worker;
      })
      .catch(err => {
        void err;
        projectPreviewServiceWorker = null;
        projectPreviewServiceWorkerPromise = null;
        return null;
      });
  }

  return projectPreviewServiceWorkerPromise;
}

function postProjectPreviewMessage(message, transfer = []) {
  return new Promise((resolve, reject) => {
    const worker = projectPreviewServiceWorker;
    if (!worker) {
      reject(new Error('Service Worker no disponible'));
      return;
    }

    const channel = new MessageChannel();
    const timeoutId = setTimeout(() => {
      channel.port1.close();
      reject(new Error('Timeout sincronizando preview'));
    }, PROJECT_PREVIEW_MESSAGE_TIMEOUT_MS);

    channel.port1.onmessage = event => {
      clearTimeout(timeoutId);
      channel.port1.close();
      const data = event.data || {};
      if (data.ok) resolve(data);
      else reject(new Error(data.error || 'Error sincronizando preview'));
    };

    worker.postMessage(message, [channel.port2, ...transfer]);
  });
}

function resolveProjectPreviewHtml(content, filename, resourceVersion = null) {
  const documentUrl = getProjectPreviewUrl(filename);
  const rootUrl = getProjectPreviewUrl(`${getProjectPreviewSiteRootPath()}/`);
  let baseUrl = documentUrl;
  let foundBase = false;
  const resolveUrl = (value, base) => {
    const reference = String(value || '').trim();
    if (!reference || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(reference)) return null;
    try {
      return reference.startsWith('/') && new URL(base).origin === location.origin
        ? new URL(reference.slice(1), rootUrl)
        : new URL(reference, base);
    } catch { return null; }
  };
  // Honor the first authored base, including for references before that tag.
  rewriteHtmlReferenceAttributes(content, (value, context) => {
    if (!foundBase && context?.tagName === 'base' && context.attrName === 'href') {
      foundBase = true;
      try { baseUrl = resolveUrl(value, documentUrl)?.href || new URL(value, documentUrl).href; }
      catch { baseUrl = documentUrl; }
    }
    return null;
  });
  return rewriteHtmlReferenceAttributes(content, (value, context) => {
    const url = resolveUrl(value, context?.tagName === 'base' ? documentUrl : baseUrl);
    if (!url || url.origin !== location.origin) return null;
    if (context?.tagName !== 'base' && resourceVersion !== null) {
      url.searchParams.set(PROJECT_PREVIEW_VERSION_PARAM, String(resourceVersion));
    }
    return url.href;
  });
}

function createProjectPreviewNavigationBridge() {
  const rootUrl = JSON.stringify(getProjectPreviewUrl(`${getProjectPreviewSiteRootPath()}/`)).replace(/</g, '\\u003c');
  const sessionRoot = JSON.stringify(getProjectPreviewUrl('/')).replace(/</g, '\\u003c');
  return `<script data-html-viewer-project-navigation>
(() => {
  const root = new URL(${rootUrl});
  const sessionRoot = new URL(${sessionRoot});
  const attributes = { A: 'href', AREA: 'href', FORM: 'action', BUTTON: 'formaction', INPUT: 'formaction', IFRAME: 'src', FRAME: 'src', BASE: 'href', OBJECT: 'data', EMBED: 'src' };
  const rewrite = element => {
    const attribute = attributes[element.tagName];
    if (!attribute) return;
    const value = (element.getAttribute(attribute) || '').trim();
    if (!value || value.startsWith('//')) return;
    try {
      const url = new URL(value, document.baseURI);
      if (url.origin !== root.origin || url.pathname.startsWith(sessionRoot.pathname)) return;
      if (!value.startsWith('/') && !/^https?:/i.test(value)) return;
      const target = new URL(url.pathname.slice(1), root);
      target.search = url.search;
      target.hash = url.hash;
      if (target.href !== url.href) element.setAttribute(attribute, target.href);
    } catch {}
  };
  const scan = node => {
    if (node.nodeType !== 1) return;
    rewrite(node);
    node.querySelectorAll('a[href],area[href],form[action],button[formaction],input[formaction],iframe[src],frame[src],base[href],object[data],embed[src]').forEach(rewrite);
  };
  new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'attributes') rewrite(record.target);
      else record.addedNodes.forEach(scan);
    }
  }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['href', 'src', 'action', 'formaction', 'data'] });
  for (const type of ['pointerdown', 'click', 'auxclick']) {
    document.addEventListener(type, event => {
      const link = event.composedPath().find(node => node?.matches?.('a[href],area[href]'));
      if (link) rewrite(link);
    }, true);
  }
  document.addEventListener('submit', event => {
    rewrite(event.target);
    if (event.submitter) rewrite(event.submitter);
  }, true);
  scan(document.documentElement);
})();
</script>`;
}

function createProjectPreviewEntry(file, resolver, renderToken = '') {
  if (!file || file.isFolder) return null;
  const cleanPath = normalizeProjectPath(file.name);
  if (!cleanPath) return null;

  const ext = getFileExtension(cleanPath);
  const isHtml = ext === 'html' || ext === 'htm';
  const isCss = ext === 'css';
  const rawContent = file.isBinary ? null : getFileText(file);
  let content = null;
  if (!file.isBinary) {
    if (isHtml) {
      content = applyNonDraggableImageGuard(
        injectPreviewGuardIntoHtml(resolveProjectPreviewHtml(rawContent, cleanPath, renderToken), '', createProjectPreviewNavigationBridge()),
        { preventPreviewFocus: previewBlockFocusForCurrentRender, renderToken }
      );
    } else if (isCss) {
      content = resolveCssUrlsLazy(rawContent, cleanPath, resolver);
    } else {
      content = rawContent;
    }
  }

  return {
    path: cleanPath,
    mimeType: file.mimeType || getMimeTypeForFilename(cleanPath),
    isBinary: Boolean(file.isBinary),
    content,
    blob: file.isBinary ? getFileBlob(file) : null
  };
}

async function collectProjectPreviewEntries(paths = null, resourceVersion = null) {
  const selectedPaths = paths ? new Set(Array.from(paths).map(path => normalizeProjectPath(path)).filter(Boolean)) : null;
  const entries = [];
  let processed = 0;
  const fileLookup = createProjectFileLookup();
  const resolver = (canonicalPath) => {
    const cleanPath = normalizeProjectPath(canonicalPath);
    // A root-relative reference can produce two candidates: the workspace
    // path and the site's common root. Only resolve the candidate that really
    // exists; otherwise `/nested/page.html` would silently point outside a
    // project rooted at `proyecto/`.
    return cleanPath && fileLookup.has(cleanPath.toLowerCase())
      ? getProjectPreviewUrl(cleanPath, resourceVersion)
      : null;
  };

  if (selectedPaths) {
    for (const cleanPath of selectedPaths) {
      const entry = createProjectPreviewEntry(fileLookup.get(cleanPath.toLowerCase()), resolver, resourceVersion);
      if (entry) entries.push(entry);
      processed += 1;
      if (processed % 80 === 0) {
        await yieldToMainThread();
      }
    }
    return entries;
  }

  for (const file of files) {
    const entry = createProjectPreviewEntry(file, resolver, resourceVersion);
    if (!entry) continue;
    entries.push(entry);

    processed += 1;
    if (processed % 80 === 0) {
      await yieldToMainThread();
    }
  }

  return entries;
}

function getProjectPreviewUrl(path = '', version = null) {
  const cleanPath = normalizeProjectPath(path || 'index.html');
  const trailingSlash = String(path).endsWith('/') && cleanPath ? '/' : '';
  const encodedPath = cleanPath
    .split('/')
    .filter(Boolean)
    .map(segment => encodeURIComponent(segment))
    .join('/');
  const url = new URL(`${PROJECT_PREVIEW_PREFIX}/${projectPreviewSessionId}/${encodedPath}${trailingSlash}`, APP_ROOT_URL);
  if (version !== null && version !== undefined) {
    url.searchParams.set(PROJECT_PREVIEW_VERSION_PARAM, String(version));
  }
  return url.href;
}

function getProjectPreviewPathFromUrl(urlValue) {
  try {
    const url = new URL(urlValue, location.href);
    const marker = `${PROJECT_PREVIEW_SW_SCOPE}${projectPreviewSessionId}/`;
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex === -1) return '';

    const encodedPath = url.pathname.slice(markerIndex + marker.length);
    return normalizeProjectPath(decodeURIComponent(encodedPath));
  } catch {
    return '';
  }
}

function getPreviewIframeUrl() {
  if (!previewIframe) return '';
  try {
    return previewIframe.contentWindow?.location?.href || previewIframe.src || '';
  } catch {
    return previewIframe.src || '';
  }
}

function setProjectPreviewLocation(urlValue, fallbackPath = '') {
  let path = normalizeProjectPath(fallbackPath || '');
  let search = '';
  let hash = '';
  try {
    const url = new URL(urlValue, location.href);
    path = getProjectPreviewPathFromUrl(url.href) || path;
    if (!path && previewLifecycle.mode === 'project' && url.origin === location.origin) {
      path = normalizeProjectPath(url.pathname);
    }
    search = url.search;
    hash = url.hash;
  } catch {}

  if (!path) return false;
  previewLifecycle.projectPath = path;
  previewLifecycle.projectSearch = search;
  previewLifecycle.projectHash = hash;
  return true;
}

function resetProjectPreviewLocation() {
  previewLifecycle.projectPath = '';
  previewLifecycle.projectSearch = '';
  previewLifecycle.projectHash = '';
}

function getCompactPreviewPath(path) {
  const cleanPath = normalizeProjectPath(path);
  if (!cleanPath) return '';
  const parts = cleanPath.split('/').filter(Boolean);
  return parts.length > 2 ? `.../${parts.slice(-2).join('/')}` : cleanPath;
}

function isKnownProjectPreviewPath(path) {
  if (findProjectFileByStaticRoute(path)) return true;
  const cleanPath = normalizeProjectPath(path);
  const lastSegment = cleanPath.split('/').pop() || '';
  const isExtensionlessRoute = Boolean(cleanPath) && !/\.[^/.]+$/.test(lastSegment);
  const hasCustomNotFound = Boolean(findProjectFileByStaticRoute('404.html', { preferSiteRoot: true }));
  return Boolean(isExtensionlessRoute && !hasCustomNotFound && getEntryFile());
}

function syncProjectPreviewNavigationState({ preferExpected = true } = {}) {
  if (!previewIframe) return false;

  const expected = previewLifecycle.expectedNavigation;
  if (
    preferExpected &&
    expected?.mode === 'project' &&
    expected.generation === previewLifecycle.generation &&
    expected.path
  ) {
    setProjectPreviewLocation(expected.url, expected.path);
    return true;
  }

  const currentUrl = getPreviewIframeUrl();
  let currentPath = getProjectPreviewPathFromUrl(currentUrl);
  if (!currentPath && previewLifecycle.mode === 'project') {
    try {
      const url = new URL(currentUrl, location.href);
      if (url.origin === location.origin) {
        currentPath = normalizeProjectPath(url.pathname);
      }
    } catch {}
  }
  if (!currentPath) return false;

  const previousMissingPath = projectPreviewMissingPath;
  setProjectPreviewLocation(currentUrl, currentPath);

  if (!isKnownProjectPreviewPath(currentPath)) {
    projectPreviewMissingPath = currentPath;
    setPreviewStatus(`${PREVIEW_NOT_FOUND_LABEL}: ${getCompactPreviewPath(currentPath)}`, 'error');
  } else {
    projectPreviewMissingPath = '';
    projectPreviewNotifiedMissingPath = '';
    const entryPath = normalizeProjectPath(getEntryFile()?.name || '');
    const label = currentPath.toLowerCase() === entryPath.toLowerCase()
      ? PREVIEW_READY_LABEL
      : `Viendo: ${getCompactPreviewPath(currentPath)}`;
    setPreviewStatus(label, 'ready');
  }

  if (previousMissingPath !== projectPreviewMissingPath && editorMode === 'split') {
    renderFileExplorer();
  }
  return true;
}

function clearSyncedProjectPreviewDirtyState(dirtyEntriesAtStart, dirtySerialAtStart, fullDirtySerialAtStart) {
  dirtyEntriesAtStart.forEach(([path, serial]) => {
    if (projectPreviewDirtyPaths.get(path) === serial) {
      projectPreviewDirtyPaths.delete(path);
    }
  });
  if (projectPreviewFullDirtySerial === fullDirtySerialAtStart && projectPreviewFullDirtySerial <= dirtySerialAtStart) {
    projectPreviewNeedsFullSync = false;
  }
}

async function syncProjectPreviewSnapshot(options = {}) {
  if (options.full) {
    markProjectPreviewDirty(null, { all: true });
  }

  const queuedSync = projectPreviewSyncQueue
    .catch(() => false)
    .then(() => syncProjectPreviewSnapshotNow({ requestId: options.requestId ?? null }));

  projectPreviewSyncQueue = queuedSync.catch(() => false);
  return queuedSync;
}

async function syncProjectPreviewSnapshotNow({ requestId = null, staleRetryCount = 0 } = {}) {
  try {
    if (requestId !== null && requestId !== previewLifecycle.generation) return false;
    const generationAtStart = previewLifecycle.sessionGeneration;
    const sessionIdAtStart = projectPreviewSessionId;
    const worker = await ensureProjectPreviewServiceWorker();
    if (
      !worker ||
      generationAtStart !== previewLifecycle.sessionGeneration ||
      (requestId !== null && requestId !== previewLifecycle.generation)
    ) return false;

    const dirtySerialAtStart = projectPreviewDirtySerial;
    const fullDirtySerialAtStart = projectPreviewFullDirtySerial;
    const dirtyEntriesAtStart = Array.from(projectPreviewDirtyPaths.entries());
    const activePaths = new Set(files.filter(file => !file.isFolder).map(file => normalizeProjectPath(file.name)));
    const nextSiteRoot = getProjectPreviewSiteRootPath();
    const removedPaths = [];
    for (const knownPath of projectPreviewKnownPaths) {
      if (!activePaths.has(knownPath)) {
        removedPaths.push(knownPath);
      }
    }
    const addedPaths = [];
    for (const activePath of activePaths) {
      if (!projectPreviewKnownPaths.has(activePath)) {
        addedPaths.push(activePath);
      }
    }

    const siteRootChanged = nextSiteRoot !== projectPreviewSiteRoot;
    let needsFull = siteRootChanged || projectPreviewNeedsFullSync || projectPreviewKnownPaths.size === 0;
    let dirtyPaths = needsFull ? activePaths : new Set();
    if (!needsFull) {
      dirtyEntriesAtStart.forEach(([path]) => {
        if (activePaths.has(path)) dirtyPaths.add(path);
      });
      addedPaths.forEach(path => dirtyPaths.add(path));
    }

    if (!needsFull && dirtyPaths.size === 0 && removedPaths.length === 0) {
      const sessionState = await postProjectPreviewMessage({
        type: 'html-viewer:touch-project',
        sessionId: sessionIdAtStart
      });
      if (
        generationAtStart !== previewLifecycle.sessionGeneration ||
        sessionIdAtStart !== projectPreviewSessionId ||
        (requestId !== null && requestId !== previewLifecycle.generation)
      ) {
        return false;
      }

      const remoteVersion = Number(sessionState.version) || 0;
      if (sessionState.found && remoteVersion === projectPreviewVersion) {
        clearSyncedProjectPreviewDirtyState(dirtyEntriesAtStart, dirtySerialAtStart, fullDirtySerialAtStart);
        return true;
      }

      // The browser may terminate the worker while the editor is in the
      // background. If its persisted snapshot was also evicted or expired,
      // rebuild the complete project before following the next link.
      projectPreviewIssuedVersion = Math.max(projectPreviewIssuedVersion, remoteVersion);
      projectPreviewNeedsFullSync = true;
      needsFull = true;
      dirtyPaths = activePaths;
    }

    const nextVersion = Math.max(projectPreviewIssuedVersion, projectPreviewVersion) + 1;
    projectPreviewIssuedVersion = nextVersion;
    const entries = await collectProjectPreviewEntries(dirtyPaths, nextVersion);
    if (
      generationAtStart !== previewLifecycle.sessionGeneration ||
      sessionIdAtStart !== projectPreviewSessionId ||
      (requestId !== null && requestId !== previewLifecycle.generation)
    ) {
      return false;
    }
    const acknowledgement = await postProjectPreviewMessage({
      type: 'html-viewer:set-project',
      sessionId: sessionIdAtStart,
      version: nextVersion,
      siteRoot: nextSiteRoot,
      full: needsFull,
      entries,
      removedPaths
    });
    if (
      generationAtStart !== previewLifecycle.sessionGeneration ||
      sessionIdAtStart !== projectPreviewSessionId ||
      (requestId !== null && requestId !== previewLifecycle.generation)
    ) {
      return false;
    }

    if (acknowledgement.missing) {
      projectPreviewIssuedVersion = Math.max(projectPreviewIssuedVersion, Number(acknowledgement.version) || 0);
      projectPreviewNeedsFullSync = true;
      if (staleRetryCount < 1 && (requestId === null || requestId === previewLifecycle.generation)) {
        return syncProjectPreviewSnapshotNow({ requestId, staleRetryCount: staleRetryCount + 1 });
      }
      return false;
    }

    if (acknowledgement.stale || Number(acknowledgement.version) !== nextVersion) {
      projectPreviewIssuedVersion = Math.max(projectPreviewIssuedVersion, Number(acknowledgement.version) || 0);
      projectPreviewNeedsFullSync = true;
      if (staleRetryCount < 1 && (requestId === null || requestId === previewLifecycle.generation)) {
        return syncProjectPreviewSnapshotNow({ requestId, staleRetryCount: staleRetryCount + 1 });
      }
      return false;
    }

    projectPreviewVersion = nextVersion;
    if (generationAtStart !== previewLifecycle.sessionGeneration) {
      projectPreviewNeedsFullSync = true;
      return false;
    }
    projectPreviewSiteRoot = nextSiteRoot;
    projectPreviewKnownPaths = activePaths;
    clearSyncedProjectPreviewDirtyState(dirtyEntriesAtStart, dirtySerialAtStart, fullDirtySerialAtStart);
    return true;
  } catch {
    projectPreviewServiceWorker = null;
    projectPreviewServiceWorkerPromise = null;
    projectPreviewNeedsFullSync = true;
    if (staleRetryCount < 1 && (requestId === null || requestId === previewLifecycle.generation)) {
      return syncProjectPreviewSnapshotNow({ requestId, staleRetryCount: staleRetryCount + 1 });
    }
    return false;
  }
}

let projectPreviewResumeSyncPromise = null;

function refreshProjectPreviewAfterResume() {
  if (
    document.hidden ||
    editorMode !== 'split' ||
    previewLifecycle.mode !== 'project' ||
    !getEntryFile() ||
    projectPreviewResumeSyncPromise
  ) return;

  projectPreviewResumeSyncPromise = syncProjectPreviewSnapshot()
    .catch(() => false)
    .finally(() => {
      projectPreviewResumeSyncPromise = null;
    });
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refreshProjectPreviewAfterResume();
});
window.addEventListener('pageshow', refreshProjectPreviewAfterResume);
