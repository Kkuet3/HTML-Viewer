const previewNavigationObservedDocuments = new WeakSet();

// Helper to get the current code to be rendered in the preview
function getCurrentPreviewCode() {
  if (!editor) return '';
  
  const rawContent = monacoLoaded ? unifiedModel.getValue() : fallbackTextarea.value;
  
  if (editorMode === 'unified') {
    let entryFile = getEntryFile();
    if (entryFile && (cameFromSplitMode || files.length > 1)) {
      cleanupVirtualBlobUrlCache();
      for (const key in virtualBlobUrls) {
        delete virtualBlobUrls[key];
      }

      const resolver = (canonicalPath) => {
        const referencedFile = findFileByCanonicalPath(canonicalPath);
        return ensureVirtualBlobUrl(referencedFile, new Set([entryFile.name]));
      };

      // Resolve paths inside the editor HTML using entryFile name as context
      return resolveVirtualPathsLazy(rawContent, entryFile.name, resolver);
    }
    return rawContent;
  } else {
    // Find the main HTML file: index.html, or first HTML file, or first file
    let entryFile = getEntryFile();

    if (!entryFile) return createEmptyProjectPreviewCode();

    cleanupVirtualBlobUrlCache();
    for (const key in virtualBlobUrls) {
      delete virtualBlobUrls[key];
    }

    const rawContent = getFileText(entryFile);
    const resolver = (canonicalPath) => {
      const referencedFile = findFileByCanonicalPath(canonicalPath);
      return ensureVirtualBlobUrl(referencedFile, new Set([entryFile.name]));
    };

    // Resolve paths inside the entry HTML
    return resolveVirtualPathsLazy(rawContent, entryFile.name, resolver);
  }
}

if (previewIframe) {
  const initialPreviewCode = createEmptyProjectPreviewCode('');
  markPreviewHomeNavigationPending();
  previewIframe.srcdoc = initialPreviewCode;
  lastPreviewCode = initialPreviewCode;
  previewIframe.classList.add('is-empty');
  previewIframe.addEventListener('load', () => {
    clearTimeout(renderingTimeoutId);
    const isProjectPreview = syncProjectPreviewNavigationState();
    syncPreviewHomeNavigationState(isProjectPreview);
    bindPreviewNavigationObserver();
    if (!isProjectPreview) {
      setPreviewStatus(PREVIEW_READY_LABEL, 'ready');
    }
    restoreEditorFocusAfterPreviewLoad();
  });
}

function setPreviewAwayFromHome(isAway) {
  previewIsAwayFromHome = Boolean(isAway);
  const button = document.getElementById('btn-preview-home');
  if (!button) return;
  button.disabled = !previewIsAwayFromHome;
  button.setAttribute('aria-disabled', String(!previewIsAwayFromHome));
}

function markPreviewHomeNavigationPending() {
  previewHomeNavigationPending = true;
  setPreviewAwayFromHome(false);
}

function syncPreviewHomeNavigationState(isProjectPreview) {
  if (previewHomeNavigationPending) {
    previewHomeNavigationPending = false;
    setPreviewAwayFromHome(false);
    return;
  }

  if (isProjectPreview) {
    const entryPath = normalizeProjectPath(getEntryFile()?.name || '').toLowerCase();
    const currentPath = normalizeProjectPath(projectPreviewCurrentPath || '').toLowerCase();
    setPreviewAwayFromHome(Boolean(currentPath && currentPath !== entryPath));
    return;
  }

  // A second iframe load not initiated by the editor means the rendered page
  // followed a link, including links to origins whose URL the parent cannot read.
  setPreviewAwayFromHome(true);
}

function bindPreviewNavigationObserver() {
  try {
    const previewDocument = previewIframe?.contentDocument;
    if (!previewDocument || previewNavigationObservedDocuments.has(previewDocument)) return;
    previewNavigationObservedDocuments.add(previewDocument);
    previewDocument.addEventListener('click', (event) => {
      const link = event.target?.closest?.('a[href]');
      if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
      const href = (link.getAttribute('href') || '').trim();
      if (!href || href.startsWith('#') || href.toLowerCase().startsWith('javascript:')) return;
      setPreviewAwayFromHome(true);
    }, true);
  } catch {
    // Cross-origin destinations cannot be inspected after navigation; the load
    // state fallback still keeps the home action available.
  }
}

function returnPreviewToHome() {
  if (!editor || !previewIframe) return;
  lastPreviewCode = '';
  projectPreviewLastUrl = '';
  projectPreviewCurrentPath = '';
  projectPreviewMissingPath = '';
  markPreviewHomeNavigationPending();
  updatePreview();
}

// Filename auto-sizing helper
function adjustFilenameWidth() {
  if (!filenameInput) return;
  const charCount = filenameInput.value.length || 1;
  filenameInput.style.width = `${charCount}ch`;
}

if (filenameInput) {
  filenameInput.addEventListener('input', adjustFilenameWidth);
  // Initial run
  adjustFilenameWidth();
}

