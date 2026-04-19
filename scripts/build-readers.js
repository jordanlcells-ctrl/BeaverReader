#!/usr/bin/env node
/**
 * Single entry point to rebuild all WebView reader assets for Android (and iOS PDF copies).
 * Run after changing:
 *   - src/utils/pdfReaderHtml.ts  → triggers pdf-reader.html regeneration
 *   - node_modules pdfjs/jszip    → copy-epub-assets embeds fresh bundles
 *   - (epub-reader.html is edited in android/.../assets directly; this script does not overwrite it)
 *
 * Usage: npm run build:readers
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const assetsDir = path.join(root, 'android', 'app', 'src', 'main', 'assets');

function runScript(relName) {
  const scriptPath = path.join(__dirname, relName);
  const r = spawnSync(process.execPath, [scriptPath], { cwd: root, stdio: 'inherit' });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

function sha256Prefix(filePath) {
  const h = crypto.createHash('sha256');
  h.update(fs.readFileSync(filePath));
  return h.digest('hex').slice(0, 16);
}

console.log('build-readers: step 1/3 — generate-pdf-template.js');
runScript('generate-pdf-template.js');

console.log('build-readers: step 2/3 — copy-epub-assets.js');
runScript('copy-epub-assets.js');

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const meta = {
  builtAt: new Date().toISOString(),
  packageVersion: pkg.version,
  assets: {},
};

const pdfPath = path.join(assetsDir, 'pdf-reader.html');
const epubPath = path.join(assetsDir, 'epub-reader.html');
if (fs.existsSync(pdfPath)) {
  meta.assets.pdfReaderHtml = {
    path: 'android/app/src/main/assets/pdf-reader.html',
    bytes: fs.statSync(pdfPath).size,
    sha256Prefix: sha256Prefix(pdfPath),
  };
}
if (fs.existsSync(epubPath)) {
  meta.assets.epubReaderHtml = {
    path: 'android/app/src/main/assets/epub-reader.html',
    bytes: fs.statSync(epubPath).size,
    sha256Prefix: sha256Prefix(epubPath),
  };
}

const metaPath = path.join(assetsDir, 'readers-build.json');
fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n', 'utf8');
console.log('build-readers: step 3/3 — wrote', path.relative(root, metaPath));
console.log('build-readers: done');
