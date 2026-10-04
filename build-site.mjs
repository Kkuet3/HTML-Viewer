// Generate only the editor in English/Spanish and a small error page.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import vm from 'node:vm';

const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const app = await readFile('src/app/00-config-state.js', 'utf8');
const dictionaries = vm.runInNewContext(`${app.slice(app.indexOf('const TRANSLATIONS ='), app.indexOf('\nfunction t('))}\nTRANSLATIONS;`, {}, { timeout: 1000 });

function localize(html, lang) {
  const dict = dictionaries[lang];
  html = html.replace(/(<([\w-]+)\b[^>]*\bdata-i18n="([^"]+)"[^>]*>)[^<]*(<\/\2>)/g, (all, open, tag, key, close) => {
    if (!dict[key]) throw Error(`Missing translation: ${lang}/${key}`);
    return `${open}${escape(dict[key])}${close}`;
  });
  for (const attr of ['title', 'placeholder', 'aria-label']) html = html.replace(/<[a-z][^>]*>/gi, tag => {
    const key = tag.match(new RegExp(`data-i18n-${attr}="([^"]+)"`))?.[1];
    if (!key) return tag;
    if (!dict[key]) throw Error(`Missing translation: ${lang}/${key}`);
    const value = escape(dict[key]);
    const regex = new RegExp(`(?<![\\w-])${attr}="[^"]*"`);
    return regex.test(tag) ? tag.replace(regex, `${attr}="${value}"`) : tag.replace(/>$/, ` ${attr}="${value}">`);
  });
  return html;
}

function helpContent(es) {
  const sections = es ? [
    ['Editar y previsualizar', 'Usa Simple para un documento HTML. Usa Archivos para un proyecto con HTML, CSS, JavaScript y recursos en carpetas. La vista previa se actualiza al editar.'],
    ['Importar y guardar', 'Importa un HTML o un ZIP con los botones o arrastrándolo al editor. Exporta como HTML, ZIP o carpeta local cuando tu navegador lo permita.'],
    ['Almacenamiento local', 'Los archivos se procesan en tu navegador. El tema, la distribución y la recuperación del editor usan almacenamiento local. Exporta una copia para conservar tu trabajo; borrar los datos del navegador elimina la recuperación.'],
    ['Vista previa de proyectos', 'El modo Archivos requiere HTTPS o localhost. Ejecuta código preparado para el navegador; los proyectos que necesitan un servidor o una compilación deben prepararse antes de importarlos. Los scripts y recursos de la vista previa pueden acceder a Internet.']
  ] : [
    ['Edit and preview', 'Use Simple for one HTML document. Use Files for a project with HTML, CSS, JavaScript and assets in folders. The preview updates as you edit.'],
    ['Import and save', 'Import HTML or ZIP with the buttons or by dragging it into the editor. Export HTML, ZIP or a local folder when your browser supports it.'],
    ['Local storage', 'Files are processed in your browser. Theme, layout and editor recovery use local browser storage. Export a copy to keep your work; clearing browser data removes recovery.'],
    ['Project preview', 'Files mode requires HTTPS or localhost. Use browser-ready code; projects that need a server or a build must be prepared before import. Scripts and resources in the preview can access the Internet.']
  ];
  const shortcuts = es ? ['Deshacer', 'Rehacer', 'Exportar', 'Zoom del editor', 'Restablecer zoom'] : ['Undo', 'Redo', 'Export', 'Editor zoom', 'Reset zoom'];
  return sections.map(([title, body]) => `<section class="about-section"><h3>${title}</h3><p>${body}</p></section>`).join('\n') +
    `<section class="about-section"><h3>${es ? 'Atajos de teclado' : 'Keyboard shortcuts'}</h3><div class="about-shortcuts-list">${['Ctrl + Z', 'Ctrl + Y', 'Ctrl + S', 'Ctrl + +/−', 'Ctrl + 0'].map((keys, i) => `<div class="about-shortcut-row"><kbd>${keys}</kbd><span>${shortcuts[i]}</span></div>`).join('')}</div></section>`;
}

const template = await readFile('src/site/editor-shell.html', 'utf8');
for (const lang of ['en', 'es']) {
  const es = lang === 'es';
  const prefix = es ? '../' : './';
  const description = es ? 'Editor de HTML, CSS y JavaScript con vista previa e importación de proyectos.' : 'HTML, CSS and JavaScript editor with live preview and project import.';
  const replacements = {
    lang,
    head: `<meta name="viewport" content="width=device-width, initial-scale=1"><title>HTML Viewer</title><meta name="description" content="${description}"><meta name="theme-color" content="#8842FD"><link rel="icon" href="${prefix}favicon.ico"><link rel="apple-touch-icon" href="${prefix}apple-touch-icon.png">`,
    help: es ? 'Ayuda' : 'Help',
    skip: es ? 'Saltar al editor' : 'Skip to editor',
    editorNav: es ? 'Controles del editor' : 'Editor controls',
    languageLink: `<a class="language-link" href="${es ? '../' : './es/'}" lang="${es ? 'en' : 'es'}">${es ? 'English' : 'Español'}</a>`,
    helpContent: helpContent(es),
    nojs: es ? 'Activa JavaScript para utilizar el editor.' : 'Enable JavaScript to use the editor.'
  };
  let html = localize(template.replace(/\{\{(\w+)\}\}/g, (match, key) => replacements[key] ?? match), lang);
  html = html.replace(/((?:src|href)=")\/(?=assets\/|styles\.min\.css|(?:app\.bundle|lucide\.min)\.js)/g, `$1${prefix}`);
  html = html.replaceAll("url('/assets/", `url('${prefix}assets/`);
  if (/\{\{\w+\}\}/.test(html)) throw Error('Unresolved editor template token');
  const file = es ? 'es/index.html' : 'index.html';
  if (es) await mkdir('es', { recursive: true });
  await writeFile(file, `<!-- Generated by build-site.mjs; edit src/site/editor-shell.html. -->\n${html}`);
}

// Missing URLs can be nested. GitHub Actions supplies Pages' base_path.
const rawBase = process.env.BASE_PATH || '/';
if (!/^\/(?:[A-Za-z0-9._~-]+\/?)*$/.test(rawBase) || rawBase.split('/').includes('..')) throw Error('Invalid BASE_PATH');
const base = rawBase === '/' ? '/' : `${rawBase.replace(/\/$/, '')}/`;
await writeFile('404.html', `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Page not found · HTML Viewer</title><style>body{font-family:system-ui;max-width:40rem;margin:15vh auto;padding:2rem;background:#0b0d13;color:#fff}a{color:#c394ff}</style></head><body><h1>Page not found / Página no encontrada</h1><p><a href="${base}">Open HTML Viewer / Abrir HTML Viewer</a></p></body></html>\n`);
console.log('Generated English/Spanish editor and 404 page.');
