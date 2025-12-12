/**
 * Generate extension icons
 * Run with: node scripts/generate-icons.js
 *
 * This creates simple placeholder PNG icons for the Chrome extension.
 * For production, replace these with professionally designed icons.
 */

const fs = require("fs");
const path = require("path");

// Simple PNG generator - creates a basic colored square with gradient effect
// This uses raw PNG encoding without external dependencies

function createPNG(size) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const width = size;
  const height = size;
  const bitDepth = 8;
  const colorType = 6; // RGBA
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(bitDepth, 8);
  ihdrData.writeUInt8(colorType, 9);
  ihdrData.writeUInt8(0, 10); // compression
  ihdrData.writeUInt8(0, 11); // filter
  ihdrData.writeUInt8(0, 12); // interlace
  const ihdr = createChunk("IHDR", ihdrData);

  // IDAT chunk - image data
  const rawData = [];
  for (let y = 0; y < height; y++) {
    rawData.push(0); // filter byte for each row
    for (let x = 0; x < width; x++) {
      // Create a gradient from blue to indigo (matching the app's theme)
      const centerX = width / 2;
      const centerY = height / 2;
      const dist = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
      const maxDist = Math.sqrt(Math.pow(centerX, 2) + Math.pow(centerY, 2));
      const ratio = dist / maxDist;

      // Blue to indigo gradient
      const r = Math.round(59 + (99 - 59) * ratio); // 59 -> 99
      const g = Math.round(130 + (102 - 130) * ratio); // 130 -> 102
      const b = Math.round(246 + (241 - 246) * ratio); // 246 -> 241

      // Add a play button triangle in the center
      const inTriangle = isInPlayButton(x, y, width, height);

      if (inTriangle) {
        // White play button
        rawData.push(255, 255, 255, 255);
      } else {
        rawData.push(r, g, b, 255);
      }
    }
  }

  const rawBuffer = Buffer.from(rawData);
  const { deflateSync } = require("zlib");
  const compressed = deflateSync(rawBuffer);
  const idat = createChunk("IDAT", compressed);

  // IEND chunk
  const iend = createChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function isInPlayButton(x, y, width, height) {
  const centerX = width / 2;
  const centerY = height / 2;
  const triangleSize = width * 0.35;

  // Triangle vertices (pointing right)
  const leftX = centerX - triangleSize * 0.3;
  const rightX = centerX + triangleSize * 0.4;
  const topY = centerY - triangleSize * 0.5;
  const bottomY = centerY + triangleSize * 0.5;

  // Check if point is inside the triangle
  // Using barycentric coordinates
  const v0x = rightX - leftX;
  const v0y = centerY - topY;
  const v1x = leftX - leftX;
  const v1y = bottomY - topY;
  const v2x = x - leftX;
  const v2y = y - topY;

  const dot00 = v0x * v0x + v0y * v0y;
  const dot01 = v0x * v1x + v0y * v1y;
  const dot02 = v0x * v2x + v0y * v2y;
  const dot11 = v1x * v1x + v1y * v1y;
  const dot12 = v1x * v2x + v1y * v2y;

  const invDenom = 1 / (dot00 * dot11 - dot01 * dot01);
  const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
  const v = (dot00 * dot12 - dot01 * dot02) * invDenom;

  return u >= 0 && v >= 0 && u + v <= 1;
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, "ascii");
  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = crc32(crcData);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc >>> 0, 0);

  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

// CRC32 implementation for PNG
function crc32(data) {
  let crc = 0xffffffff;
  const table = makeCRCTable();

  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xff];
  }

  return crc ^ 0xffffffff;
}

function makeCRCTable() {
  const table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
}

// Generate icons
const sizes = [16, 48, 128];
const iconsDir = path.join(__dirname, "..", "extension", "icons");

// Ensure directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

sizes.forEach((size) => {
  const png = createPNG(size);
  const filename = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(filename, png);
  console.log(`Generated: ${filename}`);
});

console.log("All icons generated successfully!");
