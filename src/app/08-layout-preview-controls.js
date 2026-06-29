// Draggable split pane resizing logic
const handle = document.getElementById('resize-handle');
const overlay = document.getElementById('resize-overlay');
const editorPanel = document.getElementById('editor-panel');
const previewPanel = document.getElementById('preview-panel');
const workspace = document.getElementById('workspace-container');
let resizeLayoutFrame = 0;
const DEFAULT_EDITOR_PANEL_MIN_WIDTH = 420;
const DEFAULT_PREVIEW_PANEL_MIN_WIDTH = 420;
const MIN_SPLIT_PERCENT = 12;
const MAX_SPLIT_PERCENT = 88;

function queueEditorLayout() {
  if (!editor || resizeLayoutFrame) return;

  resizeLayoutFrame = requestAnimationFrame(() => {
    resizeLayoutFrame = 0;
    editor.layout();
    if (typeof syncEditorZoomGutter === 'function') {
      syncEditorZoomGutter();
    }
  });
}

function readLayoutPixelVar(name, fallback) {
  const sources = [workspace, document.documentElement];

  for (const source of sources) {
    if (!source) continue;
    const value = Number.parseFloat(getComputedStyle(source).getPropertyValue(name));
    if (Number.isFinite(value)) return value;
  }

  return fallback;
}

function getHorizontalMargins(element) {
  if (!element) return 0;
  const styles = getComputedStyle(element);
  const marginLeft = Number.parseFloat(styles.marginLeft) || 0;
  const marginRight = Number.parseFloat(styles.marginRight) || 0;
  return marginLeft + marginRight;
}

function getOuterInlineSize(element) {
  if (!element) return 0;
  return element.getBoundingClientRect().width + getHorizontalMargins(element);
}

function getSplitLayoutMetrics(workspaceWidth) {
  const editorMinWidth = readLayoutPixelVar('--editor-panel-min', DEFAULT_EDITOR_PANEL_MIN_WIDTH);
  const previewMinWidth = readLayoutPixelVar('--preview-panel-min', DEFAULT_PREVIEW_PANEL_MIN_WIDTH);
  const chromeWidth =
    getHorizontalMargins(editorPanel) +
    getOuterInlineSize(handle) +
    getHorizontalMargins(previewPanel);

  return {
    editorMinWidth,
    previewMinWidth,
    chromeWidth,
    availableWidth: Math.max(0, workspaceWidth - chromeWidth)
  };
}

function clampSplitPercent(percentage, workspaceWidth = workspace?.getBoundingClientRect().width || 0) {
  const fallback = Math.min(MAX_SPLIT_PERCENT, Math.max(MIN_SPLIT_PERCENT, percentage));
  if (!Number.isFinite(workspaceWidth) || workspaceWidth <= 0) return fallback;

  const { editorMinWidth, previewMinWidth, chromeWidth, availableWidth } = getSplitLayoutMetrics(workspaceWidth);
  const minByEditor = (editorMinWidth / workspaceWidth) * 100;
  const maxByPreview = ((workspaceWidth - chromeWidth - previewMinWidth) / workspaceWidth) * 100;
  const minPercent = Math.max(MIN_SPLIT_PERCENT, minByEditor);
  const maxPercent = Math.min(MAX_SPLIT_PERCENT, maxByPreview);

  if (minPercent >= maxPercent) {
    const balancedPercent = ((availableWidth * 0.5) / workspaceWidth) * 100;
    return Math.min(MAX_SPLIT_PERCENT, Math.max(MIN_SPLIT_PERCENT, balancedPercent));
  }

  return Math.min(maxPercent, Math.max(minPercent, percentage));
}

