const PROJECT_MARKER = '/__html_viewer_project__/';
const sessions = new Map();

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

function normalizePath(path) {
  return String(path || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .split('/')
    .filter(Boolean)
    .join('/');
}

function decodePath(path) {
  try {
    return decodeURIComponent(String(path || ''));
  } catch {
    return String(path || '');
  }
}

function joinPath(...parts) {
  return normalizePath(parts.filter(Boolean).join('/'));
}

function getProjectUrl(sessionId, path, baseUrl) {
  const encodedPath = normalizePath(path)
    .split('/')
    .filter(Boolean)
    .map(segment => encodeURIComponent(segment))
    .join('/');
  return new URL(`/${PROJECT_MARKER.slice(1)}${encodeURIComponent(sessionId)}/${encodedPath}`, baseUrl).href;
}

function parseProjectUrl(url) {
  const markerIndex = url.pathname.indexOf(PROJECT_MARKER);
  if (markerIndex === -1) return null;

  const rest = url.pathname.slice(markerIndex + PROJECT_MARKER.length);
  const slashIndex = rest.indexOf('/');
  if (slashIndex === -1) return null;

  return {
    sessionId: decodePath(rest.slice(0, slashIndex)),
    path: normalizePath(decodePath(rest.slice(slashIndex + 1)))
  };
}

function getSession(sessionId) {
  let session = sessions.get(sessionId);
  if (!session) {
    session = {
      files: new Map(),
      pathIndex: new Map(),
      siteRoot: '',
      version: 0,
      updatedAt: Date.now()
    };
    sessions.set(sessionId, session);
  }
  return session;
}

function pruneSessions() {
  const maxAgeMs = 60 * 60 * 1000;
  const now = Date.now();
  for (const [sessionId, session] of sessions) {
    if (now - session.updatedAt > maxAgeMs) {
      sessions.delete(sessionId);
    }
  }
}

function responseForFile(file) {
  if (!file) {
    return new Response('Not found', {
      status: 404,
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
        'Cache-Control': 'no-store'
      }
    });
  }

  const body = file.isBinary ? file.blob : file.content;
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': file.mimeType || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'X-HTML-Viewer-Project': '1'
    }
  });
}

function getStoredPath(session, path) {
  const cleanPath = normalizePath(path);
  if (!cleanPath) return null;
  if (session.files.has(cleanPath)) return cleanPath;
  return session.pathIndex.get(cleanPath.toLowerCase()) || null;
}

function getFileByPath(session, path) {
  const storedPath = getStoredPath(session, path);
  return storedPath ? session.files.get(storedPath) : null;
}

function getRouteCandidates(path) {
  const cleanPath = normalizePath(path);
  const candidates = [];
  const add = candidate => {
    const normalized = normalizePath(candidate);
    if (!candidates.includes(normalized)) candidates.push(normalized);
  };

  if (!cleanPath) {
    add('index.html');
    add('index.htm');
    return candidates;
  }

  add(cleanPath);

  if (cleanPath.endsWith('/')) {
    add(`${cleanPath}index.html`);
    add(`${cleanPath}index.htm`);
    return candidates;
  }

  const lastSegment = cleanPath.split('/').pop() || '';
  const hasExtension = /\.[^/.]+$/.test(lastSegment);
  if (!hasExtension) {
    add(`${cleanPath}.html`);
    add(`${cleanPath}.htm`);
    add(`${cleanPath}/index.html`);
    add(`${cleanPath}/index.htm`);
  }

  return candidates;
}

function candidateScopes(session, path, preferSiteRoot = false) {
  const cleanPath = normalizePath(path);
  const siteRoot = normalizePath(session.siteRoot || '');
  const scopedPath = siteRoot && cleanPath && !cleanPath.toLowerCase().startsWith(`${siteRoot.toLowerCase()}/`)
    ? joinPath(siteRoot, cleanPath)
    : cleanPath;
  const rootIndexPath = siteRoot || cleanPath ? joinPath(siteRoot, cleanPath) : siteRoot;

  const scopes = preferSiteRoot
    ? [scopedPath, cleanPath]
    : [cleanPath, scopedPath];

  if (!cleanPath && siteRoot) scopes.unshift(rootIndexPath);
  return scopes.filter((scope, index, arr) => arr.indexOf(scope) === index);
}

function resolveStaticPath(session, path, { preferSiteRoot = false } = {}) {
  for (const scope of candidateScopes(session, path, preferSiteRoot)) {
    for (const candidate of getRouteCandidates(scope)) {
      const storedPath = getStoredPath(session, candidate);
      if (storedPath) return storedPath;
    }
  }
  return null;
}

