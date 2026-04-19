#!/usr/bin/env node
/**
 * Copies EPUB + PDF.js bundles from node_modules into native app bundles
 * so WebView readers work offline (no CDN). Run after npm install (postinstall).
 *
 * For the PDF reader, pdf.min.js and pdf.worker.min.js are embedded INLINE
 * into pdf-reader.html so the WebView never needs to separately load them
 * from file:// (which is blocked for fetch and unreliable for <script src>
 * when the asset is compressed in the APK).
 *
 * Both scripts are transpiled via esbuild to target chrome60 so they work on
 * older Android WebViews that lack optional chaining / nullish coalescing.
 *
 * The script is idempotent: it detects whether the html has already been
 * processed (inline content present) and replaces/updates it cleanly.
 */
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const root = path.resolve(__dirname, '..');
const assetsDir = path.join(root, 'android', 'app', 'src', 'main', 'assets');
const iosReaderDir = path.join(root, 'ios', 'BeaverReader');
const jszipSrc = path.join(root, 'node_modules', 'jszip', 'dist', 'jszip.min.js');
const epubSrc = path.join(root, 'node_modules', 'epubjs', 'dist', 'epub.min.js');
const pdfSrc = path.join(root, 'node_modules', 'pdfjs-dist', 'build', 'pdf.min.js');
const pdfWorkerSrc = path.join(root, 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.js');
const pdfHtmlTemplate = path.join(assetsDir, 'pdf-reader.html');

if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}
if (!fs.existsSync(iosReaderDir)) {
  fs.mkdirSync(iosReaderDir, { recursive: true });
}

const copy = (src, dest) => {
  const base = path.basename(dest);
  if (!fs.existsSync(src)) {
    console.warn('copy-reader-assets: ' + base + ' not found at ' + src + ' (run npm install)');
    return;
  }
  fs.copyFileSync(src, dest);
  console.log('copy-reader-assets: copied ' + base);
};

/**
 * Transpile JS source to chrome60-compatible syntax using esbuild.
 * Removes optional chaining (?.), nullish coalescing (??), etc. that
 * older Android WebViews don't support.
 */
function transpileForOldWebView(code, label) {
  const result = esbuild.transformSync(code, {
    target: 'chrome60',
    loader: 'js',
    minify: false,
  });
  if (result.warnings && result.warnings.length > 0) {
    result.warnings.forEach(w => console.warn('copy-reader-assets: esbuild warning (' + label + '):', w.text));
  }
  console.log('copy-reader-assets: transpiled ' + label + ' for chrome60 (' + code.length + ' → ' + result.code.length + ' bytes)');
  return result.code;
}

copy(jszipSrc, path.join(assetsDir, 'jszip.min.js'));
copy(epubSrc, path.join(assetsDir, 'epub.min.js'));
copy(pdfSrc, path.join(assetsDir, 'pdf.min.js'));
copy(pdfWorkerSrc, path.join(assetsDir, 'pdf.worker.min.js'));
copy(pdfSrc, path.join(iosReaderDir, 'pdf.min.js'));
copy(pdfWorkerSrc, path.join(iosReaderDir, 'pdf.worker.min.js'));