function initResizer() {
  // Load saved split position
  const savedPercent = parseFloat(localStorage.getItem('split-percent') || '55');
  // Agrupar lectura y escritura con requestAnimationFrame para evitar forced reflow en la carga inicial
  requestAnimationFrame(() => {
    const workspaceWidth = workspace?.getBoundingClientRect().width || 0;
    const initialPercent = clampSplitPercent(Number.isFinite(savedPercent) ? savedPercent : 55, workspaceWidth);
    workspace.style.setProperty('--split-percent', `${initialPercent}%`);
  });

  // Layout offsets to align handle center with cursor
  let offsetFromEditorRight = 6;
  let editorLeftMargin = 16;
  let dragWorkspaceLeft = 0;
  let dragWorkspaceWidth = 1;
  let dragHandleTop = 0;
  let dragHandleHeight = 1;

  // Helper to update the Y position of the line relative to the handle
  function updateMouseY(e) {
    const clientY = (e.touches && e.touches.length > 0) ? e.touches[0].clientY : e.clientY;
    if (clientY === undefined) return;
    if (!isResizing) {
      const handleRect = handle.getBoundingClientRect();
      dragHandleTop = handleRect.top;
      dragHandleHeight = handleRect.height;
    }
    const lineHalfHeight = 40;
    const minY = lineHalfHeight;
    const maxY = Math.max(minY, dragHandleHeight - lineHalfHeight);
    const y = Math.max(minY, Math.min(maxY, clientY - dragHandleTop));
    handle.style.setProperty('--mouse-y', `${y}px`);
  }

  // Update position on hover/movement over handle
  handle.addEventListener('mousemove', updateMouseY);
  handle.addEventListener('touchmove', updateMouseY, { passive: true });

  handle.addEventListener('mousedown', startDrag);
  handle.addEventListener('touchstart', startDrag, { passive: true });

  function startDrag(e) {
    isResizing = true;
    overlay.classList.add('active');
    handle.classList.add('active');

    // Measure layout offsets once at the start of the drag to avoid layout thrashing
    const workspaceRect = workspace.getBoundingClientRect();
    const editorRect = editorPanel.getBoundingClientRect();
    const handleRect = handle.getBoundingClientRect();

    offsetFromEditorRight = (handleRect.left + handleRect.width / 2) - editorRect.right;
    editorLeftMargin = editorRect.left - workspaceRect.left;
    dragWorkspaceLeft = workspaceRect.left;
    dragWorkspaceWidth = workspaceRect.width;
    dragHandleTop = handleRect.top;
    dragHandleHeight = handleRect.height;

    updateMouseY(e);

    document.addEventListener('mousemove', drag);
    document.addEventListener('touchmove', drag, { passive: false });
    document.addEventListener('mouseup', stopDrag);
    document.addEventListener('touchend', stopDrag);
  }

  function drag(e) {
    if (!isResizing) return;
    if (e.cancelable) e.preventDefault();

    // Support touch and mouse
    const clientX = (e.touches && e.touches.length > 0) ? e.touches[0].clientX : e.clientX;

    // Calculate target editor width to center handle on cursor
    const targetEditorWidth = clientX - dragWorkspaceLeft - editorLeftMargin - offsetFromEditorRight;
    let percentage = (targetEditorWidth / dragWorkspaceWidth) * 100;
    percentage = clampSplitPercent(percentage, dragWorkspaceWidth);

    workspace.style.setProperty('--split-percent', `${percentage}%`);

    // Also update Y position of handle line during drag
    updateMouseY(e);

    queueEditorLayout();
  }

  function stopDrag() {
    if (!isResizing) return;
    isResizing = false;
    overlay.classList.remove('active');
    handle.classList.remove('active');

    // Save position to localStorage
    const workspaceRect = workspace.getBoundingClientRect();
    const editorRect = editorPanel.getBoundingClientRect();
    const currentPercent = clampSplitPercent((editorRect.width / workspaceRect.width) * 100, workspaceRect.width);
    localStorage.setItem('split-percent', currentPercent);

    document.removeEventListener('mousemove', drag);
    document.removeEventListener('touchmove', drag);
    document.removeEventListener('mouseup', stopDrag);
    document.removeEventListener('touchend', stopDrag);
  }
}

