import * as path from 'path';

import { runTests, downloadAndUnzipVSCode } from 'vscode-test';

async function main() {
  try {
    // Set environment variables for test isolation
    process.env.CI = 'true';
    process.env.VSCODE_SKIP_PRELAUNCH = 'true';
    process.env.ELECTRON_ENABLE_LOGGING = 'false';
    process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');

    // The path to test runner
    // Passed to --extensionTestsPath
    const extensionTestsPath = path.resolve(__dirname, './suite/index');

    // Download VS Code if not cached, with specific version for consistency
    // Use the correct platform for Apple Silicon Macs
    const platform = process.platform === 'darwin' && process.arch === 'arm64' ? 'darwin-arm64' : undefined;
    const vscodeExecutablePath = await downloadAndUnzipVSCode('1.102.0', platform);

    // Run the integration test with optimized settings
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      vscodeExecutablePath,
      // Optimized launch args for fast, reliable testing
      launchArgs: [
        '--disable-extensions',
        '--disable-workspace-trust',
        '--no-sandbox',
        '--disable-updates',
        '--skip-welcome',
        '--disable-telemetry',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--enable-logging=stderr',
        '--log-level=0',
      ],
    });
  } catch (err) {
    console.error('Failed to run tests:', err);
    process.exit(1);
  }
}

main();
