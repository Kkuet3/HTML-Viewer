function createFileSnapshot(file, { contentOverrides = null, unifiedContent = undefined } = {}) {
  const override = contentOverrides && Object.prototype.hasOwnProperty.call(contentOverrides, file.id)
    ? contentOverrides[file.id]
    : undefined;
  const content = override !== undefined
    ? override
    : (unifiedContent !== undefined && editorMode === 'unified' && file.id === getEntryFile()?.id
      ? unifiedContent
      : getFileText(file));
  return {
    id: file.id,
    name: file.name,
    content,
    type: file.type,
    mimeType: file.mimeType,
    isBinary: file.isBinary,
    blob: file.blob,
    isFolder: file.isFolder,
    size: file.size,
    order: file.order,
    dataUrl: file.dataUrl
  };
}

function restoreFileSnapshot(file) {
  return {
    id: file.id,
    name: file.name,
    content: file.content,
    type: file.type,
    mimeType: file.mimeType,
    isBinary: file.isBinary,
    blob: file.blob,
    isFolder: file.isFolder,
    size: file.size,
    order: file.order,
    dataUrl: file.dataUrl
  };
}

function getActiveEditorViewState() {
  const activeFile = files.find(file => file.id === activeFileId);
  if (!monacoLoaded || !editor || !activeFileId || !isEditableFile(activeFile)) {
    return null;
  }
  return editor.saveViewState();
}

function createHistorySnapshot(options = {}) {
  const unifiedContent = options.unifiedContent !== undefined
    ? options.unifiedContent
    : (editorMode === 'unified'
      ? (monacoLoaded ? unifiedModel?.getValue?.() : fallbackTextarea?.value || '')
      : '');
  return {
    files: files.map(file => createFileSnapshot(file, {
      contentOverrides: options.contentOverrides,
      unifiedContent
    })),
    activeFileId,
    openFileIds: [...openFileIds],
    selectedEntryFileId,
    editorMode,
    cameFromSplitMode,
    unifiedContent,
    visibleFilename: filenameInput?.value || '',
    projectPath: previewLifecycle.projectPath,
    projectSearch: previewLifecycle.projectSearch,
    projectHash: previewLifecycle.projectHash,
    viewState: getActiveEditorViewState()
  };
}

function saveHistoryState(options = {}) {
  if (isRestoringHistory) return;

  // Clear redo stack when a new action is performed
  redoStack.length = 0;

  undoStack.push(createHistorySnapshot(options));
  if (undoStack.length > MAX_HISTORY) {
    undoStack.shift();
  }

  updateHistoryButtons();
}

function updateHistoryButtons() {
  const undoBtn = document.getElementById('btn-undo');
  const redoBtn = document.getElementById('btn-redo');

  if (undoBtn) {
    undoBtn.disabled = undoStack.length === 0;
  }
  if (redoBtn) {
    redoBtn.disabled = redoStack.length === 0;
  }
}