// ── Generate pdf-reader.html with pdf.min.js + pdf.worker.min.js embedded inline ──
// This avoids ALL runtime file loading — no CDN, no <script src>, no fetch(), no XHR.
// The resulting html (~1.4 MB) stores the scripts inline so Android WebView can load
// them regardless of network access or APK compression.
if (!fs.existsSync(pdfHtmlTemplate)) {
  console.warn('copy-reader-assets: pdf-reader.html template not found, skipping inline embed');
} else if (!fs.existsSync(pdfSrc)) {
  console.warn('copy-reader-assets: pdf.min.js not found, skipping inline embed');
} else {
  try {
    let html = fs.readFileSync(pdfHtmlTemplate, 'utf8');
    const pdfJsRaw = fs.readFileSync(pdfSrc, 'utf8');

    // Transpile to remove optional chaining / nullish coalescing for older WebViews
    const pdfJs = transpileForOldWebView(pdfJsRaw, 'pdf.min.js');

    // Escape </script so the HTML parser doesn't prematurely end the script tag.
    // Use indexOf+slice (NOT String.replace) to avoid $ pattern corruption since
    // pdf.min.js contains $ patterns ($&, $', ${) that .replace() interprets as
    // special replacement tokens, silently corrupting the output.
    const safePdfJs = safeReplace(pdfJs, /<\/script/gi, '<\\/script');

    // ── Step 1: Replace the pdfjsLib script tag with the inline version ──
    // Accept either a bare local path placeholder OR the full CDN URL so this
    // script works whether the template has already been updated or not.
    const LOCAL_PLACEHOLDER = '<script src="pdf.min.js"></script>';
    const CDN_PLACEHOLDER = /\x3cscript\s+src="https:\/\/cdnjs\.cloudflare\.com\/[^"]*pdf\.min\.js"[^>]*>\s*<\/script>/i;

    if (html.includes(LOCAL_PLACEHOLDER)) {
      const idx = html.indexOf(LOCAL_PLACEHOLDER);
      html = html.slice(0, idx) + '<script>' + safePdfJs + '</script>' + html.slice(idx + LOCAL_PLACEHOLDER.length);
      console.log('copy-reader-assets: embedded pdf.min.js inline from local placeholder');
    } else {
      const cdnMatch = CDN_PLACEHOLDER.exec(html);
      if (cdnMatch) {
        const idx = cdnMatch.index;
        html = html.slice(0, idx) + '<script>' + safePdfJs + '</script>' + html.slice(idx + cdnMatch[0].length);
        console.log('copy-reader-assets: embedded pdf.min.js inline replacing CDN URL');
      } else {
        console.warn('copy-reader-assets: no pdf.min.js placeholder found in template; html may already be processed');
      }
    }

    // ── Step 2: Embed pdf.worker.min.js as a <script type="text/plain"> element ──
    // JavaScript reads its .textContent and creates a Blob URL — no fetch needed.
    // Idempotency: remove any existing worker element before inserting a fresh one.
    if (fs.existsSync(pdfWorkerSrc)) {
      const pdfWorkerJsRaw = fs.readFileSync(pdfWorkerSrc, 'utf8');
      const pdfWorkerJs = transpileForOldWebView(pdfWorkerJsRaw, 'pdf.worker.min.js');
      const safeWorkerJs = safeReplace(pdfWorkerJs, /<\/script/gi, '<\\/script');

      // Strip existing worker element if present
      const WORKER_OPEN = '<script type="text/plain" id="pdf-worker-src">';
      const WORKER_CLOSE = '</script>';
      const existingWorkerStart = html.indexOf(WORKER_OPEN);
      if (existingWorkerStart >= 0) {
        const existingWorkerEnd = html.indexOf(WORKER_CLOSE, existingWorkerStart + WORKER_OPEN.length);
        if (existingWorkerEnd >= 0) {
          html = html.slice(0, existingWorkerStart) + html.slice(existingWorkerEnd + WORKER_CLOSE.length);
          if (html[existingWorkerStart] === '\n') {
            html = html.slice(0, existingWorkerStart) + html.slice(existingWorkerStart + 1);
          }
        }
      }

      const workerTag = WORKER_OPEN + safeWorkerJs + WORKER_CLOSE;
      const headEnd = '</head>';
      const headIdx = html.indexOf(headEnd);
      if (headIdx >= 0) {
        html = html.slice(0, headIdx) + workerTag + '\n' + html.slice(headIdx);
        console.log('copy-reader-assets: embedded pdf.worker.min.js inline');
      }
    }

    fs.writeFileSync(pdfHtmlTemplate, html, 'utf8');
    const finalSize = Buffer.byteLength(html, 'utf8');
    console.log('copy-reader-assets: pdf-reader.html written (' + (finalSize / 1024).toFixed(0) + ' KB total)');
  } catch (e) {
    console.error('copy-reader-assets: failed to embed scripts in pdf-reader.html:', e.message);
  }
}

/**
 * String replacement that avoids the $ special-character problem of String.replace().
 * Uses indexOf + slice so the replacement string is treated as a literal.
 */
function safeReplace(str, pattern, replacement) {
  if (typeof pattern === 'string') {
    let result = '';
    let start = 0;
    let idx;
    while ((idx = str.indexOf(pattern, start)) >= 0) {
      result += str.slice(start, idx) + replacement;
      start = idx + pattern.length;
    }
    return result + str.slice(start);
  }
  let result = '';
  let lastIndex = 0;
  let m;
  pattern.lastIndex = 0;
  while ((m = pattern.exec(str)) !== null) {
    result += str.slice(lastIndex, m.index) + replacement;
    lastIndex = m.index + m[0].length;
    if (!pattern.global) break;
  }
  return result + str.slice(lastIndex);
}
