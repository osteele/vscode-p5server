# Development Docs

## Setup

```sh
git clone <repository>
cd vscode-p5server
npm install
```

## Development Workflow

### Building and Testing

```sh
# Compile TypeScript
npm run compile

# Run linting
npm run lint

# Run automated tests
npm run test

# Format code
npm run format
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
- Run with: `npm run test`

**Integration Tests**: Test VS Code API integration
- Location: `src/test/suite/commands.test.ts`, `src/test/suite/extension.test.ts`
- Focus: Command registration, extension activation
- Run with: `npm run test`

**Configuration Tests**: Test settings and exclusions
- Location: `src/test/suite/configuration.test.ts`
- Focus: Default settings, exclusion patterns
- Run with: `npm run test`

### 2. Manual Testing

For comprehensive functionality testing, use the manual testing guide:

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
npm run test

# Run only unit tests (fast, no VS Code required)
npm run test:unit

# Quick test: compile, lint, and run unit tests
npm run test:quick

# Run only specific test
npx mocha --ui tdd out/test/suite/helpers.test.js

# Compile and test
npm run pretest

# Watch mode for development
npm run watch
```

**VS Code Test Optimizations:**
- **Caching**: VS Code test instance cached in `.vscode-test/` directory
- **Platform Detection**: Automatically downloads ARM64 version on Apple Silicon Macs
- **Shell Isolation**: Tests bypass shell environment resolution for reliability
- **Performance Flags**: Disabled GPU, extensions, telemetry for faster startup
- **Environment**: Sets `CI=true` and other variables for consistent behavior
- **Timeout**: 4-minute timeout accommodates initial ARM64 download
- **Reliability**: Independent of developer's shell configuration and CPU architecture

## Code Quality

### Linting and Formatting

```sh
# Check code style
npm run lint

# Auto-fix formatting issues
npm run format
```

### TypeScript Configuration

- Strict mode enabled for type safety
- DOM library included for browser APIs
- Source maps enabled for debugging
- TypeScript auto-detection disabled in favor of npm scripts for consistent build process

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

## Local Install

```sh
npm run package
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
npm run publish
```

Note that this is not `npm publish`, which would try to publish the npm package to the npm package registry.

## Contributing

1. **Before making changes**: Run existing tests to ensure they pass
2. **During development**: Use `npm run watch` for continuous compilation
3. **Before committing**:
   - Run `npm run compile` and `npm run lint`
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