function initExplorerResizer() {
  const explorer = document.getElementById('file-explorer');
  const resizer = document.getElementById('explorer-resizer');
  const overlay = document.getElementById('resize-overlay');

  if (!explorer || !resizer || !overlay) return;

  // Load saved explorer width
  const savedWidth = localStorage.getItem('explorer-width') || '220';
  let initialWidth = parseInt(savedWidth, 10);
  if (isNaN(initialWidth) || initialWidth < 170) {
    initialWidth = 170;
  } else if (initialWidth > 500) {
    initialWidth = 500;
  }
  explorer.style.setProperty('--explorer-width', `${initialWidth}px`);

  let startX = 0;
  let startWidth = 0;
  let isExplorerResizing = false;

  resizer.addEventListener('mousedown', startDrag);
  resizer.addEventListener('touchstart', startDrag, { passive: true });

  function startDrag(e) {
    isExplorerResizing = true;
    overlay.classList.add('active');
    resizer.classList.add('active');
    explorer.classList.add('resizing');

    startX = (e.touches && e.touches.length > 0) ? e.touches[0].clientX : e.clientX;
    const computedStyle = window.getComputedStyle(explorer);
    startWidth = parseInt(computedStyle.width, 10);

    document.addEventListener('mousemove', drag);
    document.addEventListener('touchmove', drag, { passive: false });
    document.addEventListener('mouseup', stopDrag);
    document.addEventListener('touchend', stopDrag);
  }

  function drag(e) {
    if (!isExplorerResizing) return;
    if (e.cancelable) e.preventDefault();

    const clientX = (e.touches && e.touches.length > 0) ? e.touches[0].clientX : e.clientX;
    const offset = clientX - startX;
    let newWidth = startWidth + offset;

    // Constrain width
    if (newWidth < 170) newWidth = 170;
    if (newWidth > 500) newWidth = 500;

    explorer.style.setProperty('--explorer-width', `${newWidth}px`);
    queueEditorLayout();
  }

  function stopDrag() {
    if (!isExplorerResizing) return;
    isExplorerResizing = false;

    overlay.classList.remove('active');
    resizer.classList.remove('active');
    explorer.classList.remove('resizing');

    const computedStyle = window.getComputedStyle(explorer);
    const finalWidth = parseInt(computedStyle.width, 10);
    localStorage.setItem('explorer-width', finalWidth);

    document.removeEventListener('mousemove', drag);
    document.removeEventListener('touchmove', drag);
    document.removeEventListener('mouseup', stopDrag);
    document.removeEventListener('touchend', stopDrag);

    queueEditorLayout();
  }
}

// Initialize dragging on load
initResizer();
initExplorerResizer();



// Responsive Emulator sizing controls
const controlButtons = document.querySelectorAll('.control-btn[data-size]');
const iframeWrapper = document.getElementById('iframe-wrapper');
const previewHomeBtn = document.getElementById('btn-preview-home');
const previewReloadBtn = document.getElementById('btn-preview-reload');

controlButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    controlButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const size = btn.getAttribute('data-size');
    iframeWrapper.className = 'iframe-wrapper'; // Reset

    if (size === '375px') {
      iframeWrapper.classList.add('restricted-mobile');
    } else if (size === '768px') {
      iframeWrapper.classList.add('restricted-tablet');
    }

    queueEditorLayout();
  });
});

if (previewHomeBtn) {
  previewHomeBtn.addEventListener('click', returnPreviewToHome);
}

if (previewReloadBtn) {
  previewReloadBtn.addEventListener('click', () => {
    previewReloadBtn.classList.remove('is-spinning');
    void previewReloadBtn.offsetWidth;
    previewReloadBtn.classList.add('is-spinning');
    triggerPreviewReload();
  });

  previewReloadBtn.addEventListener('animationend', (event) => {
    if (event.animationName === 'spin-once') {
      previewReloadBtn.classList.remove('is-spinning');
    }
  });
}

// Sidebar Navigation / Actions

// 1. Preview (Full Page)
document.getElementById('btn-preview-full').addEventListener('click', async () => {
  if (!editor) return;
  try {
    const previewWindow = window.open('', '_blank');
    if (!previewWindow) {
      showToast(t('toast_popup_blocked'), 'error');
      return;
    }

    const entryFile = getEntryFile();
    if (!entryFile) {
      previewWindow.document.open();
      previewWindow.document.write(createEmptyProjectPreviewCode());
      previewWindow.document.close();
      return;
    }

    const hasProjectPreview = await syncProjectPreviewSnapshot({ full: true });
    if (hasProjectPreview) {
      previewWindow.location.href = `${getProjectPreviewUrl(entryFile.name)}?v=${projectPreviewVersion}`;
      showToast(t('toast_project_opened_virtual'));
      return;
    }

    const { code, urlsToRevoke } = createFullPagePreviewSnapshot();
    previewWindow.document.open();
    previewWindow.document.write(code);
    previewWindow.document.close();
    setTimeout(() => {
      urlsToRevoke.forEach(url => URL.revokeObjectURL(url));
    }, 10 * 60 * 1000);
    showToast(t('toast_full_page_opened'));
  } catch (err) {
    showToast(t('toast_page_open_error'), 'error');
  }
});