async function restoreHistoryState(state) {
  if (!state) return;
  historyRestoreInProgress = true;
  isRestoringHistory = true;

  try {
    const newFileIds = new Set(state.files.map(f => f.id));

    // Dispose models for files that are no longer present
    for (const fileId in fileModels) {
      if (!newFileIds.has(fileId)) {
        if (fileModels[fileId]) {
          fileModels[fileId].dispose();
          delete fileModels[fileId];
        }
      }
    }

    // Restore files array (cloned to avoid mutating history records)
    files = state.files.map(restoreFileSnapshot);

    // Keep existing Monaco models in sync, but avoid creating models for the
    // entire project when restoring large file trees.
    if (monacoLoaded) {
      files.forEach(file => {
        if (isEditableFile(file) && fileModels[file.id]) {
          if (fileModels[file.id].getValue() !== file.content) {
            fileModels[file.id].setValue(file.content || '');
          }
        }
      });
    }

    // Restore tabs and active file before reconnecting a model.  This gives
    // both the fallback editor and Monaco the same document contract.
    openFileIds = [...(state.openFileIds || [])];
    activeFileId = state.activeFileId || '';
    selectedEntryFileId = state.selectedEntryFileId || '';

    // Restore editor mode if changed.  Rendering is deferred until all model
    // values below have been installed.
    if (state.editorMode && state.editorMode !== editorMode) {
      await switchEditorMode(state.editorMode, false, { render: false });
    }

    cameFromSplitMode = Boolean(state.cameFromSplitMode);
    syncModelsForFiles();

    if (monacoLoaded && unifiedModel && state.unifiedContent !== undefined) {
      if (unifiedModel.getValue() !== state.unifiedContent) {
        unifiedModel.setValue(state.unifiedContent || '');
      }
    }

    const restoredEntry = files.find(file => file.id === selectedEntryFileId) || getEntryFile();
    if (editorMode === 'unified' && restoredEntry && state.unifiedContent !== undefined) {
      restoredEntry.content = state.unifiedContent || '';
      restoredEntry.size = new Blob([restoredEntry.content]).size;
    }

    // Update UI elements
    renderFileExplorer();
    renderActiveFileSummary();
    updateEntryHtmlSelector();
    updateFileNameExtension();
    updateEditorPlaceholder();

    if (editorMode === 'unified') {
      if (monacoLoaded && unifiedModel) {
        editor.setModel(unifiedModel);
        if (state.viewState) editor.restoreViewState(state.viewState);
      } else if (!monacoLoaded) {
        fallbackTextarea.value = state.unifiedContent ?? '';
        fallbackLastKnownValue = fallbackTextarea.value;
      }
    } else if (activeFileId) {
      if (monacoLoaded && fileModels[activeFileId]) {
        editor.setModel(fileModels[activeFileId]);
        if (state.viewState) {
          editor.restoreViewState(state.viewState);
        }
      } else if (!monacoLoaded) {
        const file = files.find(f => f.id === activeFileId);
        fallbackTextarea.value = file ? file.content : '';
        fallbackLastKnownValue = fallbackTextarea.value;
      }
    } else {
      if (monacoLoaded) {
        editor.setModel(null);
      } else {
        fallbackTextarea.value = '';
      }
    }

    if (filenameInput && state.visibleFilename) {
      filenameInput.value = state.visibleFilename;
      adjustFilenameWidth?.();
    }
    const restoredPreviewPath = editorMode === 'split'
      ? (state.projectPath || getEntryFile()?.name || '')
      : '';
    if (restoredPreviewPath) {
      setProjectPreviewLocation(getProjectPreviewUrl(restoredPreviewPath), restoredPreviewPath);
      previewLifecycle.projectSearch = state.projectSearch || '';
      previewLifecycle.projectHash = state.projectHash || '';
    } else {
      resetProjectPreviewLocation();
    }
    updatePreview({
      reason: 'history-restore',
      force: true,
      full: editorMode === 'split',
      forceNavigation: true,
      targetPath: restoredPreviewPath
    });
    window.scheduleRecoverySave?.();
    updateHistoryButtons();
  } finally {
    isRestoringHistory = false;
    historyRestoreInProgress = false;
  }
}

function applyHistoryState(state) {
  if (!state || historyRestoreInProgress) return historyRestorePromise;
  historyRestorePromise = restoreHistoryState(state)
    .catch(error => {
      console.error('No se pudo restaurar el historial', error);
    });
  return historyRestorePromise;
}

function triggerUndo() {
  if (undoStack.length === 0 || historyRestoreInProgress) return;

  // Save current state to redo stack
  redoStack.push(createHistorySnapshot());

  const prevState = undoStack.pop();
  applyHistoryState(prevState);
}

function triggerRedo() {
  if (redoStack.length === 0 || historyRestoreInProgress) return;

  // Save current state to undo stack
  undoStack.push(createHistorySnapshot());

  const nextState = redoStack.pop();
  applyHistoryState(nextState);
}

function handleTextChange(snapshotOptions = {}) {
  if (isRestoringHistory) return;

  if (!typingSessionActive) {
    saveHistoryState(snapshotOptions);
    typingSessionActive = true;
  }

  if (typingDebounceTimeout) {
    clearTimeout(typingDebounceTimeout);
  }

  typingDebounceTimeout = setTimeout(() => {
    typingSessionActive = false;
  }, 1000);
}
