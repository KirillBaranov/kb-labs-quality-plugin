# Quality Plugin

Monorepo quality analysis, health checks, and automated fixes for KB Labs platform.

## Commands

### 📊 Statistics & Health

**`quality:stats`** - Monorepo statistics and health score
```bash
kb quality:stats                 # View statistics
kb quality:stats --health        # Include health score
kb quality:stats --json          # JSON output
kb quality:stats --md            # Markdown table
```

**`quality:health`** - Comprehensive health check with grading (A-F)
```bash
kb quality:health                          # Full health check
kb quality:health --detailed               # Detailed breakdown
kb quality:health -p @kb-labs/core         # Specific package
kb quality:health --json                   # JSON output
```

### 🔧 Dependency Management

**`quality:fix-deps`** - Auto-fix dependency issues
```bash
kb quality:fix-deps --stats                # Show statistics
kb quality:fix-deps --remove-unused --dry-run  # Preview unused deps removal
kb quality:fix-deps --align-versions       # Align duplicate versions
kb quality:fix-deps --all --dry-run        # Preview all fixes
kb quality:fix-deps --all                  # Apply all fixes
```

### 📦 Build Order & Dependencies

**`quality:build-order`** - Calculate build order with topological sort
```bash
kb quality:build-order                     # Show sequential order
kb quality:build-order --layers            # Show parallel build layers
kb quality:build-order -p @kb-labs/core    # For specific package
kb quality:build-order --script > build.sh # Generate bash script
```

**`quality:cycles`** - Detect circular dependencies
```bash
kb quality:cycles                          # Find all cycles
kb quality:cycles --json                   # JSON output
```

**`quality:visualize`** - Visualize dependency graph
```bash
kb quality:visualize --stats                        # Graph statistics
kb quality:visualize --tree -p @kb-labs/core       # Dependency tree
kb quality:visualize --reverse -p @kb-labs/sdk     # Who depends on this
kb quality:visualize --impact -p @kb-labs/core     # Impact analysis
kb quality:visualize --dot > deps.dot              # DOT for graphviz
```

## Features

- ✅ **Health Scoring**: A-F grade based on dependency health, structure, and types
- ✅ **Dependency Analysis**: Duplicates, unused, missing workspace dependencies
- ✅ **Auto-Fixes**: Remove unused, add missing, align versions (with --dry-run)
- ✅ **Build Order**: Topological sort with parallel build layers
- ✅ **Circular Detection**: DFS-based cycle detection with recommendations
- ✅ **Dependency Graph**: Tree view, reverse deps, impact analysis, DOT export
- ✅ **Caching**: 5-minute cache for expensive operations
- ✅ **Analytics**: Track command usage and health trends

## Architecture

### Packages

- **quality-cli**: CLI commands and handlers
- **quality-contracts**: Type-safe contracts, schemas, constants

### Key Modules

- **dependency-graph.ts**: Topological sort, cycle detection, impact analysis
- **flags.ts**: Centralized flag definitions (DRY)
- **stats.ts**, **health.ts**, **fix-deps.ts**: Core functionality
- **build-order.ts**, **cycles.ts**, **visualize.ts**: Dependency analysis

### Build System

Uses `globby` for automatic command handler discovery:
```typescript
// tsup.config.ts auto-discovers all src/cli/commands/*.ts
const commandHandlers = globbySync('src/cli/commands/*.ts');
```

## Development

```bash
# Build
pnpm run build

# Watch mode
pnpm run dev

# Type check
pnpm run type-check

# Test
pnpm run test
```

## License

MIT
