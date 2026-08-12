import { defineConfig } from '@vscode/test-cli';
import path from 'node:path';

const shared = {
  files: 'out/test/suite/**/*.test.js',
  workspaceFolder: './test-workspaces',
  launchArgs: [
    '--disable-extensions',
    '--disable-workspace-trust',
    '--disable-updates',
    '--skip-welcome',
    '--disable-telemetry',
  ],
  mocha: {
    ui: 'tdd',
    timeout: 20_000,
  },
};

export default defineConfig([
  {
    ...shared,
    label: 'minimum',
    version: '1.115.0',
    launchArgs: [...shared.launchArgs, '--user-data-dir', path.resolve('.vscode-test/user-data-minimum')],
  },
  {
    ...shared,
    label: 'stable',
    version: 'stable',
    launchArgs: [...shared.launchArgs, '--user-data-dir', path.resolve('.vscode-test/user-data-stable')],
  },
]);
