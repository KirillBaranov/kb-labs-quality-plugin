/**
 * Common types shared across Quality Plugin
 */

/**
 * Package information
 */
export interface PackageInfo {
  name: string;
  version: string;
  path: string;
  repository?: string;
}

/**
 * Repository information
 */
export interface RepositoryInfo {
  name: string;
  path: string;
  packages: PackageInfo[];
}

/**
 * Issue severity levels
 */
export type IssueSeverity = 'critical' | 'warning' | 'info';

/**
 * Generic issue type
 */
export interface Issue {
  type: string;
  severity: IssueSeverity;
  message: string;
  package?: string;
  file?: string;
  line?: number;
}

/**
 * Recommendation for fixing issues
 */
export interface Recommendation {
  title: string;
  description: string;
  command?: string;
  priority: 'high' | 'medium' | 'low';
}
