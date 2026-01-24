import { defineConfig } from 'tsup';
import nodePreset from '@kb-labs/devkit/tsup/node';
import { sync as globbySync } from 'globby';

// Auto-discover all command handlers
const commandHandlers = globbySync('src/cli/commands/*.ts', {
  ignore: ['**/*.d.ts', '**/flags.ts'],
});

// Auto-discover all REST handlers
const restHandlers = globbySync('src/rest/handlers/*.ts', {
  ignore: ['**/*.d.ts'],
});

export default defineConfig({
  ...nodePreset,
  tsconfig: "tsconfig.build.json",
  entry: [
    'src/index.ts',
    'src/manifest.ts',
    ...commandHandlers,
    ...restHandlers,
  ],
  external: [
    '@kb-labs/sdk',
    '@kb-labs/quality-contracts',
    '@kb-labs/quality-core',
  ],
  dts: true,
});