function setPreviewStatus(label, state = 'idle') {
  void label;
  void state;
}

function getEmptyPreviewColors() {
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  return isDark
    ? { background: '#1e1e24', text: '#9ca3af' }
    : { background: '#ffffff', text: '#64748b' };
}

function createEmptyProjectPreviewCode(message = EMPTY_PROJECT_PREVIEW_MESSAGE) {
  const { background, text } = getEmptyPreviewColors();
  const safeMessage = String(message || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));

  return `<!doctype html>
<html data-html-viewer-empty-preview>
<head>
<meta charset="utf-8">
<style>
html,body{min-height:100%;margin:0;background:${background};color:${text};}
body{display:grid;place-items:center;font:15px/1.45 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}
</style>
</head>
<body>${safeMessage ? `<div>${safeMessage}</div>` : ''}</body>
</html>`;
}

function isEmptyPreviewCode(rawCode) {
  return !rawCode || !rawCode.trim() || String(rawCode).includes('data-html-viewer-empty-preview');
}

function editorHasKeyboardFocus() {
  if (monacoLoaded && editor && typeof editor.hasTextFocus === 'function') {
    return editor.hasTextFocus();
  }
  return document.activeElement === fallbackTextarea;
}

function restoreEditorFocusAfterPreviewLoad() {
  if (!previewShouldRestoreEditorFocus) return;
  previewShouldRestoreEditorFocus = false;
  const restore = () => {
    if (!editor) return;
    if (monacoLoaded && typeof editor.focus === 'function') {
      editor.focus();
    } else if (fallbackTextarea) {
      fallbackTextarea.focus({ preventScroll: true });
    }
  };
  requestAnimationFrame(restore);
  setTimeout(restore, 80);
  setTimeout(restore, 220);
}

function allowPreviewFocusOnNextRender() {
  previewAllowFocusOnNextRender = true;
}

function getPreviewFocusPolicyForRender() {
  const hadEditorFocus = editorHasKeyboardFocus();
  const allowFocus = previewAllowFocusOnNextRender;
  previewAllowFocusOnNextRender = false;
  return {
    blockFocus: hadEditorFocus && !allowFocus,
    restoreFocus: hadEditorFocus
  };
}

function updateEditorPlaceholder() {
  if (!editorPlaceholder || !editor) return;
  if (!monacoLoaded && fallbackTextarea?.style.display === 'block') {
    scheduleFallbackEditorChromeSync();
    editorPlaceholder.classList.add('hidden');
    return;
  }

  if (editorMode === 'split' && !activeFileId) {
    editorPlaceholder.classList.remove('hidden');
    editorPlaceholder.textContent = t('placeholder_open_file');
    return;
  }

  if (editorMode === 'split') {
    const activeFile = files.find(f => f.id === activeFileId);
    if (activeFile && !isEditableFile(activeFile)) {
      editorPlaceholder.classList.add('hidden');
      return;
    }
  }

  const code = monacoLoaded ? editor.getValue() : fallbackTextarea.value;
  const hasCode = code.trim().length > 0;
  editorPlaceholder.classList.toggle('hidden', hasCode);

  if (!hasCode) {
    if (editorMode === 'unified') {
      editorPlaceholder.textContent = t('placeholder_html');
    } else {
      const file = files.find(f => f.id === activeFileId);
      if (file) {
        const ext = getFileExtension(file.name);
        if (ext === 'html' || ext === 'htm') editorPlaceholder.textContent = t('placeholder_html');
        else if (ext === 'css') editorPlaceholder.textContent = t('placeholder_css');
        else if (ext === 'js' || ext === 'jsx') editorPlaceholder.textContent = t('placeholder_js');
        else if (ext === 'json') editorPlaceholder.textContent = t('placeholder_json');
        else if (ext === 'md') editorPlaceholder.textContent = t('placeholder_md');
        else editorPlaceholder.textContent = t('placeholder_code');
      }
    }
  }
}

let previewDebounceTimeout = null;

function getPreviewDebounceMs(force = false) {
  if (force) return 0;
  if (editorMode === 'unified') return 0;

  const fileCount = files.filter(file => !file.isFolder).length;
  if (fileCount > 1200) return PROJECT_PREVIEW_DEBOUNCE_MAX_MS;
  if (fileCount > 350) return 420;
  if (fileCount > 80) return 240;
  return PROJECT_PREVIEW_DEBOUNCE_MIN_MS;
}

function schedulePreviewUpdate({ force = false } = {}) {
  if (previewFrameRequest) {
    cancelAnimationFrame(previewFrameRequest);
    previewFrameRequest = 0;
  }
  if (previewDebounceTimeout) {
    clearTimeout(previewDebounceTimeout);
    previewDebounceTimeout = null;
  }

  if (force) {
    renderPreviewNow();
    return;
  }

  previewDebounceTimeout = setTimeout(() => {
    previewDebounceTimeout = null;
    previewFrameRequest = requestAnimationFrame(() => {
      previewFrameRequest = 0;
      renderPreviewNow();
    });
  }, getPreviewDebounceMs(force));
}

