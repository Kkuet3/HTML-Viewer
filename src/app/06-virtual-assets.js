// Map to store current virtual Blob URLs
const virtualBlobUrls = {};
// Cache to store details of previously created blob URLs
// Structure: file.name -> { url, rawContent, resolvedContent, sourceBlob }
const blobUrlCache = {};

function cleanupVirtualBlobUrlCache() {
  const activeFileNames = new Set(files.filter(f => !f.isFolder).map(f => f.name));

  for (const name in blobUrlCache) {
    if (!activeFileNames.has(name)) {
      URL.revokeObjectURL(blobUrlCache[name].url);
      delete blobUrlCache[name];
    }
  }

  for (const key in virtualBlobUrls) {
    if (!activeFileNames.has(key)) {
      delete virtualBlobUrls[key];
    }
  }
}

function findFileByCanonicalPath(canonicalPath) {
  const lookupPath = normalizeProjectPath(canonicalPath).toLowerCase();
  return files.find(item => !item.isFolder && item.name.toLowerCase() === lookupPath) || null;
}

function resolveReferenceValueLazy(refPath, hostFilename, resolver) {
  const { suffix } = splitPathSuffix(refPath);
  for (const candidatePath of getReferencePathCandidates(hostFilename, refPath)) {
    const resolved = resolver(candidatePath);
    if (resolved) return `${resolved}${suffix}`;
  }
  return null;
}

function resolveSrcsetLazy(value, hostFilename, resolver) {
  return value.split(',').map(part => {
    const trimmed = part.trim();
    if (!trimmed) return part;
    const pieces = trimmed.split(/\s+/);
    const resolved = resolveReferenceValueLazy(pieces[0], hostFilename, resolver);
    if (!resolved) return part;
    pieces[0] = resolved;
    return pieces.join(' ');
  }).join(', ');
}

