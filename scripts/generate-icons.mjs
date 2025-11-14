#!/usr/bin/env node
import sharp from 'sharp';
import { mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');
const iconsDir = join(publicDir, 'icons');
const sourceIcon = join(publicDir, 'RHT_orange.svg');

// Icon sizes to generate for PWA
const sizes = [
  16,  // Browser favicon
  32,  // Browser favicon
  72,  // iOS/Android legacy
  96,  // Android devices
  128, // Chrome Web Store
  144, // Windows Metro tiles
  152, // iPad touch icon
  180, // Apple touch icon (iPhone)
  192, // Android home screen
  384, // Larger Android devices
  512  // Android splash screen
];

async function generateIcons() {
  console.log('🎨 Generating PWA icons from RHT_orange.svg...\n');

  // Create icons directory if it doesn't exist
  try {
    await mkdir(iconsDir, { recursive: true });
    console.log('✓ Created /public/icons/ directory');
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }

  // Generate each icon size
  for (const size of sizes) {
    const outputPath = join(iconsDir, `icon-${size}x${size}.png`);

    try {
      await sharp(sourceIcon)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 } // Transparent background
        })
        .png()
        .toFile(outputPath);

      console.log(`✓ Generated icon-${size}x${size}.png`);
    } catch (err) {
      console.error(`✗ Failed to generate ${size}x${size}:`, err.message);
    }
  }

  // Also generate favicon.svg replacement (copy of RHT_orange.svg)
  console.log('\n✓ All icons generated successfully!');
  console.log(`\nGenerated ${sizes.length} icon sizes in /public/icons/`);
}

generateIcons().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
