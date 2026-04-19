#!/usr/bin/env node
/**
 * Generates android/app/src/main/assets/pdf-reader.html from pdfReaderHtml.ts.
 * Run: node scripts/generate-pdf-template.js
 */
const { execSync } = require('child_process');
const { writeFileSync, existsSync, unlinkSync } = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const src = path.resolve(root, 'src/utils/pdfReaderHtml.ts');
const out = path.resolve(root, 'android/app/src/main/assets/pdf-reader.html');
const esbuildBin = path.resolve(root, 'node_modules/.bin/esbuild');
const tmpJs = path.resolve(root, 'scripts', '.tmp-pdfReaderHtml.js');

try {
  // Transpile TypeScript to CommonJS using esbuild
  execSync(
    `"${esbuildBin}" "${src}" --bundle=false --platform=node --format=cjs --outfile="${tmpJs}"`,
    { stdio: 'inherit' }
  );

  const { getPdfReaderHtml } = require(tmpJs);
  // The template escapes </script as <\/script to be safe inside template literals.
  // Unescape it so the HTML file has proper </script> closing tags.
  const html = getPdfReaderHtml(false).replace(/<\\\/script/g, '</script');
  writeFileSync(out, html, 'utf8');
  const lines = html.split('\n').length;
  console.log(`generate-pdf-template: wrote pdf-reader.html (${html.length} bytes, ${lines} lines)`);
} catch (e) {
  console.error('generate-pdf-template: failed:', e.message);
  process.exit(1);
} finally {
  try { if (existsSync(tmpJs)) unlinkSync(tmpJs); } catch {}
}