function renderSrcdocPreviewNow(rawCode) {
  if (!editor || !previewIframe) return;
  const isEmpty = isEmptyPreviewCode(rawCode);
  previewIframe.classList.toggle('is-empty', isEmpty);

  const focusPolicy = getPreviewFocusPolicyForRender();
  previewBlockFocusForCurrentRender = focusPolicy.blockFocus;
  const previewCode = isEmpty ? createEmptyProjectPreviewCode('') : rawCode;
  const code = applyNonDraggableImageGuard(previewCode, { preventPreviewFocus: previewBlockFocusForCurrentRender });
  updateEditorPlaceholder();

  if (code === lastPreviewCode) {
    clearTimeout(renderingTimeoutId);
    setPreviewStatus(PREVIEW_IDLE_LABEL, 'idle');
    return;
  }

  lastPreviewCode = code;
  previewRenderId += 1;

  clearTimeout(renderingTimeoutId);
  renderingTimeoutId = setTimeout(() => {
    setPreviewStatus(PREVIEW_RENDERING_LABEL, 'rendering');
  }, 250);

  previewShouldRestoreEditorFocus = focusPolicy.restoreFocus;
  markPreviewHomeNavigationPending();
  previewIframe.removeAttribute('src');
  previewIframe.srcdoc = code;
}

async function renderProjectPreviewNow(renderId) {
  if (!editor || !previewIframe || renderId !== previewRenderId) return;

  const entryFile = getEntryFile();
  if (!entryFile) {
    renderSrcdocPreviewNow(createEmptyProjectPreviewCode());
    return;
  }

  if (!getFileText(entryFile).trim()) {
    renderSrcdocPreviewNow(createEmptyProjectPreviewCode(''));
    return;
  }

  previewIframe.classList.remove('is-empty');
  updateEditorPlaceholder();

  const focusPolicy = getPreviewFocusPolicyForRender();
  previewBlockFocusForCurrentRender = focusPolicy.blockFocus;
  if (projectPreviewLastBlockFocus !== previewBlockFocusForCurrentRender) {
    projectPreviewLastBlockFocus = previewBlockFocusForCurrentRender;
    markProjectPreviewDirty(null, { all: true });
  }
  const hasServiceWorkerPreview = await syncProjectPreviewSnapshot();
  if (renderId !== previewRenderId) return;

  if (!hasServiceWorkerPreview) {
    renderSrcdocPreviewNow(getCurrentPreviewCode());
    return;
  }

  const entryUrl = `${getProjectPreviewUrl(entryFile.name)}?v=${projectPreviewVersion}`;
  const renderSignature = `project:${entryFile.name}:${projectPreviewVersion}`;
  if (renderSignature === lastPreviewCode && entryUrl === projectPreviewLastUrl) {
    clearTimeout(renderingTimeoutId);
    setPreviewStatus(PREVIEW_IDLE_LABEL, 'idle');
    return;
  }

  lastPreviewCode = renderSignature;
  projectPreviewLastUrl = entryUrl;
  projectPreviewCurrentPath = normalizeProjectPath(entryFile.name);

  clearTimeout(renderingTimeoutId);
  renderingTimeoutId = setTimeout(() => {
    setPreviewStatus(PREVIEW_RENDERING_LABEL, 'rendering');
  }, 160);

  previewShouldRestoreEditorFocus = focusPolicy.restoreFocus;
  markPreviewHomeNavigationPending();
  previewIframe.removeAttribute('srcdoc');
  previewIframe.src = entryUrl;
}

function renderPreviewNow() {
  if (!editor || !previewIframe) return;
  previewRenderId += 1;
  const renderId = previewRenderId;

  if (editorMode === 'unified') {
    renderSrcdocPreviewNow(getCurrentPreviewCode());
    return;
  }

  renderProjectPreviewNow(renderId);
}

function getEditorLineHeight(fontSize = editorFontSize) {
  return Math.round(fontSize * 1.4);
}

function syncEditorTypographyVariables() {
  const editorContainer = document.getElementById('editor-container');
  if (!editorContainer) return;

  editorContainer.style.setProperty('--editor-font-size', `${editorFontSize}px`);
  editorContainer.style.setProperty('--editor-line-height', `${getEditorLineHeight()}px`);
}

function setEditorFontSize(fontSize) {
  const nextSize = Math.min(EDITOR_MAX_FONT_SIZE, Math.max(EDITOR_MIN_FONT_SIZE, fontSize));
  if (nextSize === editorFontSize) return;

  editorFontSize = nextSize;
  syncEditorTypographyVariables();

  if (monacoLoaded && editor && typeof editor.updateOptions === 'function') {
    editor.updateOptions({
      fontSize: editorFontSize,
      lineHeight: getEditorLineHeight()
    });
    syncEditorZoomGutter();
  } else {
    scheduleFallbackEditorChromeSync();
  }
}

