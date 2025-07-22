# Test Workspaces for P5 Server Extension

This directory contains test projects for manual testing of the P5 Server VS Code extension. These files are not distributed with the extension.

## Directory Structure

### basic-sketches/
Simple standalone p5.js sketch files for basic testing:
- `simple-circle.js` - Basic animation
- `interactive-sketch.js` - Mouse interaction
- `particle-system.js` - More complex example with classes

### html-sketches/
HTML + JavaScript sketch combinations:
- `bouncing-ball.html/js` - Simple game with HTML container
- `custom-style.html/js` - Styled page with interactive controls

### folder-sketches/
Multi-file sketch projects:
- `game-project/` - Simple game split across multiple files

### error-examples/
Sketches that intentionally produce errors for console testing:
- `syntax-error.js` - Contains syntax errors
- `runtime-error.js` - Generates runtime errors
- `console-spam.js` - Produces many console messages

### nested-projects/
Complex folder structure for testing the tree view:
- Multiple nested directories
- Sketches at different levels
- Archive folders

### performance-test/
Large sketches for performance testing (if needed)

## Usage

1. Open VS Code
2. File → Open Folder → Select `test-workspaces` or a subdirectory
3. Follow the steps in MANUAL_TESTING.md using these specific files