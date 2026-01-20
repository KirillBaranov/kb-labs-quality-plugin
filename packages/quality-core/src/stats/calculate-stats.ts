/**
 * Calculate monorepo statistics
 *
 * Atomic functions for counting packages, LOC, size, etc.
 */

import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { globby } from 'globby';

export interface MonorepoStats {
  packages: number;
  loc: number;
  size: number;
  sizeFormatted: string;
}

/**
 * Calculate total lines of code in all source files
 */
export async function calculateLinesOfCode(rootDir: string): Promise<number> {
  const sourceFiles = await globby('**/*.{ts,tsx,js,jsx}', {
    cwd: rootDir,
    ignore: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.git/**',
      '**/build/**',
      '**/*.test.{ts,tsx,js,jsx}',
      '**/*.spec.{ts,tsx,js,jsx}',
    ],
    absolute: true,
  });

  let totalLines = 0;

  for (const file of sourceFiles) {
    try {
      const content = await readFile(file, 'utf-8');
      const lines = content.split('\n').length;
      totalLines += lines;
    } catch {
      // Skip files that can't be read
    }
  }

  return totalLines;
}

/**
 * Calculate total size of source files in bytes
 */
export async function calculateSize(rootDir: string): Promise<number> {
  const sourceFiles = await globby('**/*.{ts,tsx,js,jsx}', {
    cwd: rootDir,
    ignore: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.git/**',
      '**/build/**',
    ],
    absolute: true,
  });

  let totalSize = 0;

  for (const file of sourceFiles) {
    try {
      const stats = await stat(file);
      totalSize += stats.size;
    } catch {
      // Skip files that can't be accessed
    }
  }

  return totalSize;
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);

  return `${value.toFixed(2)} ${units[i]}`;
}

/**
 * Count packages in monorepo
 */
export async function countPackages(rootDir: string): Promise<number> {
  const packageJsonFiles = await globby('**/package.json', {
    cwd: rootDir,
    ignore: ['**/node_modules/**', '**/.git/**'],
    absolute: false,
  });

  // Exclude root package.json if it exists
  return packageJsonFiles.filter(p => p !== 'package.json').length;
}

/**
 * Calculate all stats at once
 */
export async function calculateStats(rootDir: string): Promise<MonorepoStats> {
  const [packages, loc, size] = await Promise.all([
    countPackages(rootDir),
    calculateLinesOfCode(rootDir),
    calculateSize(rootDir),
  ]);

  return {
    packages,
    loc,
    size,
    sizeFormatted: formatBytes(size),
  };
}