function syncEditorZoomGutter() {
  if (!monacoLoaded || !editor || typeof editor.getLayoutInfo !== 'function') return;

  const isMobile = window.innerWidth <= 768;
  const layoutInfo = editor.getLayoutInfo();
  const options = editor.getRawOptions?.();
  const currentDecorationsWidth = Number(options?.lineDecorationsWidth) || 0;
  const fixedGutterWidth = layoutInfo.contentLeft - currentDecorationsWidth;
  const nextDecorationsWidth = Math.max(0, Math.round(EDITOR_CONTENT_LEFT - fixedGutterWidth));

  editor.updateOptions({
    lineNumbersMinChars: isMobile ? 2 : 3,
    folding: !isMobile
  });

  if (nextDecorationsWidth !== currentDecorationsWidth) {
    editor.updateOptions({ lineDecorationsWidth: nextDecorationsWidth });
  }
}

function initEditorWheelZoom() {
  const editorContainer = document.getElementById('editor-container');
  if (!editorContainer) return;

  const zoomIndicator = document.createElement('div');
  zoomIndicator.className = 'editor-zoom-indicator';
  zoomIndicator.setAttribute('role', 'status');
  zoomIndicator.setAttribute('aria-live', 'polite');
  editorContainer.appendChild(zoomIndicator);
  let hideZoomIndicatorTimeout = null;

  const showZoomIndicator = () => {
    const percentage = Math.round((editorFontSize / EDITOR_DEFAULT_FONT_SIZE) * 100);
    zoomIndicator.textContent = `${percentage}%`;
    zoomIndicator.classList.add('visible');
    clearTimeout(hideZoomIndicatorTimeout);
    hideZoomIndicatorTimeout = setTimeout(() => {
      zoomIndicator.classList.remove('visible');
    }, 900);
  };

  syncEditorTypographyVariables();
  editorContainer.addEventListener('wheel', (event) => {
    if (!event.ctrlKey || event.deltaY === 0) return;

    event.preventDefault();
    event.stopPropagation();
    setEditorFontSize(editorFontSize + (event.deltaY < 0 ? 1 : -1));
    showZoomIndicator();
  }, { passive: false, capture: true });
}

initEditorWheelZoom();

let fallbackEditorChromeFrame = 0;

function syncFallbackEditorChrome() {
  fallbackEditorChromeFrame = 0;
  if (monacoLoaded || !fallbackTextarea || !fallbackLineNumbers || !fallbackCurrentLine) return;

  const value = fallbackTextarea.value || '';
  const lineCount = Math.max(1, value.split('\n').length);
  const currentLine = value.slice(0, fallbackTextarea.selectionStart || 0).split('\n').length;
  const lineHeight = getEditorLineHeight();
  const scrollTop = fallbackTextarea.scrollTop || 0;
  const firstVisibleLine = Math.max(0, Math.floor(scrollTop / lineHeight) - 1);
  const visibleLineCount = Math.ceil((fallbackTextarea.clientHeight || lineHeight) / lineHeight) + 3;
  const lastVisibleLine = Math.min(lineCount, firstVisibleLine + visibleLineCount);

  fallbackLineNumbers.textContent = Array.from(
    { length: lastVisibleLine - firstVisibleLine },
    (_, index) => firstVisibleLine + index + 1
  ).join('\n');
  fallbackLineNumbers.style.transform = `translateY(${(firstVisibleLine * lineHeight) - scrollTop}px)`;
  fallbackCurrentLine.style.transform = `translateY(${((currentLine - 1) * lineHeight) - scrollTop}px)`;
}

function scheduleFallbackEditorChromeSync() {
  if (monacoLoaded || fallbackEditorChromeFrame) return;
  fallbackEditorChromeFrame = requestAnimationFrame(syncFallbackEditorChrome);
}

let fallbackTouchScrollInitialized = false;
function isMobileKeyboardLikelyOpen() {
  const viewport = window.visualViewport;
  return Boolean(viewport && window.innerHeight - viewport.height > 140);
}

