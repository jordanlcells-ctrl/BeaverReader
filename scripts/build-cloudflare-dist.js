/**
 * Copies cloudflare-web/ into dist/ for Wrangler static asset deploy.
 * This repo is React Native (not Expo); do not use `expo export` here.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'cloudflare-web');
const dst = path.join(root, 'dist');

function copyDir(from, to) {
  fs.mkdirSync(to, {recursive: true});
  for (const name of fs.readdirSync(from)) {
    const fp = path.join(from, name);
    const tp = path.join(to, name);
    const st = fs.statSync(fp);
    if (st.isDirectory()) {
      copyDir(fp, tp);
    } else {
      fs.copyFileSync(fp, tp);
    }
  }
}

if (!fs.existsSync(src)) {
  console.error('Missing cloudflare-web/ directory');
  process.exit(1);
}

fs.rmSync(dst, {recursive: true, force: true});
copyDir(src, dst);
console.log('Wrote', dst);
