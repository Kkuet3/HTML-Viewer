// Minifies the app stylesheets into .min.css siblings that production serves.
// Conservative on purpose: it strips comments and collapses whitespace, but
// NEVER touches anything inside strings or parentheses, so calc(), env(),
// max(), clamp(), media queries and content:"" values stay byte-correct.
//
// Run via:  node build-css.mjs   (or the unified `node build.mjs`)

import { readFile, writeFile } from 'node:fs/promises';

const TARGETS = [
  { src: 'styles.css', out: 'styles.min.css' },
  { src: 'layout.css', out: 'layout.min.css' },
];

// Safe CSS minifier. State machine over the source so we only collapse
// whitespace in "neutral" regions — outside strings, comments and parens.
function minifyCss(css) {
  let out = '';
  let i = 0;
  const n = css.length;
  let parenDepth = 0;

  const isWs = (c) => c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f';

  while (i < n) {
    const c = css[i];

    // Comments: drop entirely.
    if (c === '/' && css[i + 1] === '*') {
      i += 2;
      while (i < n && !(css[i] === '*' && css[i + 1] === '/')) i++;
      i += 2;
      continue;
    }

    // Strings: copy verbatim (including their internal whitespace).
    if (c === '"' || c === "'") {
      const quote = c;
      out += c;
      i++;
      while (i < n) {
        out += css[i];
        if (css[i] === '\\') { out += css[i + 1] ?? ''; i += 2; continue; }
        if (css[i] === quote) { i++; break; }
        i++;
      }
      continue;
    }

    if (c === '(') { parenDepth++; out += c; i++; continue; }
    if (c === ')') { parenDepth = Math.max(0, parenDepth - 1); out += c; i++; continue; }

    // Inside parens (calc/env/url/media features): keep spaces, just collapse runs.
    if (parenDepth > 0) {
      if (isWs(c)) {
        while (i < n && isWs(css[i])) i++;
        // Preserve a single space only when it separates tokens.
        const prev = out[out.length - 1];
        const next = css[i];
        if (prev && next && prev !== '(' && next !== ')') out += ' ';
        continue;
      }
      out += c;
      i++;
      continue;
    }

    // Neutral region: collapse whitespace and drop it around structural chars.
    if (isWs(c)) {
      while (i < n && isWs(css[i])) i++;
      const prev = out[out.length - 1];
      const next = css[i];
      // No space needed adjacent to block/statement punctuation.
      if (!prev || '{};,>'.includes(prev) || (next && '{};,>'.includes(next))) continue;
      if (next === undefined) continue;
      out += ' ';
      continue;
    }

    out += c;
    i++;
  }

  return out.trim();
}

let total = 0;
for (const { src, out } of TARGETS) {
  let css = await readFile(src, 'utf8');
  const min = minifyCss(css);
  // Sanity: balanced braces — a mangled minify would skew this.
  const open = (min.match(/{/g) || []).length;
  const close = (min.match(/}/g) || []).length;
  if (open !== close) {
    throw new Error(`Brace mismatch after minifying ${src} (${open} vs ${close}). Aborting.`);
  }
  await writeFile(out, min, 'utf8');
  const before = Buffer.byteLength(css, 'utf8');
  const after = Buffer.byteLength(min, 'utf8');
  total += before - after;
  console.log(
    `Minified ${src} -> ${out}: ${(after / 1024).toFixed(1)} KB ` +
    `(was ${(before / 1024).toFixed(1)} KB, -${(100 - (after / before) * 100).toFixed(1)}%).`
  );
}
console.log(`CSS total saved: ${(total / 1024).toFixed(1)} KB.`);

// The application shell intentionally inlines layout.css to avoid a second
// render-blocking request. Keep that copy generated from the same source.
const layoutCss = minifyCss(await readFile('layout.css', 'utf8'));
for (const indexPath of ['index.html', 'es/index.html']) {
const indexHtml = await readFile(indexPath, 'utf8');
const marker = '/* Minified layout.css inlined */';
const markerIndex = indexHtml.indexOf(marker);
const styleEnd = markerIndex === -1 ? -1 : indexHtml.indexOf('</style>', markerIndex);
if (markerIndex !== -1 && styleEnd !== -1) {
  const replacement = `${marker}\n    ${layoutCss}\n  `;
  const nextIndexHtml = `${indexHtml.slice(0, markerIndex)}${replacement}${indexHtml.slice(styleEnd)}`;
  if (nextIndexHtml !== indexHtml) await writeFile(indexPath, nextIndexHtml, 'utf8');
}
}