function initFallbackTouchScroll() {
  if (fallbackTouchScrollInitialized || !fallbackTextarea) return;
  fallbackTouchScrollInitialized = true;
  let gesture = null;

  fallbackTextarea.addEventListener('touchstart', (event) => {
    if (window.innerWidth > COMPACT_LAYOUT_MAX_WIDTH || event.touches.length !== 1) return;
    if (document.activeElement === fallbackTextarea && isMobileKeyboardLikelyOpen()) return;
    const touch = event.touches[0];
    gesture = {
      startX: touch.clientX,
      startY: touch.clientY,
      lastX: touch.clientX,
      lastY: touch.clientY,
      scrollLeft: fallbackTextarea.scrollLeft,
      scrollTop: fallbackTextarea.scrollTop,
      moved: false
    };
    event.preventDefault();
  }, { passive: false, capture: true });

  fallbackTextarea.addEventListener('touchmove', (event) => {
    if (!gesture || event.touches.length !== 1) return;
    const touch = event.touches[0];
    gesture.lastX = touch.clientX;
    gesture.lastY = touch.clientY;
    if (Math.hypot(touch.clientX - gesture.startX, touch.clientY - gesture.startY) > 7) {
      gesture.moved = true;
    }
    fallbackTextarea.scrollLeft = gesture.scrollLeft + gesture.startX - touch.clientX;
    fallbackTextarea.scrollTop = gesture.scrollTop + gesture.startY - touch.clientY;
    scheduleFallbackEditorChromeSync();
    event.preventDefault();
  }, { passive: false, capture: true });

  fallbackTextarea.addEventListener('touchend', (event) => {
    if (!gesture) return;
    const shouldFocus = !gesture.moved;
    gesture = null;
    event.preventDefault();
    if (shouldFocus) fallbackTextarea.focus({ preventScroll: true });
  }, { passive: false, capture: true });

  fallbackTextarea.addEventListener('touchcancel', () => {
    gesture = null;
  }, { passive: true, capture: true });
}

let monacoTouchScrollNode = null;
function initMonacoTouchScroll() {
  const editorNode = editor?.getDomNode?.();
  if (!editorNode || monacoTouchScrollNode === editorNode) return;
  monacoTouchScrollNode = editorNode;
  let gesture = null;

  editorNode.addEventListener('touchstart', (event) => {
    if (window.innerWidth > COMPACT_LAYOUT_MAX_WIDTH || event.touches.length !== 1) return;
    if (editor.hasTextFocus?.() && isMobileKeyboardLikelyOpen()) return;
    const touch = event.touches[0];
    gesture = {
      startX: touch.clientX,
      startY: touch.clientY,
      lastX: touch.clientX,
      lastY: touch.clientY,
      scrollLeft: editor.getScrollLeft(),
      scrollTop: editor.getScrollTop(),
      moved: false
    };
    event.preventDefault();
  }, { passive: false, capture: true });

  editorNode.addEventListener('touchmove', (event) => {
    if (!gesture || event.touches.length !== 1) return;
    const touch = event.touches[0];
    gesture.lastX = touch.clientX;
    gesture.lastY = touch.clientY;
    if (Math.hypot(touch.clientX - gesture.startX, touch.clientY - gesture.startY) > 7) {
      gesture.moved = true;
    }
    editor.setScrollLeft(gesture.scrollLeft + gesture.startX - touch.clientX);
    editor.setScrollTop(gesture.scrollTop + gesture.startY - touch.clientY);
    event.preventDefault();
  }, { passive: false, capture: true });

  editorNode.addEventListener('touchend', (event) => {
    if (!gesture) return;
    const completedGesture = gesture;
    gesture = null;
    event.preventDefault();
    if (completedGesture.moved) return;

    const target = editor.getTargetAtClientPoint?.(completedGesture.lastX, completedGesture.lastY);
    if (target?.position) editor.setPosition(target.position);
    editor.focus();
  }, { passive: false, capture: true });

  editorNode.addEventListener('touchcancel', () => {
    gesture = null;
  }, { passive: true, capture: true });
}

// Fallback editor implementation if CDN fails or runs offline
function initFallbackEditor(showToastFlag = false) {
  if (monacoLoaded) return;
  fallbackTextarea.style.display = 'block';
  fallbackTextarea.value = INITIAL_EDITOR_CODE;
  fallbackTextarea.placeholder = EDITOR_PLACEHOLDER_TEXT;
  initFallbackTouchScroll();
  scheduleFallbackEditorChromeSync();

  fallbackTextarea.addEventListener('input', () => {
    if (!isRestoringHistory) {
      handleTextChange();
    }
    saveFallbackTabContent();
    schedulePreviewUpdate({ force: false });
    scheduleFallbackEditorChromeSync();
  });

  ['click', 'keyup', 'select', 'scroll'].forEach(eventName => {
    fallbackTextarea.addEventListener(eventName, scheduleFallbackEditorChromeSync, { passive: true });
  });

  fallbackTextarea.addEventListener('paste', () => {
    setTimeout(() => {
      allowPreviewFocusOnNextRender();
      saveFallbackTabContent();
      schedulePreviewUpdate({ force: true });
    }, 0);
  });

  editor = {
    getValue: () => {
      if (editorMode === 'unified') return fallbackTextarea.value;
      else {
        saveFallbackTabContent();
        let entryFile = getEntryFile();
        if (!entryFile) return '';
        generateBlobUrls();
        return resolveVirtualPaths(getFileText(entryFile), virtualBlobUrls, entryFile.name);
      }
    },
    setValue: (val) => {
      if (editorMode === 'unified') {
        cameFromSplitMode = false;
        const rootFolder = getProjectRootFolder();
        files = [
          createTextFileRecord(rootFolder + 'index.html', val, { id: '1' })
        ];
        openFileIds = ['1'];
        selectedEntryFileId = '1';
        fallbackTextarea.value = val;
      } else {
        replaceProjectWithSplitSource(val, { emptyAsSingleFile: true });
        if (val === '') {
          fallbackTextarea.value = '';
        } else {
          fallbackTextarea.value = getFileText(files.find(file => file.id === '1'));
        }
        renderActiveFileSummary();
        renderFileExplorer();
      }
      updateEditorPlaceholder();
      updatePreview();
    },
    layout: () => {},
    onDidChangeModelContent: () => {} // dummy
  };

  updateEditorPlaceholder();
  updatePreview();
  if (window.innerWidth > COMPACT_LAYOUT_MAX_WIDTH) {
    fallbackTextarea.focus();
  }
  if (showToastFlag) {
    showToast(t('toast_offline_mode'), 'info');
  }
}

