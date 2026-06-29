function createFileSnapshot(file) {
  return {
    id: file.id,
    name: file.name,
    content: getFileText(file),
    type: file.type,
    mimeType: file.mimeType,
    isBinary: file.isBinary,
    blob: file.blob,
    isFolder: file.isFolder,
    size: file.size,
    order: file.order
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
    order: file.order
  };
}

function getActiveEditorViewState() {
  const activeFile = files.find(file => file.id === activeFileId);
  if (!monacoLoaded || !editor || !activeFileId || !isEditableFile(activeFile)) {
    return null;
  }
  return editor.saveViewState();
}

function createHistorySnapshot() {
  return {
    files: files.map(createFileSnapshot),
    activeFileId,
    openFileIds: [...openFileIds],
    selectedEntryFileId,
    editorMode,
    viewState: getActiveEditorViewState()
  };
}

function saveHistoryState() {
  if (isRestoringHistory) return;

  // Clear redo stack when a new action is performed
  redoStack.length = 0;

  undoStack.push(createHistorySnapshot());
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

async function applyHistoryState(state) {
  if (!state) return;
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

    // Restore editor mode if changed
    if (state.editorMode && state.editorMode !== editorMode) {
      await switchEditorMode(state.editorMode, false);
    }

    // Restore tabs and active file
    openFileIds = [...state.openFileIds];
    activeFileId = state.activeFileId;
    selectedEntryFileId = state.selectedEntryFileId || '';
    syncModelsForFiles();

    // Update UI elements
    renderFileExplorer();
    renderActiveFileSummary();
    updateEntryHtmlSelector();
    updateFileNameExtension();
    updateEditorPlaceholder();

    if (activeFileId) {
      if (monacoLoaded && fileModels[activeFileId]) {
        editor.setModel(fileModels[activeFileId]);
        if (state.viewState) {
          editor.restoreViewState(state.viewState);
        }
      } else if (!monacoLoaded) {
        const file = files.find(f => f.id === activeFileId);
        fallbackTextarea.value = file ? file.content : '';
      }
    } else {
      if (monacoLoaded) {
        editor.setModel(null);
      } else {
        fallbackTextarea.value = '';
      }
    }

    updatePreview();
    updateHistoryButtons();
  } finally {
    isRestoringHistory = false;
  }
}

function triggerUndo() {
  if (undoStack.length === 0) return;

  // Save current state to redo stack
  redoStack.push(createHistorySnapshot());

  const prevState = undoStack.pop();
  applyHistoryState(prevState);
}

function triggerRedo() {
  if (redoStack.length === 0) return;

  // Save current state to undo stack
  undoStack.push(createHistorySnapshot());

  const nextState = redoStack.pop();
  applyHistoryState(nextState);
}

function handleTextChange() {
  if (isRestoringHistory) return;

  if (!typingSessionActive) {
    saveHistoryState();
    typingSessionActive = true;
  }

  if (typingDebounceTimeout) {
    clearTimeout(typingDebounceTimeout);
  }

  typingDebounceTimeout = setTimeout(() => {
    typingSessionActive = false;
  }, 1000);
}
