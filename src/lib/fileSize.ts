/**
 * File Size Utilities
 *
 * Functions for reading and formatting file sizes at build time.
 * Uses Node.js fs module which runs during Astro's static site generation.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Get file size in bytes
 * @param filePath - Relative path from project root (e.g., 'public/toolkit/file.pdf')
 * @returns File size in bytes, or 0 if file not found
 */
export async function getFileSizeBytes(filePath: string): Promise<number> {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    const stats = await fs.stat(fullPath);
    return stats.size;
  } catch (error) {
    console.warn(`Could not read file size for ${filePath}:`, error);
    return 0;
  }
}

/**
 * Convert bytes to human-readable format
 * @param bytes - Size in bytes
 * @returns Formatted string (e.g., "2.7 MB", "4.0 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Get formatted file size string
 * @param filePath - Relative path from project root
 * @returns Formatted file size (e.g., "2.7 MB")
 */
export async function getFormattedFileSize(filePath: string): Promise<string> {
  const bytes = await getFileSizeBytes(filePath);
  return formatFileSize(bytes);
}
