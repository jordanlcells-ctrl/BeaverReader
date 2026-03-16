/**
 * Generates Android launcher icons from assets/BeaverReaderIcon2.png
 * into android/app/src/main/res/mipmap-* folders.
 * Run: node scripts/generate-android-icons.js
 * Requires: npm install --save-dev sharp
 */
const fs = require('fs');
const path = require('path');

const sizes = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

const root = path.resolve(__dirname, '..');
const srcIcon = path.join(root, 'assets', 'BeaverReaderIcon2.png');
const resDir = path.join(root, 'android', 'app', 'src', 'main', 'res');

if (!fs.existsSync(srcIcon)) {
  console.error('Source icon not found:', srcIcon);
  process.exit(1);
}

let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('Run: npm install --save-dev sharp');
  process.exit(1);
}

// Replace any light/off-white/beige pixel with pure white (255,255,255)
// Use min(r,g,b) so we catch beige like (250,248,240) where one channel is lower
async function forceWhiteBackground(inputBuffer) {
  const { data, info } = await sharp(inputBuffer).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const channels = info.channels;
  const len = data.length;
  const minThreshold = 225; // if min(r,g,b) >= this, treat as background -> pure white (catches beige)
  for (let i = 0; i < len; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const min = Math.min(r, g, b);
    if (min >= minThreshold) {
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
    }
  }
  return sharp(data, {
    raw: { width: info.width, height: info.height, channels },
  })
    .png()
    .toBuffer();
}

(async () => {
  for (const [folder, size] of Object.entries(sizes)) {
    const dir = path.join(resDir, folder);
    fs.mkdirSync(dir, { recursive: true });
    const outPath = path.join(dir, 'ic_launcher.png');
    const roundPath = path.join(dir, 'ic_launcher_round.png');

    // Pure white RGB canvas (255,255,255)
    const whiteBg = await sharp({
      create: { width: size, height: size, channels: 3, background: { r: 255, g: 255, b: 255 } },
    })
      .png()
      .toBuffer();

    // Beaver resized with alpha
    const beaver = await sharp(srcIcon)
      .ensureAlpha()
      .resize(size, size)
      .toBuffer();

    // Composite beaver over white, then force any remaining off-white to pure white
    const composited = await sharp(whiteBg)
      .composite([{ input: beaver, blend: 'over' }])
      .png()
      .toBuffer();

    const out = await forceWhiteBackground(composited);
    fs.writeFileSync(outPath, out);
    fs.writeFileSync(roundPath, out);
    console.log('Generated', folder, size + 'px (pure white #FFFFFF)');
  }
  console.log('Done. Uninstall the app from device, then: npx react-native run-android');
})();