// 2. Highlight (Full Page) / Focus Mode Toggle
document.getElementById('btn-highlight-full').addEventListener('click', () => {
  const appContainer = document.querySelector('.app-container');
  const btn = document.getElementById('btn-highlight-full');
  const icon = btn.querySelector('i');

  if (appContainer.classList.contains('fullscreen-editor')) {
    appContainer.classList.remove('fullscreen-editor');
    btn.classList.remove('active');
    icon.setAttribute('data-lucide', 'maximize-2');
  } else {
    appContainer.classList.add('fullscreen-editor');
    btn.classList.add('active');
    icon.setAttribute('data-lucide', 'minimize-2');
  }

  // Re-render Lucide icon
  lucide.createIcons();

  queueEditorLayout();
});

// 3. Sample
document.getElementById('btn-sample').addEventListener('click', () => {
  if (!editor) return;
  setEditorValue(DEFAULT_SAMPLE_CODE);
  showToast(t('toast_sample_loaded'));
});

// 4. Clear
document.getElementById('btn-clear').addEventListener('click', () => {
  if (!editor) return;
  setEditorValue('');
  showToast(t('toast_editor_cleared'));
});

// 5. Import from File / ZIP / Drag-and-Drop Folder
const fileInput = document.getElementById('file-input');
const assetInput = document.getElementById('asset-input');
document.getElementById('btn-import').addEventListener('click', () => {
  fileInput.click();
});

fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const ext = getFileExtension(file.name);
  if (ext === 'zip') {
    await importFromZip(file);
  } else if (ext === 'html' || ext === 'htm') {
    importSingleHtmlFile(file);
  } else {
    showToast(t('toast_format_not_supported'), 'error');
  }
  fileInput.value = '';
});

if (assetInput) {
  assetInput.addEventListener('change', async (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    const records = [];
    for (const file of selectedFiles) {
      if (file.name.startsWith('.')) continue;
      records.push(await createRecordFromBrowserFile(file, pendingAssetTargetPath));
    }

    addFilesToProject(records, '');
    showToast(t('toast_files_added', { count: records.length }));
    pendingAssetTargetPath = '';
    assetInput.value = '';
  });
}

// 6. Export to File / Project Folder / ZIP
document.getElementById('btn-export').addEventListener('click', () => {
  if (!editor) return;
  if (editorMode === 'unified') {
    try {
      const code = getCurrentPreviewCode();
      const blob = new Blob([code], { type: 'text/html;charset=utf-8' });
      const link = document.createElement('a');

      // Get custom filename
      let filename = filenameInput ? filenameInput.value.trim() : 'index';
      if (!filename) filename = 'index';
      if (filename.toLowerCase().endsWith('.html')) {
        filename = filename.substring(0, filename.length - 5);
      }
      const fullName = `${filename}.html`;

      const downloadUrl = URL.createObjectURL(blob);
      link.href = downloadUrl;
      link.download = fullName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
      showToast(t('toast_file_exported_as', { name: fullName }));
    } catch (err) {
      showToast(t('toast_export_error'), 'error');
    }
  } else {
    openModal('modal-export');
  }
});

// Resizing and panel alignment updates on window resize
window.addEventListener('resize', () => {
  if (editorMode === 'split' && workspace) {
    const workspaceWidth = workspace.getBoundingClientRect().width || 0;
    const currentPercent = Number.parseFloat(workspace.style.getPropertyValue('--split-percent')) || 55;
    const clamped = clampSplitPercent(currentPercent, workspaceWidth);
    workspace.style.setProperty('--split-percent', `${clamped}%`);
  }
  if (editor) {
    queueEditorLayout();
  }
  
  // Close drawer if resized beyond mobile viewport threshold
  if (window.innerWidth > COMPACT_LAYOUT_MAX_WIDTH) {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar && sidebar.classList.contains('open')) {
      sidebar.classList.remove('open');
      if (overlay) overlay.classList.remove('active');
      sidebar.removeAttribute('aria-hidden');
      sidebar.inert = false;
    }
  }
});