function parseRedirectRules(content) {
  return String(content || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .map(line => {
      const [from, to, status] = line.split(/\s+/);
      return { from, to, status: Number.parseInt(status || '200', 10) || 200 };
    })
    .filter(rule => rule.from && rule.to && !/^[a-z][a-z0-9+.-]*:/i.test(rule.to));
}

function redirectRuleMatches(ruleFrom, path) {
  const routePath = `/${normalizePath(path)}`;
  const from = ruleFrom.startsWith('/') ? ruleFrom : `/${ruleFrom}`;
  if (from === routePath) return true;
  if (from === '/*') return true;
  if (from.endsWith('/*')) {
    return routePath.startsWith(from.slice(0, -1));
  }
  if (from.endsWith('*')) {
    return routePath.startsWith(from.slice(0, -1));
  }
  return false;
}

function resolveRedirectTarget(session, path, preferSiteRoot) {
  const redirectFilePath = resolveStaticPath(session, '_redirects', { preferSiteRoot: true });
  const redirectFile = redirectFilePath ? session.files.get(redirectFilePath) : null;
  if (!redirectFile || redirectFile.isBinary) return null;

  for (const rule of parseRedirectRules(redirectFile.content)) {
    if (!redirectRuleMatches(rule.from, path)) continue;
    const targetPath = normalizePath(rule.to);
    const resolvedPath = resolveStaticPath(session, targetPath, { preferSiteRoot });
    if (resolvedPath) return { path: resolvedPath, status: rule.status };
  }
  return null;
}

function resolveProjectRequest(session, path, { preferSiteRoot = false } = {}) {
  const resolvedPath = resolveStaticPath(session, path, { preferSiteRoot });
  if (resolvedPath) {
    return { path: resolvedPath, file: session.files.get(resolvedPath), status: 200 };
  }

  const redirect = resolveRedirectTarget(session, path, preferSiteRoot);
  if (redirect) {
    return { path: redirect.path, file: session.files.get(redirect.path), status: redirect.status };
  }

  const notFoundPath = resolveStaticPath(session, '404.html', { preferSiteRoot: true });
  if (notFoundPath) {
    return { path: notFoundPath, file: session.files.get(notFoundPath), status: 404 };
  }

  return { path: '', file: null, status: 404 };
}

function responseForResolvedRoute(route) {
  if (!route.file) return responseForFile(null);
  const response = responseForFile(route.file);
  if (route.status === 200) return response;
  return new Response(response.body, {
    status: route.status,
    headers: response.headers
  });
}

async function getSessionFromClient(event) {
  const clientId = event.clientId || event.resultingClientId;
  if (!clientId) return null;

  const client = await self.clients.get(clientId);
  if (!client || !client.url) return null;

  const parsed = parseProjectUrl(new URL(client.url));
  return parsed ? parsed.sessionId : null;
}

self.addEventListener('message', event => {
  const data = event.data || {};
  const replyPort = event.ports && event.ports[0];
  const reply = payload => {
    if (replyPort) replyPort.postMessage(payload);
  };

  if (data.type !== 'html-viewer:set-project') return;

  try {
    pruneSessions();
    const session = getSession(data.sessionId);

    if (data.full) {
      session.files.clear();
      session.pathIndex.clear();
    }

    session.siteRoot = normalizePath(data.siteRoot || session.siteRoot || '');

    for (const path of data.removedPaths || []) {
      const cleanPath = normalizePath(path);
      session.files.delete(cleanPath);
      session.pathIndex.delete(cleanPath.toLowerCase());
    }

    for (const entry of data.entries || []) {
      const path = normalizePath(entry.path);
      if (!path) continue;
      session.files.set(path, {
        path,
        mimeType: entry.mimeType || 'application/octet-stream',
        isBinary: Boolean(entry.isBinary),
        content: entry.content || '',
        blob: entry.blob || null
      });
      session.pathIndex.set(path.toLowerCase(), path);
    }

    session.version = data.version || session.version + 1;
    session.updatedAt = Date.now();
    reply({ ok: true, version: session.version, count: session.files.size });
  } catch (err) {
    reply({ ok: false, error: err && err.message ? err.message : String(err) });
  }
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' && event.request.method !== 'HEAD') return;

  const url = new URL(event.request.url);
  const parsed = parseProjectUrl(url);
  if (parsed) {
    event.respondWith((async () => {
      const session = sessions.get(parsed.sessionId);
      if (!session) return responseForFile(null);
      const path = parsed.path || 'index.html';
      return responseForResolvedRoute(resolveProjectRequest(session, path));
    })());
    return;
  }

  event.respondWith((async () => {
    const sessionId = await getSessionFromClient(event);
    if (!sessionId) return fetch(event.request);

    const session = sessions.get(sessionId);
    if (!session) return fetch(event.request);

    const rootRelativePath = normalizePath(decodePath(url.pathname));
    const route = resolveProjectRequest(session, rootRelativePath, { preferSiteRoot: true });
    if (!route.file) return fetch(event.request);

    if (event.request.mode === 'navigate' || event.request.destination === 'document') {
      const siteRoot = normalizePath(session.siteRoot || '');
      const redirectPath = siteRoot && rootRelativePath && !rootRelativePath.toLowerCase().startsWith(`${siteRoot.toLowerCase()}/`)
        ? joinPath(siteRoot, rootRelativePath)
        : (rootRelativePath || siteRoot || route.path);
      return Response.redirect(getProjectUrl(sessionId, redirectPath, url), 302);
    }

    return responseForResolvedRoute(route);
  })());
});
