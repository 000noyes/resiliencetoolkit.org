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

/**
 * Convert a changelog entry to an email body
 */
function entryToEmailBody(entry) {
  let body = `# ${entry.title}\n\n`;

  // Add summary bullets
  if (entry.summary && entry.summary.length > 0) {
    body += entry.summary.map(item => `- ${item}`).join('\n');
    body += '\n\n';
  }

  // Add sections
  for (const section of entry.sections) {
    if (section.heading) {
      body += `## ${section.heading}\n\n`;
    }

    // Convert HTML content to plain text (basic conversion)
    let content = section.content
      .replace(/<p>/g, '')
      .replace(/<\/p>/g, '\n\n')
      .replace(/<ul>/g, '')
      .replace(/<\/ul>/g, '\n')
      .replace(/<ol>/g, '')
      .replace(/<\/ol>/g, '\n')
      .replace(/<li>/g, '- ')
      .replace(/<\/li>/g, '\n')
      .replace(/<strong>/g, '**')
      .replace(/<\/strong>/g, '**')
      .replace(/<em>/g, '_')
      .replace(/<\/em>/g, '_')
      .replace(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g, '[$2]($1)')
      .replace(/<[^>]+>/g, '') // Remove any remaining HTML tags
      .trim();

    body += content + '\n\n';

    // Add image link if present
    if (section.image) {
      body += `![${section.image.alt}](https://resiliencetoolkit.org${section.image.src})\n`;
      if (section.image.caption) {
        body += `*${section.image.caption}*\n`;
      }
      body += '\n';
    }
  }

  body += '---\n\n';
  body += '[View full changelog](https://resiliencetoolkit.org/changelog)\n';

  return body;
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
