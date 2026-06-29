// Helper to split unified HTML into HTML, CSS, JS components
function splitUnifiedCode(unifiedHtml) {
  let css = '';
  let js = '';
  let html = unifiedHtml;

  // Extract <style> blocks
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let styleMatch;
  while ((styleMatch = styleRegex.exec(unifiedHtml)) !== null) {
    css += styleMatch[1].trim() + '\n\n';
  }
  html = html.replace(styleRegex, '');

  // Extract inline <script> blocks (only those without 'src' attribute)
  const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let scriptMatch;
  while ((scriptMatch = scriptRegex.exec(unifiedHtml)) !== null) {
    const openTag = scriptMatch[0];
    if (!/src\s*=/i.test(openTag)) {
      js += scriptMatch[1].trim() + '\n\n';
      html = html.replace(scriptMatch[0], '');
    }
  }

  // Inject link and script tags to reference the separate files
  if (css.trim()) {
    const linkTag = '\n<link rel="stylesheet" href="styles.css">';
    // Only inject if not already present
    if (!/href\s*=\s*(['"])(?:\.\/|\/)?styles\.css\1/i.test(html)) {
      if (/<head[^>]*>/i.test(html)) {
        html = html.replace(/(<\/head>)/i, `${linkTag}\n$1`);
      } else if (/<html[^>]*>/i.test(html)) {
        html = html.replace(/(<html[^>]*>)/i, `$1\n<head>${linkTag}\n</head>`);
      } else {
        html = linkTag + '\n' + html;
      }
    }
  }

  if (js.trim()) {
    const scriptTag = '\n<script src="script.js"></script>';
    // Only inject if not already present
    if (!/src\s*=\s*(['"])(?:\.\/|\/)?script\.js\1/i.test(html)) {
      if (/(<\/body>)/i.test(html)) {
        html = html.replace(/(<\/body>)/i, `${scriptTag}\n$1`);
      } else if (/(<\/html>)/i.test(html)) {
        html = html.replace(/(<\/html>)/i, `${scriptTag}\n$1`);
      } else {
        html = html + '\n' + scriptTag;
      }
    }
  }

  return {
    html: html.trim(),
    css: css.trim(),
    js: js.trim()
  };
}

function replaceProjectWithSplitSource(unifiedHtml, { emptyAsSingleFile = false } = {}) {
  const rootFolder = getProjectRootFolder();
  if (emptyAsSingleFile && !String(unifiedHtml || '').trim()) {
    files = [
      createTextFileRecord(rootFolder + 'index.html', '', { id: '1' })
    ];
    openFileIds = ['1'];
  } else {
    const { html, css, js } = splitUnifiedCode(unifiedHtml);
    files = [
      createTextFileRecord(rootFolder + 'index.html', html, { id: '1' }),
      createTextFileRecord(rootFolder + 'styles.css', css, { id: '2' }),
      createTextFileRecord(rootFolder + 'script.js', js, { id: '3' })
    ];
    openFileIds = ['1', '2', '3'];
  }

  activeFileId = '1';
  selectedEntryFileId = '1';
  normalizeProjectFiles();
}

// Helper to resolve relative paths to canonical virtual file system paths
function resolveRelativePath(basePath, relativePath) {
  const normalizedRelativePath = normalizeReferencePathValue(relativePath);
  // If it's an absolute URL or data URL, return it as-is
  if (/^(https?:|data:|blob:|mailto:|tel:|#)/i.test(normalizedRelativePath)) {
    return null;
  }

  // Strip leading "./" if present
  let cleanRel = normalizedRelativePath;
  if (cleanRel.startsWith('./')) {
    cleanRel = cleanRel.substring(2);
  }

  // If it starts with "/", it is root-relative
  if (cleanRel.startsWith('/')) {
    return cleanRel.substring(1);
  }

  const baseParts = basePath.split('/').filter(Boolean);
  const relParts = cleanRel.split('/');

  for (const part of relParts) {
    if (part === '.' || part === '') {
      continue;
    } else if (part === '..') {
      baseParts.pop();
    } else {
      baseParts.push(part);
    }
  }

  return baseParts.join('/');
}

function getReferencePathCandidates(hostFilename, refPath) {
  const { path } = splitPathSuffix(refPath);
  const canonicalPath = resolveRelativePath(getDirectoryPath(hostFilename), path);
  if (!canonicalPath) return [];

  const candidates = [canonicalPath];
  if (path.startsWith('/')) {
    const siteRoot = getProjectPreviewSiteRootPath();
    if (siteRoot) {
      candidates.push(normalizeProjectPath(`${siteRoot}/${canonicalPath}`));
    }
  }

  return candidates.filter((candidate, index, arr) => candidate && arr.indexOf(candidate) === index);
}

function splitPathSuffix(refPath) {
  const suffixMatch = String(refPath).match(/([?#].*)$/);
  return {
    path: suffixMatch ? refPath.slice(0, suffixMatch.index) : refPath,
    suffix: suffixMatch ? suffixMatch[0] : ''
  };
}

function getDirectoryPath(filename) {
  const cleanName = normalizeProjectPath(filename);
  const lastSlashIndex = cleanName.lastIndexOf('/');
  return lastSlashIndex === -1 ? '' : cleanName.substring(0, lastSlashIndex);
}

function getCommonProjectRootPath() {
  const filePaths = files
    .filter(file => !file.isFolder)
    .map(file => normalizeProjectPath(file.name))
    .filter(Boolean);
  if (filePaths.length === 0) return '';
  if (filePaths.some(path => !path.includes('/'))) return '';

  const firstSegment = filePaths[0].split('/')[0];
  return filePaths.every(path => path.startsWith(`${firstSegment}/`)) ? firstSegment : '';
}

function getProjectPreviewSiteRootPath() {
  const entryFile = getEntryFile();
  if (!entryFile) return getCommonProjectRootPath();

  const entryPath = normalizeProjectPath(entryFile.name);
  const entryDir = getDirectoryPath(entryPath);
  const entryBase = getBaseName(entryPath).toLowerCase();
  if ((entryBase === 'index.html' || entryBase === 'index.htm') && entryDir) {
    return entryDir;
  }

  const commonRoot = getCommonProjectRootPath();
  if (commonRoot && entryPath.startsWith(`${commonRoot}/`)) {
    return commonRoot;
  }

  return '';
}

function getStaticRouteCandidates(path) {
  const cleanPath = normalizeProjectPath(path);
  const candidates = [];
  const add = candidate => {
    const normalized = normalizeProjectPath(candidate);
    if (normalized && !candidates.includes(normalized)) candidates.push(normalized);
  };

  if (!cleanPath) {
    add('index.html');
    add('index.htm');
    return candidates;
  }

  add(cleanPath);
  const lastSegment = cleanPath.split('/').pop() || '';
  const hasExtension = /\.[^/.]+$/.test(lastSegment);
  if (!hasExtension) {
    add(`${cleanPath}.html`);
    add(`${cleanPath}.htm`);
    add(`${cleanPath}/index.html`);
    add(`${cleanPath}/index.htm`);
  }
  if (cleanPath.endsWith('/')) {
    add(`${cleanPath}index.html`);
    add(`${cleanPath}index.htm`);
  }
  return candidates;
}

function findProjectFileByStaticRoute(path, { preferSiteRoot = false } = {}) {
  const cleanPath = normalizeProjectPath(path);
  const siteRoot = getProjectPreviewSiteRootPath();
  const scopedPath = siteRoot && cleanPath && !cleanPath.toLowerCase().startsWith(`${siteRoot.toLowerCase()}/`)
    ? normalizeProjectPath(`${siteRoot}/${cleanPath}`)
    : cleanPath;
  const scopes = preferSiteRoot ? [scopedPath, cleanPath] : [cleanPath, scopedPath];

  for (const scope of scopes.filter((scope, index, arr) => arr.indexOf(scope) === index)) {
    for (const candidate of getStaticRouteCandidates(scope)) {
      const file = files.find(item => !item.isFolder && normalizeProjectPath(item.name).toLowerCase() === candidate.toLowerCase());
      if (file) return file;
    }
  }
  return null;
}

function makeRelativePath(fromFilename, toPath) {
  const fromDirParts = getDirectoryPath(fromFilename).split('/').filter(Boolean);
  const toParts = normalizeProjectPath(toPath).split('/').filter(Boolean);

  while (fromDirParts.length && toParts.length && fromDirParts[0] === toParts[0]) {
    fromDirParts.shift();
    toParts.shift();
  }

  const relativeParts = [
    ...fromDirParts.map(() => '..'),
    ...toParts
  ];
  return relativeParts.length ? relativeParts.join('/') : getBaseName(toPath);
}

function resolveReferenceValue(refPath, fileMap, entryFilename) {
  const { suffix } = splitPathSuffix(refPath);
  for (const candidatePath of getReferencePathCandidates(entryFilename, refPath)) {
    if (fileMap[candidatePath]) {
      return `${fileMap[candidatePath]}${suffix}`;
    }
  }
  return null;
}

function resolveSrcset(value, fileMap, entryFilename) {
  return value.split(',').map(part => {
    const trimmed = part.trim();
    if (!trimmed) return part;
    const pieces = trimmed.split(/\s+/);
    const resolved = resolveReferenceValue(pieces[0], fileMap, entryFilename);
    if (!resolved) return part;
    pieces[0] = resolved;
    return pieces.join(' ');
  }).join(', ');
}

function rewriteCssImportReference(match, quote, refPath, resolved) {
  const safeQuote = quote || '"';
  return match.replace(refPath, resolved).replace(/@import\s+url\(\s*([^'")\s][^)]*)\)/i, `@import url(${safeQuote}$1${safeQuote})`);
}

function resolveCssUrls(content, fileMap, entryFilename) {
  let result = content.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (match, quote, refPath) => {
    const resolved = resolveReferenceValue(refPath.trim(), fileMap, entryFilename);
    if (!resolved) return match;
    const safeQuote = quote || '"';
    return `url(${safeQuote}${resolved}${safeQuote})`;
  });

  result = result.replace(/@import\s+(?:url\(\s*)?(['"]?)([^'")\s]+)\1\s*\)?/gi, (match, quote, refPath) => {
    const resolved = resolveReferenceValue(refPath.trim(), fileMap, entryFilename);
    if (!resolved) return match;
    return rewriteCssImportReference(match, quote, refPath, resolved);
  });

  return result;
}

function findFileByReference(hostFilename, refPath, allowedExtensions = null) {
  for (const candidatePath of getReferencePathCandidates(hostFilename, refPath)) {
    const file = files.find(item => !item.isFolder && item.name.toLowerCase() === candidatePath.toLowerCase());
    if (!file) continue;
    if (allowedExtensions && !allowedExtensions.has(getFileExtension(file.name))) continue;
    return file;
  }
  return null;
}

function injectPreviewGuardIntoHtml(htmlContent, guardStyle, guardScript) {
  let result = String(htmlContent || '');
  if (/<head\b[^>]*>/i.test(result)) {
    return result.replace(/<head\b[^>]*>/i, match => `${match}\n${guardStyle}\n${guardScript}`);
  }
  if (/<html\b[^>]*>/i.test(result)) {
    return result.replace(/<html\b[^>]*>/i, match => `${match}\n<head>\n${guardStyle}\n${guardScript}\n</head>`);
  }
  return `${guardStyle}\n${guardScript}\n${result}`;
}

function applyNonDraggableImageGuard(htmlContent, { preventPreviewFocus = false } = {}) {
  const guardAttribute = preventPreviewFocus ? 'data-html-viewer-preview-guard' : 'data-html-viewer-image-guard';
  const focusGuardStyle = preventPreviewFocus
    ? `html[data-html-viewer-embedded-preview] *,html[data-html-viewer-embedded-preview] *::before,html[data-html-viewer-embedded-preview] *::after{-webkit-user-select:none!important;user-select:none!important;}html[data-html-viewer-embedded-preview] input,html[data-html-viewer-embedded-preview] textarea,html[data-html-viewer-embedded-preview] [contenteditable],html[data-html-viewer-embedded-preview] [role="textbox"]{caret-color:transparent!important;}`
    : '';
  const fontSmoothingStyle = `html,body{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:optimizeLegibility;background-color:#ffffff;}`;
  const guardStyle = `<style ${guardAttribute}>img{-webkit-user-drag:none;user-drag:none;user-select:none;}${fontSmoothingStyle}${focusGuardStyle}</style>`;
  const focusGuardScript = preventPreviewFocus ? `
  document.documentElement.setAttribute('data-html-viewer-embedded-preview', '');
  const isEditableTarget = target => {
    if (!target || !target.closest) return false;
    return Boolean(target.closest('input,textarea,select,[contenteditable],[role="textbox"],.monaco-editor'));
  };
  const releaseEditableFocus = target => {
    const editable = target && target.closest ? target.closest('input,textarea,select,[contenteditable],[role="textbox"],.monaco-editor') : null;
    const active = document.activeElement;
    if (active && active !== document.body && active !== document.documentElement && isEditableTarget(active)) {
      active.blur();
    } else if (editable && editable.blur) {
      editable.blur();
    }
  };
  document.querySelectorAll('[autofocus]').forEach(element => element.removeAttribute('autofocus'));
  const originalFocus = HTMLElement.prototype.focus;
  HTMLElement.prototype.focus = function(...args) {
    if (isEditableTarget(this)) return;
    return originalFocus.apply(this, args);
  };
  document.addEventListener('pointerdown', event => {
    if (isEditableTarget(event.target)) {
      event.preventDefault();
      releaseEditableFocus(event.target);
    }
  }, true);
  document.addEventListener('focusin', event => {
    if (isEditableTarget(event.target)) {
      releaseEditableFocus(event.target);
    }
  }, true);
  document.addEventListener('keydown', event => {
    if (isEditableTarget(document.activeElement)) {
      event.preventDefault();
      event.stopPropagation();
      releaseEditableFocus(document.activeElement);
    }
  }, true);` : '';
  const guardScript = `<script ${guardAttribute}>
(() => {
  const disableImageDrag = () => {
    document.querySelectorAll('img').forEach(image => {
      image.setAttribute('draggable', 'false');
    });
  };
${focusGuardScript}
  document.addEventListener('dragstart', event => {
    if (event.target && event.target.closest && event.target.closest('img')) {
      event.preventDefault();
    }
  }, true);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', disableImageDrag, { once: true });
  } else {
    disableImageDrag();
  }
})();
</script>`;

  let result = String(htmlContent || '');
  if (!result.includes(guardAttribute)) {
    result = injectPreviewGuardIntoHtml(result, guardStyle, guardScript);
  }
  return result;
}

function inlineCssImports(cssContent, hostFilename, dataUrlMap, seenFiles = new Set()) {
  return cssContent.replace(/@import\s+(?:url\(\s*)?(['"])([^'"]+)\1\s*\)?\s*([^;]*);?/gi, (match, quote, refPath, mediaQuery) => {
    const importedFile = findFileByReference(hostFilename, refPath, new Set(['css']));
    if (!importedFile || seenFiles.has(importedFile.name)) return match;

    const nextSeen = new Set(seenFiles);
    nextSeen.add(importedFile.name);
    let importedContent = getFileText(importedFile);
    importedContent = inlineCssImports(importedContent, importedFile.name, dataUrlMap, nextSeen);
    importedContent = resolveCssUrls(importedContent, dataUrlMap, importedFile.name);

    const media = String(mediaQuery || '').trim();
    if (media) {
      return `@media ${media} {\n${importedContent}\n}`;
    }
    return importedContent;
  });
}

// Helper to resolve relative paths in HTML content to Blob URLs
function resolveVirtualPaths(content, fileMap, entryFilename) {
  if (!entryFilename) entryFilename = 'index.html';

  let result = content.replace(/\b(href|src|action|poster)\s*=\s*(['"])([^'"]+)\2/gi, (match, attr, quote, refPath) => {
    const resolved = resolveReferenceValue(refPath, fileMap, entryFilename);
    if (resolved) {
      return `${attr}=${quote}${resolved}${quote}`;
    }
    return match;
  });

  result = result.replace(/\bsrcset\s*=\s*(['"])([^'"]+)\1/gi, (match, quote, value) => {
    return `srcset=${quote}${resolveSrcset(value, fileMap, entryFilename)}${quote}`;
  });

  // Resolve virtual URLs inside inline style="..." attributes
  result = result.replace(/\bstyle\s*=\s*(['"])([\s\S]*?)\1/gi, (match, quote, styleContent) => {
    return `style=${quote}${resolveCssUrls(styleContent, fileMap, entryFilename)}${quote}`;
  });

  return result.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (match, cssContent) => {
    return match.replace(cssContent, resolveCssUrls(cssContent, fileMap, entryFilename));
  });
}
