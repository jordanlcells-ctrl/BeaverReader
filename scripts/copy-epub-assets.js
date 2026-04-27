#!/usr/bin/env node
/**
 * Copies jszip.min.js and epub.min.js from node_modules to android/app/src/main/assets/
 * so the EPUB reader can load without CDN. Run automatically after npm install (postinstall).
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const assetsDir = path.join(root, 'android', 'app', 'src', 'main', 'assets');
const jszipSrc = path.join(root, 'node_modules', 'jszip', 'dist', 'jszip.min.js');
const epubSrc = path.join(root, 'node_modules', 'epubjs', 'dist', 'epub.min.js');

if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

const copy = (src, name) => {
  if (!fs.existsSync(src)) {
    console.warn('copy-epub-assets: ' + name + ' not found at ' + src + ' (run npm install)');
    return;
  }
  const dest = path.join(assetsDir, name);
  fs.copyFileSync(src, dest);
  console.log('copy-epub-assets: copied ' + name);
};

copy(jszipSrc, 'jszip.min.js');
copy(epubSrc, 'epub.min.js');