// Initialize the fallback editor immediately to show content and allow editing without blocking
initFallbackEditor(false);

let monacoLoadPromise = null;
let monacoLoadFailureToastShown = false;

// Upgrade the instant fallback editor to the locally hosted Monaco build.
// The promise is shared so interaction, first-paint warmup and retries cannot
// start competing AMD loads.
function upgradeToMonaco() {
  if (monacoLoaded) return Promise.resolve(true);
  if (monacoLoadPromise) return monacoLoadPromise;

  const loadScript = (src) => new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.dataset.monacoLoader = 'true';

    let settled = false;
    const finish = (error = null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      s.onload = null;
      s.onerror = null;
      if (error) {
        s.remove();
        reject(error);
      } else {
        resolve();
      }
    };
    const timeoutId = setTimeout(() => {
      finish(new Error(`Monaco loader timed out after ${MONACO_LOAD_TIMEOUT_MS} ms`));
    }, MONACO_LOAD_TIMEOUT_MS);

    s.onload = () => finish();
    s.onerror = () => finish(new Error(`Failed to load Monaco loader: ${src}`));
    document.head.appendChild(s);
  });

  const startMonacoLoad = () => new Promise((resolve, reject) => {
    let settled = false;
    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`Monaco modules timed out after ${MONACO_LOAD_TIMEOUT_MS} ms`));
    }, MONACO_LOAD_TIMEOUT_MS);

    const fail = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      reject(error instanceof Error ? error : new Error(String(error || 'Monaco initialization failed')));
    };

    try {
      require.config({
        paths: { vs: MONACO_BASE_PATH },
        waitSeconds: Math.ceil(MONACO_LOAD_TIMEOUT_MS / 1000)
      });
      require(['vs/editor/editor.main'], function () {
        if (settled) return;
        try {
          const initialEditorValue = editor?.getValue?.() ?? INITIAL_EDITOR_CODE;
          monacoLoaded = true;
          fallbackTextarea.style.display = 'none';
          document.getElementById('editor-container')?.classList.add('monaco-ready');
          const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

        // Define custom themes matching our Artificial Analysis variables with improved contrast
        monaco.editor.defineTheme('app-dark-theme', {
          base: 'vs-dark',
          inherit: true,
          rules: [],
          colors: {
            'editor.background': '#0b0d13',
            'editor.foreground': '#ffffff',
            'editorLineNumber.foreground': '#94a3b8',
            'editorLineNumber.activeForeground': '#8842FD',
            'editor.lineHighlightBackground': '#151821',
            'editor.selectionBackground': '#2d2542',
            'scrollbarSlider.background': '#151821',
            'scrollbarSlider.hoverBackground': '#1f2433',
            'scrollbarSlider.activeBackground': '#2d344a',
          }
        });

        monaco.editor.defineTheme('app-light-theme', {
          base: 'vs',
          inherit: true,
          rules: [],
          colors: {
            'editor.background': '#ffffff',
            'editor.foreground': '#020617',
            'editorLineNumber.foreground': '#94a3b8',
            'editorLineNumber.activeForeground': '#8842FD',
            'editor.lineHighlightBackground': '#e2e8f0',
            'editor.selectionBackground': '#f1e9ff',
            'scrollbarSlider.background': '#cbd5e1',
            'scrollbarSlider.hoverBackground': '#94a3b8',
            'scrollbarSlider.activeBackground': '#64748b',
          }
        });

        // Create the models for Monaco Editor
        unifiedModel = monaco.editor.createModel(initialEditorValue, 'html');
        unifiedModel.onDidChangeContent(() => {
          if (!isRestoringHistory) {
            handleTextChange();
          }
          if (editorMode === 'unified') {
            const entryFile = getEntryFile();
            if (entryFile) {
              markProjectPreviewDirty(entryFile.name);
            }
          }
          updateEditorPlaceholder();
          schedulePreviewUpdate({ force: false });
        });

        // Create models only for editable VFS files.
        syncModelsForFiles();

        const isMobile = window.innerWidth <= 768;
        // Create the editor instance using unifiedModel initially
        editor = monaco.editor.create(document.getElementById('editor-container'), {
          model: unifiedModel,
          theme: isDark ? 'app-dark-theme' : 'app-light-theme',
          automaticLayout: true,
          fontSize: editorFontSize,
          lineHeight: getEditorLineHeight(),
          fontFamily: "'JetBrains Mono', Consolas, monospace",
          minimap: { enabled: false },
          lineNumbers: 'on',
          lineNumbersMinChars: isMobile ? 2 : 3,
          lineDecorationsWidth: isMobile ? 8 : 24,
          glyphMargin: false,
          folding: !isMobile,
          roundedSelection: true,
          scrollBeyondLastLine: false,
          tabSize: 2,
          wordWrap: 'on',
          largeFileOptimizations: true,
          fixedOverflowWidgets: true,
          bracketPairColorization: { enabled: false },
          guides: { bracketPairs: false, indentation: false },
          occurrencesHighlight: false,
          selectionHighlight: false,
          colorDecorators: false,
          padding: { top: 16 }
        });
        initMonacoTouchScroll();

        let activeLineNumberDecorations = [];
        const syncActiveLineNumber = () => {
          const lineNumber = editor.getPosition()?.lineNumber;
          activeLineNumberDecorations = editor.deltaDecorations(
            activeLineNumberDecorations,
            lineNumber ? [{
              range: new monaco.Range(lineNumber, 1, lineNumber, 1),
              options: { lineNumberClassName: 'viewer-active-line-number' }
            }] : []
          );
        };
        editor.onDidChangeCursorPosition(syncActiveLineNumber);
        editor.onDidChangeModel(syncActiveLineNumber);
        syncActiveLineNumber();

        syncEditorZoomGutter();

        // Initial render
        updateEditorPlaceholder();
        updatePreview();
        queueEditorLayout();
        if (document.activeElement === fallbackTextarea) {
          editor.focus();
        }

        // Evento de pegado para actualizar al instante
        editor.onDidPaste(() => {
          allowPreviewFocusOnNextRender();
          schedulePreviewUpdate({ force: true });
        });

        // Monaco-specific keybindings
          editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, triggerExport);
          editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyO, triggerImport);
          editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyP, triggerPreviewFull);
          editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, triggerPreviewFull);

          settled = true;
          clearTimeout(timeoutId);
          resolve(true);
        } catch (error) {
          fail(error);
        }
      }, function (err) {
        fail(err);
      });
    } catch (e) {
      fail(e);
    }
  });

  const ensureLoader = typeof window.require === 'undefined'
    ? loadScript(MONACO_LOADER_PATH)
    : Promise.resolve();

  monacoLoadPromise = ensureLoader
    .then(startMonacoLoad)
    .catch((err) => {
      console.warn('Monaco failed to load; keeping the fallback editor available.', err);
      if (!monacoLoadFailureToastShown) {
        monacoLoadFailureToastShown = true;
        showToast(t('toast_offline_mode'), 'info');
      }
      monacoLoadPromise = null;
      return false;
    });

  return monacoLoadPromise;
}