function resolveCssUrlsLazy(content, hostFilename, resolver) {
  let result = content.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (match, quote, refPath) => {
    const resolved = resolveReferenceValueLazy(refPath.trim(), hostFilename, resolver);
    if (!resolved) return match;
    const safeQuote = quote || '"';
    return `url(${safeQuote}${resolved}${safeQuote})`;
  });

  result = result.replace(/@import\s+(?:url\(\s*)?(['"]?)([^'")\s]+)\1\s*\)?/gi, (match, quote, refPath) => {
    const resolved = resolveReferenceValueLazy(refPath.trim(), hostFilename, resolver);
    if (!resolved) return match;
    return rewriteCssImportReference(match, quote, refPath, resolved);
  });

  return result;
}

function resolveVirtualPathsLazy(content, entryFilename, resolver) {
  let result = content.replace(/\b(href|src|action|poster)\s*=\s*(['"])([^'"]+)\2/gi, (match, attr, quote, refPath) => {
    const resolved = resolveReferenceValueLazy(refPath, entryFilename, resolver);
    if (resolved) {
      return `${attr}=${quote}${resolved}${quote}`;
    }
    return match;
  });

  result = result.replace(/\bsrcset\s*=\s*(['"])([^'"]+)\1/gi, (match, quote, value) => {
    return `srcset=${quote}${resolveSrcsetLazy(value, entryFilename, resolver)}${quote}`;
  });

  result = result.replace(/\bstyle\s*=\s*(['"])([\s\S]*?)\1/gi, (match, quote, styleContent) => {
    return `style=${quote}${resolveCssUrlsLazy(styleContent, entryFilename, resolver)}${quote}`;
  });

  return result.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (match, cssContent) => {
    return match.replace(cssContent, resolveCssUrlsLazy(cssContent, entryFilename, resolver));
  });
}

function ensureVirtualBlobUrl(file, resolving = new Set()) {
  if (!file || file.isFolder) return null;

  const cached = blobUrlCache[file.name];
  if (file.isBinary) {
    const ext = getFileExtension(file.name);
    const isFont = ['woff', 'woff2', 'ttf', 'otf', 'eot'].includes(ext);
    if (isFont && file.dataUrl) {
      virtualBlobUrls[file.name] = file.dataUrl;
      return file.dataUrl;
    }
    const currentBlob = getFileBlob(file);
    if (cached && cached.sourceBlob === currentBlob) {
      virtualBlobUrls[file.name] = cached.url;
      return cached.url;
    }
    if (cached) URL.revokeObjectURL(cached.url);
    const newUrl = URL.createObjectURL(currentBlob);
    blobUrlCache[file.name] = { url: newUrl, sourceBlob: currentBlob, rawContent: null, resolvedContent: null };
    virtualBlobUrls[file.name] = newUrl;
    return newUrl;
  }

  const rawContent = getFileText(file);
  const ext = getFileExtension(file.name);

  if (resolving.has(file.name)) {
    if (cached) return cached.url;
    const cycleUrl = URL.createObjectURL(getFileBlob(file));
    blobUrlCache[file.name] = { url: cycleUrl, rawContent, resolvedContent: rawContent, sourceBlob: null };
    virtualBlobUrls[file.name] = cycleUrl;
    return cycleUrl;
  }

  resolving.add(file.name);
  const resolver = (canonicalPath) => {
    const referencedFile = findFileByCanonicalPath(canonicalPath);
    return ensureVirtualBlobUrl(referencedFile, resolving);
  };

  let resolvedContent = rawContent;
  if (ext === 'html' || ext === 'htm') {
    resolvedContent = resolveVirtualPathsLazy(rawContent, file.name, resolver);
  } else if (ext === 'css') {
    resolvedContent = resolveCssUrlsLazy(rawContent, file.name, resolver);
  }
  resolving.delete(file.name);

  if (cached && cached.rawContent === rawContent && cached.resolvedContent === resolvedContent) {
    virtualBlobUrls[file.name] = cached.url;
    return cached.url;
  }

  if (cached) URL.revokeObjectURL(cached.url);
  const newUrl = URL.createObjectURL(getFileBlob(file, resolvedContent));
  blobUrlCache[file.name] = { url: newUrl, rawContent, resolvedContent, sourceBlob: null };
  virtualBlobUrls[file.name] = newUrl;
  return newUrl;
}

// Generate Blob URLs for all virtual files
function generateBlobUrls() {
  // Identify all active file names (non-folders)
  const activeFileNames = new Set(files.filter(f => !f.isFolder).map(f => f.name));

  // Revoke and remove cache entries for files that no longer exist
  for (const name in blobUrlCache) {
    if (!activeFileNames.has(name)) {
      URL.revokeObjectURL(blobUrlCache[name].url);
      delete blobUrlCache[name];
    }
  }

  // Clear map of old keys
  for (const key in virtualBlobUrls) {
    if (!activeFileNames.has(key)) {
      delete virtualBlobUrls[key];
    }
  }

  // First pass: ensure every file has a base Blob URL in virtualBlobUrls.
  files.forEach(file => {
    if (file.isFolder) return;

    const cached = blobUrlCache[file.name];
    if (file.isBinary) {
      const ext = getFileExtension(file.name);
      const isFont = ['woff', 'woff2', 'ttf', 'otf', 'eot'].includes(ext);
      if (isFont && file.dataUrl) {
        virtualBlobUrls[file.name] = file.dataUrl;
      } else {
        const currentBlob = getFileBlob(file);
        if (cached && cached.sourceBlob === currentBlob) {
          virtualBlobUrls[file.name] = cached.url;
        } else {
          if (cached) URL.revokeObjectURL(cached.url);
          const newUrl = URL.createObjectURL(currentBlob);
          blobUrlCache[file.name] = { url: newUrl, sourceBlob: currentBlob, resolvedContent: null, rawContent: null };
          virtualBlobUrls[file.name] = newUrl;
        }
      }
    } else {
      const currentRawContent = getFileText(file);
      if (cached && cached.rawContent === currentRawContent) {
        virtualBlobUrls[file.name] = cached.url;
      } else {
        // We will generate the final URL in the second pass, but we need a baseline URL
        // in virtualBlobUrls for other files to resolve. We use the cached URL if available,
        // or a new temporary one if not cached.
        if (cached) {
          virtualBlobUrls[file.name] = cached.url;
        } else {
          const tempUrl = URL.createObjectURL(getFileBlob(file));
          blobUrlCache[file.name] = { url: tempUrl, rawContent: currentRawContent, resolvedContent: null, sourceBlob: null };
          virtualBlobUrls[file.name] = tempUrl;
        }
      }
    }
  });

  // Second pass: resolve references and recreate URLs for text files if their resolved content changed.
  files.forEach(file => {
    if (file.isFolder || file.isBinary) return;

    const ext = getFileExtension(file.name);
    const rawContent = getFileText(file);

    let resolvedContent;
    if (ext === 'html' || ext === 'htm') {
      resolvedContent = resolveVirtualPaths(rawContent, virtualBlobUrls, file.name);
    } else if (ext === 'css') {
      resolvedContent = resolveCssUrls(rawContent, virtualBlobUrls, file.name);
    } else {
      resolvedContent = rawContent;
    }

    const cached = blobUrlCache[file.name];
    if (cached && cached.resolvedContent === resolvedContent && cached.rawContent === rawContent) {
      virtualBlobUrls[file.name] = cached.url;
    } else {
      if (cached) {
        URL.revokeObjectURL(cached.url);
      }
      const newBlob = getFileBlob(file, resolvedContent);
      const newUrl = URL.createObjectURL(newBlob);
      blobUrlCache[file.name] = {
        url: newUrl,
        rawContent: rawContent,
        resolvedContent: resolvedContent,
        sourceBlob: null
      };
      virtualBlobUrls[file.name] = newUrl;
    }
  });
}

function createVirtualFileUrlSnapshot() {
  const fileMap = {};
  const urlsToRevoke = [];

  files.forEach(file => {
    if (file.isFolder) return;
    const ext = getFileExtension(file.name);
    const isFont = ['woff', 'woff2', 'ttf', 'otf', 'eot'].includes(ext);
    if (isFont && file.dataUrl) {
      fileMap[file.name] = file.dataUrl;
      return;
    }
    const url = URL.createObjectURL(getFileBlob(file));
    fileMap[file.name] = url;
    urlsToRevoke.push(url);
  });

  files.forEach(file => {
    if (file.isFolder || file.isBinary) return;
    const ext = getFileExtension(file.name);
    if (ext !== 'html' && ext !== 'htm' && ext !== 'css') return;

    const rawContent = getFileText(file);
    const resolvedContent = ext === 'css'
      ? resolveCssUrls(rawContent, fileMap, file.name)
      : resolveVirtualPaths(rawContent, fileMap, file.name);

    const rewrittenUrl = URL.createObjectURL(getFileBlob(file, resolvedContent));
    fileMap[file.name] = rewrittenUrl;
    urlsToRevoke.push(rewrittenUrl);
  });

  return { fileMap, urlsToRevoke };
}

function createFullPagePreviewSnapshot() {
  if (editorMode === 'unified') {
    return {
      code: applyNonDraggableImageGuard(getCurrentPreviewCode()),
      urlsToRevoke: []
    };
  }

  const entryFile = getEntryFile();
  if (!entryFile) {
    return {
      code: createEmptyProjectPreviewCode(),
      urlsToRevoke: []
    };
  }

  const previewCode = applyNonDraggableImageGuard(getCurrentPreviewCode());
  const previewUrlMap = { ...virtualBlobUrls };
  const { fileMap, urlsToRevoke } = createVirtualFileUrlSnapshot();
  let code = previewCode;

  Object.entries(previewUrlMap).forEach(([path, previewUrl]) => {
    const snapshotUrl = fileMap[path];
    if (!previewUrl || !snapshotUrl) return;
    code = code.split(previewUrl).join(snapshotUrl);
  });

  return { code, urlsToRevoke };
}

async function createVirtualFileDataUrlSnapshot() {
  const dataUrlMap = {};

  for (const file of files) {
    if (file.isFolder) continue;
    try {
      dataUrlMap[file.name] = await blobToDataUrl(getFileBlob(file));
    } catch {
      // Leave references untouched if a browser refuses to encode a file.
    }
  }

  for (const file of files) {
    if (file.isFolder || file.isBinary) continue;
    const ext = getFileExtension(file.name);
    if (ext !== 'html' && ext !== 'htm' && ext !== 'css') continue;

    const rawContent = getFileText(file);
    const resolvedContent = ext === 'css'
      ? resolveCssUrls(rawContent, dataUrlMap, file.name)
      : resolveVirtualPaths(rawContent, dataUrlMap, file.name);

    try {
      dataUrlMap[file.name] = await blobToDataUrl(getFileBlob(file, resolvedContent));
    } catch {
      // Keep the first-pass Data URL if the rewritten version cannot be encoded.
    }
  }

  return dataUrlMap;
}

function preloadFontDataUrls() {
  let changed = false;
  const promises = files.map(file => {
    if (file.isBinary && file.blob && !file.dataUrl) {
      const ext = getFileExtension(file.name);
      const isFont = ['woff', 'woff2', 'ttf', 'otf', 'eot'].includes(ext);
      if (isFont) {
        return blobToDataUrl(file.blob).then(url => {
          file.dataUrl = url;
          changed = true;
        }).catch(err => {
          console.error('Failed to convert font blob to Data URL:', err);
        });
      }
    }
    return null;
  }).filter(Boolean);

  if (promises.length > 0) {
    Promise.all(promises).then(() => {
      if (changed && typeof schedulePreviewUpdate === 'function') {
        schedulePreviewUpdate();
      }
    });
  }
}

// Initial run
preloadFontDataUrls();
