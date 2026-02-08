#!/usr/bin/env node
/**
 * Changelog Email Sender
 *
 * Sends new changelog entries to subscribers via Buttondown API.
 * Tracks which entries have been sent to avoid duplicates.
 *
 * Usage:
 *   BUTTONDOWN_API_KEY=your_key node scripts/send-changelog-email.mjs
 *
 * Environment variables:
 *   BUTTONDOWN_API_KEY - Your Buttondown API key (required)
 *   DRY_RUN - Set to "true" to preview without sending (optional)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

const SENT_ENTRIES_FILE = join(ROOT_DIR, '.changelog-sent.json');
const BUTTONDOWN_API_URL = 'https://api.buttondown.email/v1/emails';

/**
 * Load the list of already-sent entry IDs
 */
function loadSentEntries() {
  if (!existsSync(SENT_ENTRIES_FILE)) {
    return [];
  }
  try {
    const data = readFileSync(SENT_ENTRIES_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

/**
 * Save the list of sent entry IDs
 */
function saveSentEntries(sentIds) {
  writeFileSync(SENT_ENTRIES_FILE, JSON.stringify(sentIds, null, 2));
}

/**
 * Dynamically import and get changelog entries
 * We need to handle the TypeScript file
 */
async function getChangelogEntries() {
  // Read the TypeScript file and extract the data
  const changelogPath = join(ROOT_DIR, 'src/data/changelog.ts');
  const content = readFileSync(changelogPath, 'utf-8');

  // Extract the changelogEntries array using regex
  // This is a simple parser for the specific format we use
  const entriesMatch = content.match(/export const changelogEntries:\s*ChangelogEntry\[\]\s*=\s*(\[[\s\S]*?\]);/);

  if (!entriesMatch) {
    throw new Error('Could not parse changelog entries from changelog.ts');
  }

  // Use Function constructor to safely evaluate the array
  // First, clean up the TypeScript-specific parts
  let entriesCode = entriesMatch[1];

  // Convert template literals to regular strings
  entriesCode = entriesCode.replace(/`([^`]*)`/g, (_, content) => {
    return JSON.stringify(content);
  });

  // Evaluate the array
  const entries = eval(entriesCode);
  return entries;
}

const SITE_URL = 'https://resiliencetoolkit.org';

/**
 * Strip template-literal indentation so content lines start flush-left.
 */
function normalizeHTML(html) {
  return html.split('\n').map(line => line.trim()).filter(line => line).join('\n');
}

/**
 * Convert simple HTML (as used in changelog entries) to clean Markdown.
 */
function htmlToMarkdown(html) {
  let text = normalizeHTML(html);

  // Block elements → Markdown structure
  text = text.replace(/<p>([\s\S]*?)<\/p>/g, '$1\n\n');
  text = text.replace(/<\/?ul>/g, '\n');
  text = text.replace(/<\/?ol>/g, '\n');
  text = text.replace(/<li>([\s\S]*?)<\/li>/g, '- $1\n');

  // Inline elements → Markdown
  text = text.replace(/<strong>([\s\S]*?)<\/strong>/g, '**$1**');
  text = text.replace(/<em>([\s\S]*?)<\/em>/g, '_$1_');
  text = text.replace(/<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g, (_, href, label) => {
    const url = href.startsWith('/') ? `${SITE_URL}${href}` : href;
    return `[${label}](${url})`;
  });

  // Strip any remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');

  return collapseWhitespace(text);
}

/**
 * Reduce excessive blank lines to a single blank line, trim each line.
 */
function collapseWhitespace(text) {
  return text
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Build an email-safe HTML image block with inline styles for sizing.
 */
function createEmailImage(image) {
  let html = `<img src="${SITE_URL}${image.src}" alt="${image.alt}" style="max-width:600px;width:100%;height:auto;display:block;margin:16px 0;" />`;
  if (image.caption) {
    html += `\n<p style="margin:4px 0 0;font-size:14px;font-style:italic;color:#666;">${image.caption}</p>`;
  }
  return html;
}

/**
 * Convert a changelog entry to a clean email body.
 * Output: Markdown text with HTML only for images (for proper sizing in email clients).
 */
function entryToEmailBody(entry) {
  const parts = [];

  // Title
  parts.push(`# ${entry.title}`);

  // Summary bullets
  if (entry.summary?.length > 0) {
    parts.push(entry.summary.map(item => `- ${item}`).join('\n'));
  }

  // Sections
  for (const section of entry.sections) {
    if (section.heading) {
      parts.push(`## ${section.heading}`);
    }

    parts.push(htmlToMarkdown(section.content));

    if (section.image) {
      parts.push(createEmailImage(section.image));
    }
  }

  // Footer
  parts.push('---');
  parts.push(`[View full changelog](${SITE_URL}/changelog)`);

  return collapseWhitespace(parts.join('\n\n'));
}

/**
 * Send an email via Buttondown API
 */
async function sendEmail(entry, apiKey, dryRun = false) {
  const subject = `Resilience Hub Toolkit: ${entry.title}`;
  const body = entryToEmailBody(entry);

  console.log(`\n📧 Entry #${entry.id}: "${entry.title}"`);

  if (dryRun) {
    console.log('   [DRY RUN] Would send email with subject:', subject);
    console.log('   Body preview (first 200 chars):', body.substring(0, 200) + '...');
    return true;
  }

  try {
    const response = await fetch(BUTTONDOWN_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subject,
        body,
        status: 'draft', // Save as draft for manual review before sending
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Buttondown API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log(`   ✅ Draft created successfully! ID: ${result.id} — review and send at buttondown.com`);
    return true;
  } catch (error) {
    console.error(`   ❌ Failed to send email:`, error.message);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Changelog Email Sender\n');

  const apiKey = process.env.BUTTONDOWN_API_KEY;
  const dryRun = process.env.DRY_RUN === 'true';

  if (!apiKey && !dryRun) {
    console.error('❌ Error: BUTTONDOWN_API_KEY environment variable is required');
    console.log('   Set DRY_RUN=true to preview without sending');
    process.exit(1);
  }

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No emails will be sent\n');
  }

  // Load entries and sent tracking
  const entries = await getChangelogEntries();
  const sentIds = loadSentEntries();

  console.log(`📋 Found ${entries.length} changelog entries`);
  console.log(`📤 Previously sent: ${sentIds.length} entries`);

  // Find new entries (not in sent list)
  const newEntries = entries.filter(entry => !sentIds.includes(entry.id));

  if (newEntries.length === 0) {
    console.log('\n✨ No new entries to send!');
    return;
  }

  console.log(`\n📬 New entries to send: ${newEntries.length}`);

  // Send emails for new entries
  const successfulIds = [];

  for (const entry of newEntries) {
    const success = await sendEmail(entry, apiKey, dryRun);
    if (success) {
      successfulIds.push(entry.id);
    }
  }

  // Update sent tracking (unless dry run)
  if (!dryRun && successfulIds.length > 0) {
    const updatedSentIds = [...sentIds, ...successfulIds];
    saveSentEntries(updatedSentIds);
    console.log(`\n📝 Updated tracking file with ${successfulIds.length} new entries`);
  }

  console.log('\n✅ Done!');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
