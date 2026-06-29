function getFileExtension(filename) {
  const basename = filename.split('/').pop() || '';
  const dotIndex = basename.lastIndexOf('.');
  return dotIndex === -1 ? '' : basename.substring(dotIndex + 1).toLowerCase();
}

function createFileId(prefix = 'file') {
  return `${prefix}-${Date.now()}-${fileIdCounter++}`;
}

function decodeUrlPathComponent(value) {
  try {
    return decodeURIComponent(String(value || ''));
  } catch {
    return String(value || '');
  }
}

function normalizeReferencePathValue(path) {
  return decodeUrlPathComponent(String(path || '').trim()).replace(/\\/g, '/');
}

function normalizeProjectPath(path, { folder = false } = {}) {
  let normalized = String(path || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/{2,}/g, '/');

  const cleanParts = [];
  normalized
    .split('/')
    .forEach(part => {
      if (!part || part === '.') return;
      if (part === '..') {
        cleanParts.pop();
        return;
      }
      cleanParts.push(part);
    });

  normalized = cleanParts.join('/');

  if (folder && normalized && !normalized.endsWith('/')) {
    normalized += '/';
  }
  return normalized;
}

function getParentPath(path) {
  const cleanPath = normalizeProjectPath(path, { folder: path.endsWith('/') });
  const parts = cleanPath.split('/').filter(Boolean);
  parts.pop();
  return parts.length ? `${parts.join('/')}/` : '';
}

function getBaseName(path) {
  const parts = normalizeProjectPath(path, { folder: path.endsWith('/') }).split('/').filter(Boolean);
  return parts[parts.length - 1] || '';
}

function joinProjectPath(parentPath, name, { folder = false } = {}) {
  const cleanParent = normalizeProjectPath(parentPath, { folder: true });
  const cleanName = normalizeProjectPath(name).split('/').filter(Boolean).join('/');
  return normalizeProjectPath(`${cleanParent}${cleanName}`, { folder });
}

function getMimeTypeForFilename(filename) {
  const ext = getFileExtension(filename);
  switch (ext) {
    case 'html':
    case 'htm':
      return 'text/html';
    case 'css':
      return 'text/css';
    case 'js':
    case 'jsx':
      return 'text/javascript';
    case 'ts':
    case 'tsx':
      return 'text/typescript';
    case 'json':
    case 'map':
      return 'application/json';
    case 'webmanifest':
      return 'application/manifest+json';
    case 'md':
      return 'text/markdown';
    case 'txt':
      return 'text/plain';
    case 'xml':
      return 'application/xml';
    case 'svg':
      return 'image/svg+xml';
    case 'apng':
      return 'image/apng';
    case 'avif':
      return 'image/avif';
    case 'bmp':
      return 'image/bmp';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'ico':
      return 'image/x-icon';
    case 'woff':
      return 'font/woff';
    case 'woff2':
      return 'font/woff2';
    case 'ttf':
      return 'font/ttf';
    case 'otf':
      return 'font/otf';
    case 'eot':
      return 'application/vnd.ms-fontobject';
    case 'mp3':
      return 'audio/mpeg';
    case 'wav':
      return 'audio/wav';
    case 'ogg':
      return 'audio/ogg';
    case 'm4a':
      return 'audio/mp4';
    case 'mp4':
      return 'video/mp4';
    case 'webm':
      return 'video/webm';
    case 'mov':
      return 'video/quicktime';
    case 'wasm':
      return 'application/wasm';
    default:
      return 'application/octet-stream';
  }
}

function isTextFilename(filename) {
  return TEXT_EXTENSIONS.has(getFileExtension(filename));
}

function isEditableFile(file) {
  return file && !file.isFolder && !file.isBinary;
}

function createTextFileRecord(name, content = '', options = {}) {
  const cleanName = normalizeProjectPath(name);
  return {
    id: options.id || createFileId('file'),
    name: cleanName,
    content,
    type: getFileExtension(cleanName) || 'plaintext',
    mimeType: options.mimeType || getMimeTypeForFilename(cleanName),
    isBinary: false,
    size: typeof options.size === 'number' ? options.size : new Blob([content]).size,
    order: typeof options.order === 'number' ? options.order : nextFileOrder++
  };
}

function createBinaryFileRecord(name, blob, options = {}) {
  const cleanName = normalizeProjectPath(name);
  return {
    id: options.id || createFileId('asset'),
    name: cleanName,
    content: '',
    blob,
    type: getFileExtension(cleanName) || 'asset',
    mimeType: options.mimeType || blob?.type || getMimeTypeForFilename(cleanName),
    isBinary: true,
    size: typeof options.size === 'number' ? options.size : (blob?.size || 0),
    order: typeof options.order === 'number' ? options.order : nextFileOrder++
  };
}

function createFolderRecord(name, options = {}) {
  const cleanName = normalizeProjectPath(name, { folder: true });
  return {
    id: options.id || createFileId('folder'),
    name: cleanName,
    isFolder: true,
    type: 'folder',
    content: '',
    mimeType: 'inode/directory',
    isBinary: false,
    size: 0,
    order: typeof options.order === 'number' ? options.order : nextFileOrder++
  };
}

function getFileText(file) {
  if (!file || file.isFolder) return '';
  if (!isRestoringHistory && editorMode === 'unified' && file.id === getEntryFile()?.id) {
    if (monacoLoaded && typeof unifiedModel !== 'undefined' && unifiedModel) {
      return unifiedModel.getValue();
    }
    if (fallbackTextarea) {
      return fallbackTextarea.value;
    }
  }
  if (monacoLoaded && fileModels[file.id]) {
    return fileModels[file.id].getValue();
  }
  return file.content || '';
}

function getFileBlob(file, contentOverride = null) {
  if (!file || file.isFolder) return new Blob([]);
  if (file.isBinary && file.blob) {
    return file.blob;
  }
  const content = contentOverride !== null ? contentOverride : getFileText(file);
  return new Blob([content], { type: `${file.mimeType || getMimeTypeForFilename(file.name)};charset=utf-8` });
}

// Virtual file system state
const defaultFolder = currentLocale === 'es' ? 'proyecto' : 'project';
const defaultCssComment = currentLocale === 'es' ? '/* Hoja de estilo del proyecto */' : '/* Project stylesheet */';
const defaultJsComment = currentLocale === 'es' ? '// Código JavaScript del proyecto\nconsole.log("¡Proyecto cargado!");' : '// Project JavaScript code\nconsole.log("Project loaded!");';

let files = [
  createTextFileRecord(`${defaultFolder}/index.html`, DEFAULT_SAMPLE_CODE, { id: '1' }),
  createTextFileRecord(`${defaultFolder}/styles.css`, `${defaultCssComment}\nbody {\n  font-family: 'Inter', sans-serif;\n  padding: 24px;\n}`, { id: '2' }),
  createTextFileRecord(`${defaultFolder}/script.js`, defaultJsComment, { id: '3' })
];