// Start Monaco immediately after the first paint. Interaction remains a retry
// path if a deployment is incomplete or the request times out.
let monacoLoadTriggered = false;
let monacoAutomaticRetryCount = 0;
function triggerMonacoLazyLoad() {
  if (monacoLoaded || monacoLoadTriggered) return;
  monacoLoadTriggered = true;
  upgradeToMonaco().then((loaded) => {
    monacoLoadTriggered = false;
    if (loaded && editorBodyArea) {
      ['mouseenter', 'pointerdown', 'focusin'].forEach((eventName) => {
        editorBodyArea.removeEventListener(eventName, triggerMonacoLazyLoad);
      });
    } else if (!loaded && monacoAutomaticRetryCount < MONACO_MAX_AUTOMATIC_RETRIES) {
      monacoAutomaticRetryCount += 1;
      setTimeout(triggerMonacoLazyLoad, MONACO_RETRY_DELAY_MS);
    }
  });
}

const editorBodyArea = document.querySelector('.editor-body-area');
if (editorBodyArea) {
  ['mouseenter', 'pointerdown', 'focusin'].forEach((eventName) => {
    editorBodyArea.addEventListener(eventName, triggerMonacoLazyLoad);
  });
}

// Dynamic scripts do not block the current bundle or the fallback editor. Now
// that Monaco is same-origin, starting the request immediately is both the
// fastest and the most deterministic path, including in background tabs.
triggerMonacoLazyLoad();

// Update the iframe live preview content
function updatePreview() {
  if (editorMode === 'split') {
    markProjectPreviewDirty(null, { all: true });
  }
  schedulePreviewUpdate({ force: true });
}

// Keyboard Action Helpers
function triggerExport() {
  const btn = document.getElementById('btn-export');
  if (btn) btn.click();
}

