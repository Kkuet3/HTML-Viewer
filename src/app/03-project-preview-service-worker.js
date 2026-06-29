function canUseProjectPreviewServiceWorker() {
  return Boolean(
    window.isSecureContext &&
    'serviceWorker' in navigator &&
    (location.protocol === 'http:' || location.protocol === 'https:')
  );
}

function markProjectPreviewDirty(path = null, { all = false } = {}) {
  if (all || !path) {
    projectPreviewNeedsFullSync = true;
    projectPreviewDirtyPaths.clear();
    return;
  }
  projectPreviewDirtyPaths.add(normalizeProjectPath(path));
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

async function ensureProjectPreviewServiceWorker() {
  if (!canUseProjectPreviewServiceWorker()) return null;
  if (projectPreviewServiceWorker) return projectPreviewServiceWorker;

  if (!projectPreviewServiceWorkerPromise) {
    projectPreviewServiceWorkerPromise = navigator.serviceWorker.register(PROJECT_PREVIEW_SW_URL, { scope: './', updateViaCache: 'none' })
      .then(async registration => {
        registration.update?.().catch(() => {});
        const readyRegistration = await withTimeout(
          navigator.serviceWorker.ready,
          PROJECT_PREVIEW_SW_READY_TIMEOUT_MS,
          registration
        );
        const worker = readyRegistration.active || registration.active;
        if (!worker) return null;
        projectPreviewServiceWorker = worker;
        return worker;
      })
      .catch(err => {
        void err;
        projectPreviewServiceWorker = null;
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
    }, 2500);

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

async function collectProjectPreviewEntries(paths = null) {
  const selectedPaths = paths ? new Set(Array.from(paths).map(path => normalizeProjectPath(path))) : null;
  const entries = [];
  let processed = 0;

  const resolver = (canonicalPath) => {
    const cleanPath = normalizeProjectPath(canonicalPath);
    return cleanPath ? getProjectPreviewUrl(cleanPath) : null;
  };

  for (const file of files) {
    if (file.isFolder) continue;
    const cleanPath = normalizeProjectPath(file.name);
    if (selectedPaths && !selectedPaths.has(cleanPath)) continue;

    const ext = getFileExtension(cleanPath);
    const isHtml = ext === 'html' || ext === 'htm';
    const isCss = ext === 'css';
    const rawContent = file.isBinary ? null : getFileText(file);
    let content = null;
    if (!file.isBinary) {
      if (isHtml) {
        content = applyNonDraggableImageGuard(
          resolveVirtualPathsLazy(rawContent, cleanPath, resolver),
          { preventPreviewFocus: previewBlockFocusForCurrentRender }
        );
      } else if (isCss) {
        content = resolveCssUrlsLazy(rawContent, cleanPath, resolver);
      } else {
        content = rawContent;
      }
    }

    entries.push({
      path: cleanPath,
      mimeType: file.mimeType || getMimeTypeForFilename(cleanPath),
      isBinary: Boolean(file.isBinary),
      content,
      blob: file.isBinary ? getFileBlob(file) : null
    });

    processed += 1;
    if (processed % 80 === 0) {
      await yieldToMainThread();
    }
  }

  return entries;
}

function getProjectPreviewUrl(path = '') {
  const cleanPath = normalizeProjectPath(path || 'index.html');
  const encodedPath = cleanPath
    .split('/')
    .filter(Boolean)
    .map(segment => encodeURIComponent(segment))
    .join('/');
  return new URL(`${PROJECT_PREVIEW_PREFIX}/${projectPreviewSessionId}/${encodedPath}`, location.href).href;
}

function getProjectPreviewPathFromUrl(urlValue) {
  try {
    const url = new URL(urlValue, location.href);
    const marker = `/${PROJECT_PREVIEW_PREFIX}/${projectPreviewSessionId}/`;
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

function getCompactPreviewPath(path) {
  const cleanPath = normalizeProjectPath(path);
  if (!cleanPath) return '';
  const parts = cleanPath.split('/').filter(Boolean);
  return parts.length > 2 ? `.../${parts.slice(-2).join('/')}` : cleanPath;
}

function isKnownProjectPreviewPath(path) {
  return Boolean(findProjectFileByStaticRoute(path));
}

function syncProjectPreviewNavigationState() {
  if (!previewIframe) return false;

  const currentPath = getProjectPreviewPathFromUrl(getPreviewIframeUrl());
  if (!currentPath) return false;

  const previousMissingPath = projectPreviewMissingPath;
  projectPreviewCurrentPath = currentPath;

  if (!isKnownProjectPreviewPath(currentPath)) {
    projectPreviewMissingPath = currentPath;
    setPreviewStatus(`${PREVIEW_NOT_FOUND_LABEL}: ${getCompactPreviewPath(currentPath)}`, 'error');
  } else {
    projectPreviewMissingPath = '';
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

async function syncProjectPreviewSnapshot({ full = false } = {}) {
  try {
    const worker = await ensureProjectPreviewServiceWorker();
    if (!worker) return false;

    const activePaths = new Set(files.filter(file => !file.isFolder).map(file => normalizeProjectPath(file.name)));
    const nextSiteRoot = getProjectPreviewSiteRootPath();
    const removedPaths = [];
    for (const knownPath of projectPreviewKnownPaths) {
      if (!activePaths.has(knownPath)) {
        removedPaths.push(knownPath);
      }
    }

    const siteRootChanged = nextSiteRoot !== projectPreviewSiteRoot;
    const needsFull = full || siteRootChanged || projectPreviewNeedsFullSync || projectPreviewKnownPaths.size === 0;
    const dirtyPaths = needsFull
      ? activePaths
      : new Set(Array.from(projectPreviewDirtyPaths).filter(path => activePaths.has(path)));

    if (!needsFull && dirtyPaths.size === 0 && removedPaths.length === 0) {
      return true;
    }

    const entries = await collectProjectPreviewEntries(dirtyPaths);
    await postProjectPreviewMessage({
      type: 'html-viewer:set-project',
      sessionId: projectPreviewSessionId,
      version: projectPreviewVersion + 1,
      siteRoot: nextSiteRoot,
      full: needsFull,
      entries,
      removedPaths
    });

    projectPreviewVersion += 1;
    projectPreviewSiteRoot = nextSiteRoot;
    projectPreviewKnownPaths = activePaths;
    projectPreviewDirtyPaths.clear();
    projectPreviewNeedsFullSync = false;
    return true;
  } catch {
    projectPreviewServiceWorker = null;
    projectPreviewServiceWorkerPromise = null;
    projectPreviewNeedsFullSync = true;
    return false;
  }
}

