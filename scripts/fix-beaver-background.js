const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const assetsPath = path.join(__dirname, '../src/assets');
const inputPath = path.join(assetsPath, 'beaver-logo-solid.png');
const tempPath = path.join(assetsPath, 'beaver-logo-solid-temp.png');

// App background color: #F9F7F1 (warm off-white) - must match LoginScreen
const BG = { r: 249, g: 247, b: 241 };

async function fixImage() {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;

  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Replace white/very light background with app color
    // Catches #FFFFFF and lighter-than-app colors - the "halo" around the beaver
    const isLighterThanBg = r >= 248 && g >= 246 && b >= 240;
    if (isLighterThanBg) {
      data[i] = BG.r;
      data[i + 1] = BG.g;
      data[i + 2] = BG.b;
      data[i + 3] = 255;
    }
  }

  await sharp(data, { raw: { width, height, channels } })
    .png()
    .toFile(tempPath);

  fs.renameSync(tempPath, inputPath);
  console.log('✓ beaver-logo-solid.png background updated to #F9F7F1');
}

fixImage().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
