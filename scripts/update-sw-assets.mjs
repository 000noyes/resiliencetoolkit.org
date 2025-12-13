#!/usr/bin/env node
import { readdir, readFile, writeFile } from 'node:fs/promises';

const DIST_DIR = 'dist/_astro';
const SW_PATH = 'public/sw.js';

// Critical assets to track (base names without hashes)
const CRITICAL_ASSETS = [
  { base: 'client', type: 'js' },
  { base: 'index', type: 'js' },
  { base: 'storage', type: 'js' },
  { base: 'EditableTable', type: 'js' },
  { base: 'ExternalLink', type: 'js' },
  { base: 'FeedbackWidgetWrapper', type: 'js' },
  { base: 'Todo', type: 'js' },
  { base: 'createLucideIcon', type: 'js' },
  { base: 'BaseLayout.astro_astro_type_script_index_0_lang', type: 'js' },
  { base: 'GuestModeBanner', type: 'js' },
  { base: 'jsx-runtime', type: 'js' },
  { base: 'UserMenuWrapper', type: 'js' },
  { base: 'x', type: 'js' },
  { base: '2-1-basic-needs', type: 'css' },
];

async function main() {
  try {
    console.log('🔄 Updating service worker assets...');

    // 1. Read dist directory
    const distFiles = await readdir(DIST_DIR);

    // 2. Find matching hashed files
    const assetPaths = [];
    const missing = [];

    for (const { base, type } of CRITICAL_ASSETS) {
      const match = distFiles.find(file =>
        file.startsWith(base + '.') && file.endsWith(`.${type}`)
      );

      if (match) {
        assetPaths.push(`  '/_astro/${match}',`);
      } else {
        missing.push(`${base}.*.${type}`);
      }
    }

    // Warn about missing assets
    if (missing.length > 0) {
      console.warn('⚠️  Missing assets:', missing.join(', '));
    }

    // 3. Read service worker
    let swContent = await readFile(SW_PATH, 'utf8');

    // 4. Replace asset block
    const jsAssets = assetPaths.filter(p => p.includes('.js'));
    const cssAssets = assetPaths.filter(p => p.includes('.css'));

    const newBlock = [
      '  // ASSETS_START - Auto-generated section - do not manually edit',
      '  // Critical JavaScript bundles (Astro-generated)',
      ...jsAssets,
      '',
      '  // Critical CSS',
      ...cssAssets,
      '  // ASSETS_END - Auto-generated section - do not manually edit',
    ].join('\n');

    swContent = swContent.replace(
      /\/\/ ASSETS_START[\s\S]*?\/\/ ASSETS_END[^\n]*/,
      newBlock
    );

    // 5. Auto-increment cache version
    swContent = swContent.replace(
      /const CACHE_VERSION = '(.+)';/,
      (match, currentVersion) => {
        const versionMatch = currentVersion.match(/v(\d+)/);
        if (versionMatch) {
          const newNum = parseInt(versionMatch[1]) + 1;
          const newVersion = currentVersion.replace(/v\d+/, `v${newNum}`);
          console.log(`  📦 Cache version: ${currentVersion} → ${newVersion}`);
          return `const CACHE_VERSION = '${newVersion}';`;
        }
        return match;
      }
    );

    // 6. Write back
    await writeFile(SW_PATH, swContent, 'utf8');

    console.log(`✅ Service Worker updated successfully`);
    console.log(`   Found ${assetPaths.length}/${CRITICAL_ASSETS.length} critical assets`);

  } catch (error) {
    console.error('❌ Failed to update service worker:', error.message);
    process.exit(1);
  }
}

main();