function triggerImport() {
  const btn = document.getElementById('btn-import');
  if (btn) btn.click();
}

function triggerPreviewFull() {
  const btn = document.getElementById('btn-preview-full');
  if (btn) btn.click();
}

function triggerPreviewReload() {
  // Clear sessionStorage (safe for editor as it doesn't use it)
  try {
    sessionStorage.clear();
  } catch (e) {}

  // Clear localStorage keys that do not belong to editor preferences
  try {
    const EDITOR_KEYS = new Set(['theme', 'split-percent', 'explorer-width', 'cookie-consent-preferences']);
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && !EDITOR_KEYS.has(key)) {
        localStorage.removeItem(key);
      }
    }
  } catch (e) {}

  // Clear cookies set by the previewed site
  try {
    const cookies = document.cookie.split(";");
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i];
      const eqPos = cookie.indexOf("=");
      const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
      document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
    }
  } catch (e) {}

  // Clear IndexedDB databases created by previewed scripts
  try {
    if (window.indexedDB && typeof window.indexedDB.databases === 'function') {
      window.indexedDB.databases().then(dbs => {
        dbs.forEach(db => {
          if (db.name) {
            window.indexedDB.deleteDatabase(db.name);
          }
        });
      }).catch(err => {});
    }
  } catch (e) {}

  // Clear Cache Storage used by previewed scripts
  try {
    if (window.caches && typeof window.caches.keys === 'function') {
      window.caches.keys().then(keys => {
        keys.forEach(key => {
          window.caches.delete(key);
        });
      }).catch(err => {});
    }
  } catch (e) {}

  allowPreviewFocusOnNextRender();
  returnPreviewToHome();
}

function triggerFocusMode() {
  const btn = document.getElementById('btn-highlight-full');
  if (btn) btn.click();
}

// Global keyboard shortcuts
window.addEventListener('keydown', (e) => {
  const isCtrlOrCmd = e.ctrlKey || e.metaKey;
  if (isCtrlOrCmd) {
    let handled = true;
    switch (e.key.toLowerCase()) {
      case 's':
        triggerExport();
        break;
      case 'o':
        triggerImport();
        break;
      case 'p':
        triggerPreviewFull();
        break;
      default:
        handled = false;
    }

    if (e.key === 'Enter') {
      triggerPreviewFull();
      handled = true;
    }

    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  }
});

// Interceptar Deshacer (Ctrl+Z) y Rehacer (Ctrl+Y / Ctrl+Shift+Z) en fase de captura para anular Monaco
window.addEventListener('keydown', (e) => {
  const isCtrlOrCmd = e.ctrlKey || e.metaKey;
  if (isCtrlOrCmd) {
    const key = e.key.toLowerCase();
    if (key === 'z') {
      if (e.shiftKey) {
        triggerRedo();
      } else {
        triggerUndo();
      }
      e.preventDefault();
      e.stopPropagation();
    } else if (key === 'y') {
      triggerRedo();
      e.preventDefault();
      e.stopPropagation();
    }
  }
}, true);

function setEditorValue(value) {
  if (!editor) return;
  saveHistoryState();
  const wasRestoring = isRestoringHistory;
  isRestoringHistory = true;
  try {
    if (monacoLoaded) {
      if (editorMode === 'unified') {
        cameFromSplitMode = false;
        const rootFolder = getProjectRootFolder();
        files = [
          createTextFileRecord(rootFolder + 'index.html', value, { id: '1' })
        ];
        openFileIds = ['1'];
        selectedEntryFileId = '1';

        const model = unifiedModel;
        if (model) {
          editor.executeEdits("history-action", [{
            range: model.getFullModelRange(),
            text: value,
            forceMoveMarkers: true
          }]);
        }
      } else {
        if (value === '') {
          // Clear all files, keep index.html empty
          const rootFolder = getProjectRootFolder();
          files = [
            createTextFileRecord(rootFolder + 'index.html', '', { id: '1' })
          ];
          openFileIds = ['1'];

          disposeAllFileModels();
          normalizeProjectFiles();
          syncModelsForFiles();
          openFile('1');
        } else {
          const { html, css, js } = splitUnifiedCode(value);
          const rootFolder = getProjectRootFolder();
          files = [
            createTextFileRecord(rootFolder + 'index.html', html, { id: '1' }),
            createTextFileRecord(rootFolder + 'styles.css', css, { id: '2' }),
            createTextFileRecord(rootFolder + 'script.js', js, { id: '3' })
          ];
          openFileIds = ['1'];
          selectedEntryFileId = '1';

          disposeAllFileModels();
          normalizeProjectFiles();
          syncModelsForFiles();
          openFile('1');
        }
      }
      if (window.innerWidth > COMPACT_LAYOUT_MAX_WIDTH) {
        editor.focus();
      }
      updateEditorPlaceholder();
      updatePreview();
    } else {
      editor.setValue(value);
    }
  } finally {
    isRestoringHistory = wasRestoring;
  }
}
