# Development Docs

## Setup

```sh
git clone <repository>
cd vscode-p5server
bun install
```

`bun.lock` is the installation lockfile. The repository also retains
`package-lock.json` because VS Code's packaging tool uses npm to discover the
production dependency tree. After changing dependencies with Bun, refresh that
interoperability lockfile with
`npm install --package-lock-only --ignore-scripts`.

## Development Workflow

### Building and Testing

```sh
# Compile TypeScript
bun run compile

# Run linting
bun run lint

# Run automated tests
bun run test

# Format code
bun run format
```

### Running in Development

1. Open the project in VS Code
2. Press `F5` to launch Extension Development Host
3. Test the extension in the new VS Code window

## Testing Strategy

This extension uses a multi-layered testing approach:

### 1. Automated Tests

**Unit Tests**: Test pure functions and utilities
- Location: `src/test/suite/helpers.test.ts`
- Focus: Version comparison, file helpers, configuration utilities
- Run with: `bun run test`

**Integration Tests**: Test VS Code API integration through the official
`@vscode/test-cli` runner
- Location: `src/test/suite/commands.test.ts`, `src/test/suite/extension.test.ts`,
  `src/test/suite/fileWatchProvider.test.ts`, and
  `src/test/suite/consoleMessageProvider.test.ts`
- Focus: Command registration, activation, file-watcher behavior, console
  inlay-hint updates, diagnostic lifecycle, contribution metadata, and
  message-retention limits
- Run with: `bun run test`

**Configuration Tests**: Test settings and exclusions
- Location: `src/test/suite/configuration.test.ts`
- Focus: Default settings, exclusion patterns
- Run with: `bun run test`

### 2. Manual Testing

For full functionality testing, use the manual testing guide:

```sh
# See detailed testing procedures
open ./docs/manual-testing.md
```

**Why Manual Testing is Extensive:**

For this project, I've made a pragmatic decision to rely heavily on manual testing, since mocking out the various components ended up being complex and difficult to maintain. The following factors contribute to the difficulty of automated testing:

- **Complex UI Integration**: Tree views, status bars, and editor integration require extensive mocking
- **Browser Communication**: Testing integrated browser, external browser launching, and console message passing would require browser automation frameworks
- **File System Operations**: Creating, deleting, and converting sketches involves actual file operations that need careful mock management
- **Multi-Process Architecture**: The extension runs in VS Code's extension host, communicates with a Node.js server, and coordinates with browsers - mocking this full stack is complex
- **User Experience**: Live reload, console output formatting, and error handling ended up being difficult to mock and maintain.
- **Performance**: Server startup time and overall responsiveness were difficult to measure.

**Manual testing covers:**
- Server start/stop functionality
- Sketch creation and management
- Browser integration (integrated vs external)
- Live reload and console output
- File operations and error handling
- Performance scenarios
- Cross-platform compatibility

**When to manual test:**
- Before releases
- After significant changes to core functionality
- When automated tests don't cover UI/UX aspects
- For browser compatibility testing
- When testing multi-process communication

### 3. Testing Commands

```sh
# Run all automated tests (includes VS Code integration tests)
bun run test

# Run VS Code integration tests without rebuilding
bun run test:integration

# Run only the minimum supported VS Code test configuration
bun run test:integration:minimum

# Run only the current stable VS Code test configuration
bun run test:integration:stable

# Run only unit tests (fast, no VS Code required)
bun run test:unit

# Quick test: compile, lint, and run unit tests
bun run test:quick

# Run only specific test
bunx mocha --ui tdd out/test/suite/helpers.test.js

# Compile and test
bun run pretest

# Watch mode for development
bun run watch
```

**VS Code test setup:**

- `.vscode-test.mjs` defines minimum-supported and current-stable runs.
- Downloaded VS Code builds are cached under `.vscode-test/`.
- Each run gets separate user data while extensions, updates, telemetry, and
  workspace-trust prompts are disabled.
- The initial run can take several minutes while it downloads VS Code. Later
  runs reuse the cached application.

## Code Quality

### Linting and Formatting

```sh
# Check code style
bun run lint

# Auto-fix formatting issues
bun run format
```

### TypeScript Configuration

- Strict mode enabled for type safety
- DOM library included for browser APIs
- Source maps enabled for debugging
- TypeScript auto-detection disabled in favor of repository scripts for a consistent build process

## Architecture

### Command Organization

Commands are modularized into focused areas:

- `src/commands/sketchCommands.ts` - Creating and deleting sketches
- `src/commands/conversionCommands.ts` - Converting and manipulating sketches
- `src/commands/runCommands.ts` - Running sketches and UI operations
- `src/commands.ts` - Main registration function

### Key Components

- `src/serverManager.ts` - Manages p5-server lifecycle
- `src/tree/sketchExplorer.ts` - File tree UI and operations
- `src/console/scriptConsole.ts` - Console output integration
- `src/configuration.ts` - Settings management
- `src/statusBar.ts` - Status bar UI

### Runtime performance

- VS Code activates the extension after startup so the status-bar controls are
  visible without an extra interaction. The server, console relay, conversion
  code, and external-browser package still load on demand.
- Conversion commands, the script console, and the external-browser package
  load when first used. The server instance is created only when requested.
- The Sketch Explorer caches directory analysis. File-system events invalidate
  affected directories and coalesce refreshes.
- Live-reload watchers combine duplicate paths and overlapping directory
  coverage.
- Console output uses a `LogOutputChannel` and is batched under load. Inlay-hint
  updates are coalesced, indexed by file, and limited to a fixed number of
  source locations. Runtime errors use a `DiagnosticCollection`.
- The extension runs in the workspace extension host. Filesystem URIs preserve
  remote schemes, and browser URLs pass through VS Code's URI forwarding.

## Local Install

```sh
bun run package
code --install-extension $(ls *.vsix|tail -1)
```

## Screenshot

```sh
code ../p5-server/p5-server/examples
```

```sh
osascript <<'END'
tell application "Visual Studio Code"
    set bounds of front window to {20, 100, 870, 500}
end tell
END
```

## Publish

```sh
bun run publish
```

Note that this is not `npm publish`, which would try to publish the npm package to the npm package registry.

## Contributing

1. **Before making changes**: Run existing tests to ensure they pass
2. **During development**: Use `bun run watch` for continuous compilation
3. **Before committing**:
   - Run `bun run compile` and `bun run lint`
   - Perform relevant manual testing from `./docs/manual-testing.md`
   - Add tests for new functionality
4. **For significant changes**: Run full manual testing suite

## Debugging

### Extension Development

- Use VS Code's built-in debugging for the Extension Development Host
- Set breakpoints in TypeScript source files
- Use `console.log` for simple debugging (visible in Extension Development Host console)

### Server Issues

- Check the "P5 Sketch" output panel for server logs
- Verify p5-server package version compatibility
- Test with different browser configurations

### Common Issues

- **Commands not found**: Check command registration in `src/commands.ts`
- **Server won't start**: Verify workspace folder exists and contains appropriate files
- **Console not working**: Check browser settings and integrated browser configuration
