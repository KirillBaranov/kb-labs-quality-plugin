/**
 * Calculate monorepo health score
 *
 * Atomic functions for health checks and scoring.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { globby } from 'globby';

export interface HealthResult {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  issues: HealthIssue[];
}

export interface HealthIssue {
  type: 'duplicate' | 'unused' | 'missing' | 'structure' | 'readme';
  severity: 'high' | 'medium' | 'low';
  message: string;
  count: number;
  penalty: number;
}

/**
 * Check for duplicate dependencies across packages
 */
export async function checkDuplicateDependencies(rootDir: string): Promise<HealthIssue | null> {
  const packageJsonFiles = await globby('**/package.json', {
    cwd: rootDir,
    ignore: ['**/node_modules/**', '**/.git/**'],
    absolute: true,
  });

  // Track all dependencies and their versions
  const depVersions = new Map<string, Set<string>>();

  for (const file of packageJsonFiles) {
    try {
      const content = await readFile(file, 'utf-8');
      const pkg = JSON.parse(content);

      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };

      for (const [name, version] of Object.entries(allDeps)) {
        if (typeof version !== 'string') continue;

        if (!depVersions.has(name)) {
          depVersions.set(name, new Set());
        }
        depVersions.get(name)!.add(version);
      }
    } catch {
      // Skip invalid package.json
    }
  }

  // Count duplicates (deps with more than 1 version)
  const duplicates = Array.from(depVersions.entries()).filter(
    ([, versions]) => versions.size > 1
  );

  if (duplicates.length === 0) return null;

  const penalty = Math.min(duplicates.length * 2, 30); // Max -30 points

  return {
    type: 'duplicate',
    severity: duplicates.length > 20 ? 'high' : duplicates.length > 10 ? 'medium' : 'low',
    message: `Found ${duplicates.length} duplicate dependencies with different versions`,
    count: duplicates.length,
    penalty,
  };
}

/**
 * Check for packages missing README
 */
export async function checkMissingReadmes(rootDir: string): Promise<HealthIssue | null> {
  const packageDirs = await globby('**/package.json', {
    cwd: rootDir,
    ignore: ['**/node_modules/**', '**/.git/**', 'package.json'],
    absolute: true,
  });

  let missingCount = 0;

  for (const pkgPath of packageDirs) {
    const dir = join(pkgPath, '..');
    const readmePaths = [
      join(dir, 'README.md'),
      join(dir, 'readme.md'),
      join(dir, 'Readme.md'),
    ];

    let hasReadme = false;
    for (const readmePath of readmePaths) {
      try {
        await readFile(readmePath, 'utf-8');
        hasReadme = true;
        break;
      } catch {
        // README doesn't exist
      }
    }

    if (!hasReadme) {
      missingCount++;
    }
  }

  if (missingCount === 0) return null;

  const penalty = Math.min(missingCount, 15); // Max -15 points

  return {
    type: 'readme',
    severity: missingCount > 20 ? 'high' : missingCount > 10 ? 'medium' : 'low',
    message: `Found ${missingCount} packages without README`,
    count: missingCount,
    penalty,
  };
}

/**
 * Calculate health score from issues
 */
export function calculateHealthScore(issues: HealthIssue[]): number {
  const baseScore = 100;
  const totalPenalty = issues.reduce((sum, issue) => sum + issue.penalty, 0);

  return Math.max(0, baseScore - totalPenalty);
}

/**
 * Convert score to letter grade
 */
export function scoreToGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/**
 * Calculate complete health report
 */
export async function calculateHealth(rootDir: string): Promise<HealthResult> {
  const issues: HealthIssue[] = [];

  // Run all checks in parallel
  const [duplicatesIssue, readmesIssue] = await Promise.all([
    checkDuplicateDependencies(rootDir),
    checkMissingReadmes(rootDir),
  ]);

  if (duplicatesIssue) issues.push(duplicatesIssue);
  if (readmesIssue) issues.push(readmesIssue);

  const score = calculateHealthScore(issues);
  const grade = scoreToGrade(score);

  return {
    score,
    grade,
    issues,
  };
}
