# 📋 План разработки kb-labs-quality-plugin

> **Самостоятельный плагин** для анализа и улучшения качества кода в монорепо.
> Портирует идеи из DevKit (18 скриптов) в полноценную платформенную интеграцию.

---

## 🎯 Концепция

**Quality Plugin** = DevKit идеи + KB Labs платформа

### Что это даёт:

- ✅ **DevKit остаётся standalone** - простые .mjs скрипты, 0 зависимостей, fallback если платформа упала
- ✅ **Plugin использует платформу** - State Broker, Analytics, LLM, полная интеграция
- ✅ **Две независимые кодовые базы** - Plugin портирует логику из DevKit + улучшает её
- ✅ **DevKit = source of truth** для алгоритмов

### Разделение ответственности:

| DevKit | Quality Plugin |
|--------|---------------|
| `.mjs` скрипты | TypeScript с типами |
| 0 зависимостей | Полная интеграция с платформой |
| `npx kb-devkit-stats` | `kb quality:stats` |
| Работает везде | Работает в KB Labs |
| Fallback | Production |

---

## 🏗️ Архитектура

### Ключевые правила (КРИТИЧНО!)

1. **Импорты**: Плагин импортирует **ТОЛЬКО** из `@kb-labs/sdk` и своих пакетов
2. **UI**: Используем `ctx.ui.*` (таблицы, спиннеры, цвета)
3. **Platform Services**: Используем `ctx.platform.*` (cache, storage, analytics, logger)
4. **Handlers**: Создаём через `defineCommand()` из SDK
5. **Contracts**: Обязательный пакет с types, schemas, constants
6. **Никаких велосипедов**: Вся инфраструктура уже есть в `ctx`

### Структура репозитория

```
kb-labs-quality-plugin/
├── packages/
│   ├── quality-contracts/          # Типы, схемы, константы
│   └── quality-cli/                # Основной пакет с командами
├── docs/
│   ├── architecture.md
│   └── examples.md
├── package.json
└── pnpm-workspace.yaml
```

---

## 📦 Package 1: quality-contracts

### Назначение
Shared типы и схемы для всех команд плагина. Единый источник истины для типов.

### Структура

```
packages/quality-contracts/
├── src/
│   ├── index.ts                    # Главный экспорт
│   │
│   ├── types/
│   │   ├── stats.ts               # StatsResult, PackageStats, HealthScore
│   │   ├── health.ts              # HealthCheckResult, Issue, Recommendation
│   │   ├── imports.ts             # ImportAnalysis, BrokenImport, CircularDep
│   │   ├── exports.ts             # ExportAnalysis, UnusedExport
│   │   ├── deps.ts                # DependencyFix, DuplicateInfo, OrphanPackage
│   │   ├── types-check.ts         # TypesCheckResult, TypeCoverage
│   │   ├── build.ts               # BuildOrder, Layer, CircularDep
│   │   └── common.ts              # Общие типы (PackageInfo, RepoInfo)
│   │
│   ├── schemas/
│   │   ├── stats-schema.ts        # Zod схемы для stats
│   │   ├── health-schema.ts       # Zod схемы для health
│   │   ├── deps-schema.ts         # Zod схемы для fix-deps
│   │   └── config-schema.ts       # Конфигурация плагина
│   │
│   ├── constants.ts               # ENV vars, cache keys, defaults
│   └── flags.ts                   # Shared flags definitions
│
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

### Основные типы

```typescript
// types/stats.ts
export interface StatsResult {
  overview: {
    totalPackages: number;
    totalRepositories: number;
    totalFiles: number;
    totalLines: number;
    totalBytes: number;
  };
  byRepository: Record<string, RepositoryStats>;
  dependencies: DependencyStats;
  health: HealthScore;
  largestPackages: PackageStats[];
}

export interface HealthScore {
  score: number;          // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  issues: Issue[];
}

// types/health.ts
export interface HealthCheckResult {
  packages: PackageHealth[];
  summary: {
    total: number;
    healthy: number;
    warnings: number;
    critical: number;
  };
  recommendations: Recommendation[];
}

// types/imports.ts
export interface ImportAnalysis {
  brokenImports: BrokenImport[];
  unusedDeps: UnusedDependency[];
  missingDeps: MissingDependency[];
  circularDeps: CircularDependency[];
}

