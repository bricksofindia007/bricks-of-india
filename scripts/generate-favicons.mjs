/**
 * Bricks of India — Favicon Generator
 *
 * Source: /public/brand/blue-minifig.png (1184×864, no alpha)
 * Decision: center-crop to 864×864 square so the minifigure stays centred,
 * then resize to all required icon dimensions.
 *
 * Outputs:
 *   /public/favicon-16x16.png
 *   /public/favicon-32x32.png
 *   /public/favicon.ico        (multi-res: 16, 32, 48)
 *   /public/apple-touch-icon.png  (180×180, white bg)
 *   /public/android-chrome-192x192.png
 *   /public/android-chrome-512x512.png
 */

import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SRC  = join(ROOT, 'public/brand/blue-minifig.png');
const OUT  = join(ROOT, 'public');

const meta = await sharp(SRC).metadata();
console.log(`Source: ${meta.width}×${meta.height}, format=${meta.format}, hasAlpha=${meta.hasAlpha}`);

// Center-crop to square using the shorter dimension (height = 864)
const cropSize = Math.min(meta.width, meta.height); // 864
const left     = Math.round((meta.width  - cropSize) / 2);
const top      = Math.round((meta.height - cropSize) / 2);
console.log(`Crop: ${cropSize}×${cropSize} at (${left},${top}) — keeps minifigure centred`);

// Base pipeline: crop then any resize
function base() {
  return sharp(SRC).extract({ left, top, width: cropSize, height: cropSize });
}

// ── PNG sizes ────────────────────────────────────────────────────────────────

const pngSizes = [
  { name: 'favicon-16x16.png',           size: 16  },
  { name: 'favicon-32x32.png',           size: 32  },
  { name: 'android-chrome-192x192.png',  size: 192 },
  { name: 'android-chrome-512x512.png',  size: 512 },
];

for (const { name, size } of pngSizes) {
  const path = join(OUT, name);
  await base().resize(size, size).png({ compressionLevel: 9 }).toFile(path);
  console.log(`✓ ${name}`);
}

// Apple touch icon — 180×180 with white background (spec requirement)
await base()
  .resize(180, 180)
  .flatten({ background: { r: 255, g: 255, b: 255 } })
  .png({ compressionLevel: 9 })
  .toFile(join(OUT, 'apple-touch-icon.png'));
console.log('✓ apple-touch-icon.png (white bg)');

// ── favicon.ico (multi-res: 16, 32, 48) ──────────────────────────────────────
// ICO format embeds PNG blobs directly (ICO type 1 with PNG data).
// Modern browsers and OS icon caches handle this fine.

const icoSizes = [16, 32, 48];
const pngBuffers = await Promise.all(
  icoSizes.map((s) =>
    base().resize(s, s).png({ compressionLevel: 9 }).toBuffer(),
  ),
);

// Build ICO binary
// Header: 6 bytes
// Directory entries: 16 bytes × count
// Then PNG data concatenated

const count     = icoSizes.length;
const headerSize = 6;
const dirEntrySize = 16;
const dataOffset = headerSize + dirEntrySize * count;

// Calculate total file size
let totalDataSize = 0;
const offsets = [];
for (const buf of pngBuffers) {
  offsets.push(dataOffset + totalDataSize);
  totalDataSize += buf.length;
}

const icoBuffer = Buffer.alloc(dataOffset + totalDataSize);
let pos = 0;

// Header
icoBuffer.writeUInt16LE(0, pos);       // reserved
icoBuffer.writeUInt16LE(1, pos + 2);   // type: 1 = ICO
icoBuffer.writeUInt16LE(count, pos + 4); // count
pos += 6;

// Directory entries
for (let i = 0; i < count; i++) {
  const size = icoSizes[i];
  const buf  = pngBuffers[i];
  icoBuffer.writeUInt8(size >= 256 ? 0 : size, pos);      // width (0 = 256)
  icoBuffer.writeUInt8(size >= 256 ? 0 : size, pos + 1);  // height
  icoBuffer.writeUInt8(0, pos + 2);   // colorCount (0 = >256 colors)
  icoBuffer.writeUInt8(0, pos + 3);   // reserved
  icoBuffer.writeUInt16LE(1, pos + 4); // planes
  icoBuffer.writeUInt16LE(32, pos + 6); // bitCount
  icoBuffer.writeUInt32LE(buf.length, pos + 8);     // sizeInBytes
  icoBuffer.writeUInt32LE(offsets[i],  pos + 12);   // offset
  pos += 16;
}

// PNG data
for (const buf of pngBuffers) {
  buf.copy(icoBuffer, pos);
  pos += buf.length;
}

writeFileSync(join(OUT, 'favicon.ico'), icoBuffer);
console.log(`✓ favicon.ico (${icoSizes.join(', ')}px)`);

console.log('\nAll favicons generated successfully.');