// types/deps.ts
export interface DependencyFixResult {
  removed: string[];
  added: string[];
  aligned: { package: string; from: string; to: string }[];
  orphans: OrphanPackage[];
}
```

### constants.ts

```typescript
export const QUALITY_ENV_VARS = [
  'KB_QUALITY_CACHE_TTL',
  'KB_QUALITY_MAX_PACKAGES',
] as const;

export const QUALITY_CACHE_PREFIX = 'quality:';

export const CACHE_KEYS = {
  STATS: 'quality:stats',
  HEALTH: 'quality:health',
  IMPORTS: 'quality:imports',
} as const;

export const DEFAULT_TIMEOUTS = {
  STATS: 60000,        // 1 min
  HEALTH: 120000,      // 2 min
  FIX_DEPS: 300000,    // 5 min
} as const;
```

### package.json

```json
{
  "name": "@kb-labs/quality-contracts",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./types/*": {
      "import": "./dist/types/*.js",
      "types": "./dist/types/*.d.ts"
    },
    "./schemas/*": {
      "import": "./dist/schemas/*.js",
      "types": "./dist/schemas/*.d.ts"
    }
  },
  "dependencies": {
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@kb-labs/devkit": "workspace:*",
    "tsup": "^8.5.0",
    "typescript": "^5.9.2"
  }
}
```

---

## 📦 Package 2: quality-cli

### Назначение
Основной пакет плагина с 18 командами и бизнес-логикой.

### Структура

```
packages/quality-cli/
├── src/
│   ├── manifest.ts                # Manifest V3 (главный файл)
│   │
│   ├── cli/commands/              # 18 команд
│   │   ├── stats.ts               # kb quality:stats
│   │   ├── health.ts              # kb quality:health
│   │   ├── check-imports.ts       # kb quality:check-imports
│   │   ├── check-exports.ts       # kb quality:check-exports
│   │   ├── check-types.ts         # kb quality:check-types
│   │   ├── types-audit.ts         # kb quality:types-audit
│   │   ├── check-duplicates.ts    # kb quality:check-duplicates
│   │   ├── check-structure.ts     # kb quality:check-structure
│   │   ├── check-paths.ts         # kb quality:check-paths
│   │   ├── check-commands.ts      # kb quality:check-commands
│   │   ├── fix-deps.ts            # kb quality:fix-deps
│   │   ├── ci.ts                  # kb quality:ci
│   │   ├── build-order.ts         # kb quality:build-order
│   │   ├── types-order.ts         # kb quality:types-order
│   │   ├── visualize.ts           # kb quality:visualize
│   │   ├── sync.ts                # kb quality:sync
│   │   ├── architecture.ts        # kb quality:architecture
│   │   └── freshness.ts           # kb quality:freshness
│   │
│   └── core/                      # Бизнес-логика (портировано из DevKit)
│       ├── analyzers/
│       │   ├── package-finder.ts       # Поиск packages в монорепо
│       │   ├── stats-collector.ts      # Сбор статистики
│       │   ├── health-checker.ts       # Проверка здоровья
│       │   ├── import-analyzer.ts      # Анализ импортов
│       │   ├── export-analyzer.ts      # Анализ экспортов
│       │   ├── type-checker.ts         # Проверка типов
│       │   ├── types-auditor.ts        # Глубокий аудит типов
│       │   ├── duplicate-finder.ts     # Поиск дубликатов
│       │   ├── structure-validator.ts  # Валидация структуры
│       │   ├── path-validator.ts       # Валидация путей
│       │   ├── command-checker.ts      # Проверка команд
│       │   └── dependency-graph.ts     # Граф зависимостей
│       │
│       ├── fixers/
│       │   ├── dependency-fixer.ts     # Автофикс зависимостей
│       │   └── path-fixer.ts           # Фикс путей
│       │
│       └── runners/
│           ├── ci-runner.ts            # Запуск всех проверок
│           ├── build-order.ts          # Расчет порядка сборки
│           └── types-order.ts          # Расчет порядка типов
│
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

### manifest.ts (Главный файл)

```typescript
import {
  defineCommandFlags,
  combinePermissions,
  kbPlatformPreset
} from '@kb-labs/sdk';

const pluginPermissions = combinePermissions()
  .with(kbPlatformPreset)
  .withFs({
    mode: 'readWrite',
    allow: ['**'],  // Доступ ко всему монорепо для анализа
  })
  .withPlatform({
    cache: ['quality:'],     // Cache namespace prefix
    analytics: true,         // Трекинг использования
    logger: true,            // Структурированное логирование
  })
  .withQuotas({
    timeoutMs: 300000,      // 5 минут для длительных операций
    memoryMb: 1024,         // 1GB памяти
  })
  .build();

export const manifest = {
  schema: 'kb.plugin/3',
  id: '@kb-labs/quality',
  version: '0.1.0',

  display: {
    name: 'Quality Tools',
    description: 'Monorepo quality analysis and automated fixes',
    tags: ['quality', 'monorepo', 'analysis', 'devtools'],
  },

  platform: {
    requires: ['storage', 'cache'],
    optional: ['analytics', 'logger'],
  },

  cli: {
    commands: [
      // 1. Stats
      {
        id: 'quality:stats',
        group: 'quality',
        describe: 'Get monorepo statistics and health score',
        handler: './cli/commands/stats.js#default',
        handlerPath: './cli/commands/stats.js',
        flags: defineCommandFlags({
          json: { type: 'boolean', describe: 'Output JSON' },
          md: { type: 'boolean', describe: 'Output Markdown table' },
          health: { type: 'boolean', describe: 'Show health score' },
          refresh: { type: 'boolean', describe: 'Bypass cache' },
        }),
        examples: [
          'kb quality:stats',
          'kb quality:stats --health',
          'kb quality:stats --json',
        ],
      },

      // 2. Health Check
      {
        id: 'quality:health',
        group: 'quality',
        describe: 'Comprehensive monorepo health check',
        handler: './cli/commands/health.js#default',
        handlerPath: './cli/commands/health.js',
        flags: defineCommandFlags({
          quick: { type: 'boolean', describe: 'Skip slow build/type checks' },
          json: { type: 'boolean', describe: 'Output JSON' },
          package: { type: 'string', describe: 'Check specific package' },
        }),
        examples: [
          'kb quality:health',
          'kb quality:health --quick',
          'kb quality:health --package=core-cli',
        ],
      },

      // 3. Check Imports
      {
        id: 'quality:check-imports',
        group: 'quality',
        describe: 'Check for broken imports, unused deps, circular deps',
        handler: './cli/commands/check-imports.js#default',
        handlerPath: './cli/commands/check-imports.js',
        flags: defineCommandFlags({
          package: { type: 'string', describe: 'Check specific package' },
          verbose: { type: 'boolean', describe: 'Show all packages' },
          json: { type: 'boolean', describe: 'Output JSON' },
        }),
      },

      // 4. Check Exports
      {
        id: 'quality:check-exports',
        group: 'quality',
        describe: 'Find unused exports and dead code',
        handler: './cli/commands/check-exports.js#default',
        handlerPath: './cli/commands/check-exports.js',
        flags: defineCommandFlags({
          package: { type: 'string', describe: 'Check specific package' },
          strict: { type: 'boolean', describe: 'Include internal exports' },
          verbose: { type: 'boolean', describe: 'Show all packages' },
        }),
      },

      // 5. Fix Dependencies
      {
        id: 'quality:fix-deps',
        group: 'quality',
        describe: 'Auto-fix dependency issues',
        handler: './cli/commands/fix-deps.js#default',
        handlerPath: './cli/commands/fix-deps.js',
        flags: defineCommandFlags({
          removeUnused: { type: 'boolean', describe: 'Remove unused deps' },
          addMissing: { type: 'boolean', describe: 'Add missing workspace deps' },
          alignVersions: { type: 'boolean', describe: 'Align duplicate versions' },
          all: { type: 'boolean', describe: 'Apply all fixes' },
          dryRun: { type: 'boolean', describe: 'Show changes without applying' },
          package: { type: 'string', describe: 'Fix specific package' },
          orphans: { type: 'boolean', describe: 'Find orphan packages' },
          stats: { type: 'boolean', describe: 'Show dependency statistics' },
        }),
        examples: [
          'kb quality:fix-deps --stats',
          'kb quality:fix-deps --remove-unused --dry-run',
          'kb quality:fix-deps --all',
        ],
      },

      // 6. CI
      {
        id: 'quality:ci',
        group: 'quality',
        describe: 'Run all quality checks for CI/CD',
        handler: './cli/commands/ci.js#default',
        handlerPath: './cli/commands/ci.js',
        flags: defineCommandFlags({
          only: { type: 'string', describe: 'Run only specific checks (comma-separated)' },
          skip: { type: 'string', describe: 'Skip specific checks (comma-separated)' },
          json: { type: 'boolean', describe: 'Output JSON' },
        }),
      },

      // 7-18. Остальные команды (check-types, types-audit, check-duplicates,
      // check-structure, check-paths, check-commands, build-order, types-order,
      // visualize, sync, architecture, freshness)
    ],
  },

  permissions: pluginPermissions,
};
```

### Пример команды: stats.ts

```typescript
// packages/quality-cli/src/cli/commands/stats.ts
import { defineCommand } from '@kb-labs/sdk';
import type { StatsResult } from '@kb-labs/quality-contracts';
import { CACHE_KEYS, DEFAULT_TIMEOUTS } from '@kb-labs/quality-contracts';
import { StatsCollector } from '../../core/analyzers/stats-collector.js';

export default defineCommand({
  async handler(ctx, _argv, flags) {
    const { ui, platform, cwd } = ctx;

    // Проверяем кеш через platform.cache
    if (!flags.refresh) {
      const cached = await platform.cache?.get<StatsResult>(CACHE_KEYS.STATS);
      if (cached) {
        ui.info('Using cached results');

        if (flags.json) {
          return { ok: true, data: cached };
        }

        displayStats(ui, cached, flags);
        return { ok: true };
      }
    }

    // Собираем статистику
    const spinner = ui.spinner('Analyzing monorepo...');
    spinner.start();

    try {
      const collector = new StatsCollector(cwd);
      const stats = await collector.collect();

      spinner.stop();

      // Кешируем результат (TTL 5 минут)
      await platform.cache?.set(
        CACHE_KEYS.STATS,
        stats,
        DEFAULT_TIMEOUTS.STATS
      );

      // Аналитика через platform.analytics
      platform.analytics?.track('quality.stats.run', {
        packages: stats.overview.totalPackages,
        repositories: stats.overview.totalRepositories,
        healthScore: stats.health.score,
        healthGrade: stats.health.grade,
      });

      // Вывод через ctx.ui
      if (flags.json) {
        return { ok: true, data: stats };
      }

      if (flags.md) {
        displayStatsMarkdown(ui, stats);
      } else {
        displayStats(ui, stats, flags);
      }

      return { ok: true };

    } catch (error) {
      spinner.stop();

      ui.showError('Failed to collect statistics', error, {
        suggestions: [
          'Check that you are in a valid monorepo',
          'Ensure packages have package.json files',
        ],
      });

      return { ok: false, error };
    }
  },
});

// Используем ctx.ui для форматирования
function displayStats(ui: any, stats: StatsResult, flags: any) {
  // Success box с summary
  ui.success('📊 Monorepo Statistics', {
    summary: {
      'Packages': stats.overview.totalPackages,
      'Repositories': stats.overview.totalRepositories,
      'Files': stats.overview.totalFiles.toLocaleString(),
      'Lines of Code': stats.overview.totalLines.toLocaleString(),
      'Total Size': formatBytes(stats.overview.totalBytes),
    },
  });

  // Dependencies info
  ui.info('📦 Dependencies', {
    summary: {
      'Total': stats.dependencies.total,
      'Workspace': stats.dependencies.workspace,
      'External': stats.dependencies.external,
      'Duplicates': stats.dependencies.duplicates || 0,
    },
  });

  // Health Score
  if (flags.health) {
    const gradeColor = getGradeColor(stats.health.grade);

    ui.box(`💚 Health Score: ${stats.health.score}/100 (Grade ${stats.health.grade})`, {
      color: gradeColor,
    });

    if (stats.health.issues.length > 0) {
      ui.warning(`Found ${stats.health.issues.length} issue(s):`);

      ui.table(
        stats.health.issues.slice(0, 10),  // Top 10
        [
          { key: 'type', label: 'Type' },
          { key: 'message', label: 'Issue' },
          { key: 'severity', label: 'Severity' },
        ]
      );

      if (stats.health.issues.length > 10) {
        ui.info(`... and ${stats.health.issues.length - 10} more`);
      }
    }
  }

  // Largest packages
  if (stats.largestPackages.length > 0) {
    ui.info('📈 Largest Packages (Top 5):');

    ui.table(
      stats.largestPackages.slice(0, 5),
      [
        { key: 'name', label: 'Package' },
        { key: 'lines', label: 'Lines' },
        { key: 'size', label: 'Size', formatter: formatBytes },
      ]
    );
  }
}

function getGradeColor(grade: string): string {
  switch (grade) {
    case 'A': return 'green';
    case 'B': return 'cyan';
    case 'C': return 'yellow';
    case 'D': return 'orange';
    case 'F': return 'red';
    default: return 'gray';
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
```

### Пример команды: fix-deps.ts

```typescript
// packages/quality-cli/src/cli/commands/fix-deps.ts
import { defineCommand } from '@kb-labs/sdk';
import { DependencyFixer } from '../../core/fixers/dependency-fixer.js';

export default defineCommand({
  async handler(ctx, _argv, flags) {
    const { ui, platform, cwd } = ctx;

    const fixer = new DependencyFixer(cwd);

    // Statistics mode
    if (flags.stats) {
      const stats = await fixer.getStats();

      ui.success('📊 Dependency Statistics', {
        summary: {
          'Total packages': stats.totalPackages,
          'Total dependencies': stats.totalDeps,
          'Total devDependencies': stats.totalDevDeps,
        },
      });

      ui.info('🔝 Top 10 Most Used Dependencies:');
      ui.table(
        stats.topDeps.slice(0, 10),
        [
          { key: 'name', label: 'Dependency' },
          { key: 'count', label: 'Used in packages' },
        ]
      );

      return { ok: true };
    }

    // Orphans mode
    if (flags.orphans) {
      const orphans = await fixer.findOrphans();

      ui.info('👻 Orphan Packages Analysis:');
      ui.success('', {
        summary: {
          'Total packages': orphans.total,
          'Orphans': orphans.orphans.length,
        },
      });

      // Categorize orphans
      const categories = categorizeOrphans(orphans.orphans);

      Object.entries(categories).forEach(([category, packages]) => {
        if (packages.length > 0) {
          ui.info(`\n${category}:`);
          packages.forEach(pkg => ui.log(`  - ${pkg}`));
        }
      });

      return { ok: true };
    }

    // Fix mode
    const spinner = ui.spinner('Analyzing dependencies...');
    spinner.start();

    try {
      const issues = await fixer.analyze();

      spinner.stop();

      // Dry run
      if (flags.dryRun) {
        ui.info('🔍 Dry run - showing what would be fixed:\n');

        if (issues.unusedDeps.length > 0) {
          ui.warning(`Would remove ${issues.unusedDeps.length} unused dependencies:`);
          ui.table(
            issues.unusedDeps.slice(0, 20),
            [
              { key: 'package', label: 'Package' },
              { key: 'dep', label: 'Dependency' },
            ]
          );
        }

        if (issues.missingDeps.length > 0) {
          ui.warning(`Would add ${issues.missingDeps.length} missing dependencies:`);
          ui.table(
            issues.missingDeps.slice(0, 20),
            [
              { key: 'package', label: 'Package' },
              { key: 'dep', label: 'Dependency' },
            ]
          );
        }

        return { ok: true };
      }

      // Apply fixes
      const applySpinner = ui.spinner('Applying fixes...');
      applySpinner.start();

      const results = await fixer.fix({
        removeUnused: flags.removeUnused || flags.all,
        addMissing: flags.addMissing || flags.all,
        alignVersions: flags.alignVersions || flags.all,
      });

      applySpinner.stop();

      // Analytics
      platform.analytics?.track('quality.fix-deps.applied', {
        removed: results.removed.length,
        added: results.added.length,
        aligned: results.aligned.length,
      });

      // Success output
      ui.success('✅ Dependencies Fixed', {
        summary: {
          'Removed': results.removed.length,
          'Added': results.added.length,
          'Aligned': results.aligned.length,
        },
      });

      if (results.removed.length > 0) {
        ui.info('\n🗑️  Removed unused dependencies:');
        results.removed.slice(0, 10).forEach(dep => ui.log(`  - ${dep}`));
        if (results.removed.length > 10) {
          ui.log(`  ... and ${results.removed.length - 10} more`);
        }
      }

      return { ok: true, data: results };

    } catch (error) {
      spinner.stop();

      ui.showError('Failed to fix dependencies', error, {
        suggestions: [
          'Try with --dry-run first to preview changes',
          'Check that package.json files are valid',
        ],
      });

      return { ok: false, error };
    }
  },
});

function categorizeOrphans(orphans: string[]) {
  return {
    'CLI Entry Points': orphans.filter(p => p.includes('-cli') || p.includes('-bin')),
    'Plugin Packages': orphans.filter(p => p.includes('-plugin')),
    'External Libraries': orphans.filter(p => p.includes('-core') || p.includes('ui-')),
    'Internal Packages': orphans.filter(p =>
      !p.includes('-cli') &&
      !p.includes('-plugin') &&
      !p.includes('-core') &&
      !p.includes('ui-')
    ),
  };
}
```

### package.json

```json
{
  "name": "@kb-labs/quality-cli",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/manifest.js",
  "types": "./dist/manifest.d.ts",
  "exports": {
    ".": {
      "import": "./dist/manifest.js",
      "types": "./dist/manifest.d.ts"
    }
  },
  "dependencies": {
    "@kb-labs/sdk": "workspace:*",
    "@kb-labs/quality-contracts": "workspace:*"
  },
  "devDependencies": {
    "@kb-labs/devkit": "workspace:*",
    "tsup": "^8.5.0",
    "typescript": "^5.9.2",
    "vitest": "^3.2.4"
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit"
  }
}
```

---

## 🚀 Этапы реализации

### Этап 1: Инфраструктура (2-3 часа)

**Цель**: Создать базовую структуру и contracts

1. ✅ Создать структуру репозитория
   ```bash
   mkdir -p packages/{quality-contracts,quality-cli}/src
   ```

2. ✅ Настроить `quality-contracts`
   - Создать types/ (stats, health, imports, exports, deps, common)
   - Создать schemas/ (Zod схемы)
   - Создать constants.ts
   - Настроить package.json, tsconfig.json, tsup.config.ts

3. ✅ Настроить `quality-cli` базовую структуру
   - Создать manifest.ts (пустой, заполним позже)
   - Создать cli/commands/ директорию
   - Создать core/ директорию
   - Настроить package.json, tsconfig.json, tsup.config.ts

4. ✅ Настроить корневой package.json
   - pnpm workspace
   - Build скрипты
   - DevKit как dev dependency

**Deliverable**: Собирается, но команды пустые

---

### Этап 2: Первые 3 команды (4-5 часов)

**Цель**: Реализовать ключевые команды с полной интеграцией

#### 2.1. quality:stats

1. Портировать логику из `kb-labs-devkit/bin/devkit-stats.mjs`
2. Создать `core/analyzers/package-finder.ts`
3. Создать `core/analyzers/stats-collector.ts`
4. Реализовать `cli/commands/stats.ts` с:
   - defineCommand из SDK
   - ctx.ui для вывода
   - ctx.platform.cache для кеширования
   - ctx.platform.analytics для трекинга

#### 2.2. quality:health

1. Портировать логику из `kb-labs-devkit/bin/devkit-health.mjs`
2. Создать `core/analyzers/health-checker.ts`
3. Реализовать `cli/commands/health.ts`

#### 2.3. quality:fix-deps

1. Портировать логику из `kb-labs-devkit/bin/devkit-fix-deps.mjs`
2. Создать `core/fixers/dependency-fixer.ts`
3. Реализовать `cli/commands/fix-deps.ts`

**Deliverable**: 3 рабочие команды, можно тестировать на kb-labs

---

### Этап 3: Анализаторы (5-6 часов)

**Цель**: Добавить остальные команды анализа

Реализовать:
- `quality:check-imports` (портировать из devkit-check-imports.mjs)
- `quality:check-exports` (портировать из devkit-check-exports.mjs)
- `quality:check-types` (портировать из devkit-check-types.mjs)
- `quality:types-audit` (портировать из devkit-types-audit.mjs)
- `quality:check-duplicates` (портировать из devkit-check-duplicates.mjs)
- `quality:check-structure` (портировать из devkit-check-structure.mjs)
- `quality:check-paths` (портировать из devkit-check-paths.mjs)
- `quality:check-commands` (портировать из devkit-check-commands.mjs)

**Deliverable**: 11 команд работают

---

### Этап 4: Утилиты и CI (3-4 часа)

**Цель**: Добавить служебные команды

Реализовать:
- `quality:ci` - запуск всех проверок
- `quality:build-order` - расчет порядка сборки
- `quality:types-order` - расчет порядка типов
- `quality:visualize` - граф зависимостей
- `quality:sync` - синхронизация с DevKit
- `quality:architecture` - архитектурный анализ
- `quality:freshness` - проверка актуальности

**Deliverable**: Все 18 команд работают

---

### Этап 5: Тестирование и документация (3-4 часа)

**Цель**: Убедиться что всё работает

1. ✅ Написать README.md с примерами
2. ✅ Написать ARCHITECTURE.md
3. ✅ Создать tests/ для ключевых функций
4. ✅ Запустить на реальном kb-labs монорепо
5. ✅ Сравнить результаты с DevKit (должны совпадать)
6. ✅ Фикс багов
7. ✅ Оптимизация кеширования

**Deliverable**: Production-ready плагин

---

## 🎯 Результат

После всех этапов у нас будет:

### Что получим:

✅ **18 команд** доступных через `kb quality:*`
✅ **Полная интеграция** с KB Labs платформой
✅ **Кеширование** через State Broker
✅ **Аналитика** использования
✅ **DevKit остаётся fallback** - если платформа упала, всегда можно `npx kb-devkit-*`

### CLI команды:

```bash
# Анализ
kb quality:stats                    # Статистика
kb quality:stats --health           # + Health score
kb quality:health                   # Полная проверка
kb quality:check-imports            # Импорты
kb quality:check-exports            # Экспорты
kb quality:check-types              # Типы
kb quality:types-audit              # Глубокий аудит
kb quality:check-duplicates         # Дубликаты
kb quality:check-structure          # Структура
kb quality:check-paths              # Пути
kb quality:check-commands           # Команды

# Фиксы
kb quality:fix-deps --dry-run       # Preview
kb quality:fix-deps --remove-unused # Удалить неиспользуемые
kb quality:fix-deps --all           # Все фиксы

# Утилиты
kb quality:ci                       # Все проверки
kb quality:build-order              # Порядок сборки
kb quality:types-order              # Порядок типов
kb quality:visualize                # Граф
kb quality:sync                     # Синхронизация
```

### Что используется из платформы:

```typescript
ctx.ui.*                 // UI (таблицы, спиннеры, боксы, цвета)
ctx.platform.cache       // Кеширование результатов
ctx.platform.storage     // Хранилище данных
ctx.platform.analytics   // Аналитика использования
ctx.platform.logger      // Структурированное логирование
ctx.cwd                  // Текущая директория
```

---

## 📚 Документация

После реализации создать:

1. **README.md** - Getting started, примеры использования
2. **ARCHITECTURE.md** - Архитектура плагина
3. **CONTRIBUTING.md** - Гайд для контрибьюторов
4. **docs/examples/** - Примеры использования каждой команды
5. **docs/comparison.md** - Сравнение с DevKit

---

## ⚠️ Важные замечания

### Что НЕ делать:

❌ **Не импортировать** из `@kb-labs/core-*`, `@kb-labs/plugin-*`, etc.
❌ **Не создавать** свои UI утилиты (используй ctx.ui)
❌ **Не создавать** свой logger (используй ctx.platform.logger)
❌ **Не создавать** свой кеш (используй ctx.platform.cache)

### Что делать:

✅ **Импортируй** только из `@kb-labs/sdk` и `@kb-labs/quality-contracts`
✅ **Используй** ctx.ui.* для всего UI
✅ **Используй** ctx.platform.* для всех сервисов
✅ **Используй** defineCommand() для всех команд
✅ **Портируй** логику из DevKit, но улучшай её

---

**Готов начинать? С какого этапа стартуем?**
