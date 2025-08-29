# Manual Testing Guide

This document provides step-by-step instructions for manually testing the P5 Server VS Code extension to ensure all functionality works correctly.

## Prerequisites

1. VS Code installed
2. Extension loaded in development mode:
   - Open the extension project in VS Code: `code /path/to/vscode-p5server`
   - Press F5 to launch Extension Development Host
   - This opens a new VS Code window with the extension loaded
3. Test workspace ready: In the Extension Development Host window, open the test workspace:
   - File → Open Folder → Navigate to `test-workspaces` folder within the extension directory

## Core Functionality Tests

### 1. Extension Activation

**Test**: Extension loads properly
- [ ] Open VS Code with the `test-workspaces/basic-sketches` folder
- [ ] Verify P5.js Sketch Explorer appears in the activity bar
- [ ] Check that status bar shows "P5 Server" item (bottom-left area)
- [ ] Verify no error notifications appear
- [ ] In the P5.js Sketch Explorer, you should see:
  - `interactive-sketch.js`
  - `particle-system.js`
  - `simple-circle.js`

### 2. Server Management

**Test**: Server start/stop functionality
- [ ] Click "P5 Server" in status bar (should show "Click to start")
- [ ] Verify server starts successfully
- [ ] Check status bar updates to show running state with spinning icon, then solid icon
- [ ] Status bar should show "Stop the P5 server" tooltip when running
- [ ] Click to stop server
- [ ] Verify server stops and status bar updates accordingly

### 3. Sketch Creation

**Important**: First click on "P5.JS SKETCH EXPLORER" in the Activity Bar or Side Bar to ensure you're in the P5.js Sketch Explorer view, not the regular File Explorer.

**Test**: Create JavaScript-only sketch
- [ ] Click on the P5.JS SKETCH EXPLORER view to activate it
- [ ] Navigate to the `basic-sketches` folder in the tree
- [ ] Click the "+" icon in the P5.JS SKETCH EXPLORER title bar (top of the view)
- [ ] Or use Command Palette: "P5 Server: Create Sketch (JavaScript)"
- [ ] Enter name: `my-new-sketch`
- [ ] Verify `my-new-sketch.js` is created with basic p5.js template
- [ ] Check file opens in editor automatically
- [ ] Should contain setup() and draw() functions

**Test**: Create HTML + JavaScript sketch
- [ ] In the P5.JS SKETCH EXPLORER view
- [ ] Navigate to `html-sketches` folder
- [ ] Click the ellipsis (...) in the title bar and select "Create Sketch (HTML + JavaScript)"
- [ ] Or use Command Palette: "P5 Server: Create Sketch (HTML + JavaScript)"
- [ ] Enter name: `my-html-sketch`
- [ ] Verify `my-html-sketch.html` and corresponding `.js` file are created
- [ ] Check HTML file includes proper script tag reference
- [ ] Compare with existing `bouncing-ball.html` for reference

**Test**: Create sketch folder
- [ ] In the P5.JS SKETCH EXPLORER view
- [ ] Navigate to `folder-sketches` folder
- [ ] Click the ellipsis (...) in the title bar and select "Create Sketch (Single-Sketch Folder)"
- [ ] Or use Command Palette: "P5 Server: Create Sketch (Single-Sketch Folder)"
- [ ] Enter name: `my-folder-sketch`
- [ ] Verify folder is created with `index.html` and `sketch.js`
- [ ] Check structure matches `game-project` folder

### 4. Sketch Running

**Test**: Run sketch in integrated browser
- [ ] Open `test-workspaces/basic-sketches/simple-circle.js`
- [ ] Set browser preference to "integrated" in settings (Cmd/Ctrl+, then search for "p5-server.browser")
- [ ] Use one of these methods to run:
  - Command Palette (Cmd/Ctrl+Shift+P): "P5 Server: Run Sketch"
  - Right-click the file in P5.JS SKETCH EXPLORER → "Run sketch"
  - Play button in editor title (if visible - may be overridden by other extensions)
- [ ] Verify sketch opens in integrated browser pane on the right
- [ ] Check that a red circle moves across the screen
- [ ] Console should show "Simple circle sketch started"

**Note**: If the play button runs Node.js instead of opening the sketch, it's being handled by another extension (like Code Runner). Use the P5 Server commands instead.

**Test**: Run sketch in external browser
- [ ] Open `test-workspaces/basic-sketches/interactive-sketch.js`
- [ ] Set browser preference to "Chrome" (or your available browser) in settings
- [ ] Use one of these methods to run:
  - Command Palette: "P5 Server: Run Sketch" (will use your browser preference)
  - Command Palette: "P5 Server: Run Sketch in Browser" (forces external browser)
  - Right-click in P5.JS SKETCH EXPLORER → "Run in external browser"
- [ ] Verify sketch opens in Chrome (or your chosen browser)
- [ ] Move your mouse - circles should follow the cursor
- [ ] Click to see console messages with coordinates

**Test**: Live reload
- [ ] Keep `simple-circle.js` running
- [ ] Change `fill(255, 0, 0)` to `fill(0, 255, 0)` (red to green)
- [ ] Save the file (Cmd/Ctrl+S)
- [ ] Verify sketch automatically reloads
- [ ] Circle should now be green

### 5. Sketch Explorer

**Test**: Tree view functionality
- [ ] Open `test-workspaces/nested-projects` folder
- [ ] Verify P5.js Sketch Explorer shows:
  - `project-a/main-sketch.js`
  - `project-b/sketches/sketch1.js`
  - `project-b/experiments/test.js`
- [ ] Check folder structure is correctly displayed with indentation
- [ ] Verify sketch files show p5 icons
- [ ] Test collapsing/expanding `project-b` folder

**Test**: Context menu operations
- [ ] Right-click on `basic-sketches/particle-system.js`:
  - [ ] "Run sketch" - runs with default browser setting
  - [ ] "Run in integrated browser" - forces integrated view
  - [ ] "Run in external browser" - forces external browser
  - [ ] "Open in editor" - opens file for editing
  - [ ] "Rename" - test renaming to `particles-renamed.js`
  - [ ] "Duplicate" - creates `particle-system copy.js`
  - [ ] "Delete" - shows confirmation, then deletes (test on duplicate)

### 6. Sketch Conversion

**Test**: Convert between formats
- [ ] Open `test-workspaces/basic-sketches` folder
- [ ] Right-click on `simple-circle.js` → "Convert to HTML + JavaScript"
- [ ] Verify `simple-circle.html` is created alongside the JS file
- [ ] Check HTML contains proper p5.js CDN links and script reference
- [ ] Open `test-workspaces/html-sketches` folder
- [ ] Right-click on `bouncing-ball.html` → "Convert to Script-Only"
- [ ] Verify it creates a standalone JS file without the HTML

### 7. Console Integration

> **⚠️ Known Issue**: Console output is not currently working. The WebSocket connection for console message relay is not being established. See [GitHub Issue #7](https://github.com/osteele/vscode-p5server/issues/7) for details. The following tests will currently fail:

**Test**: Console output (with integrated browser) **[CURRENTLY FAILING]**
- [ ] Open `test-workspaces/error-examples/console-spam.js`
- [ ] Run in integrated browser using Command Palette: "P5 Server: Run Sketch"
- [ ] The "P5 Sketch" output panel should appear when console messages start
  - If it doesn't appear automatically, open it manually: View → Output → Select "P5 Sketch" from dropdown
- [ ] Check console messages appear with different levels:
  - Regular logs (every 5 frames)
  - Info messages (📊 icon)
  - Warnings (⚠️ icon)
  - Errors (❌ icon)
- [ ] Click in the sketch - verify burst messages appear
- [ ] Note: Console output now works with the integrated browser using a custom webview
- [ ] Note: Messages may be batched during high-frequency output (>20 msg/sec) for performance

**Test**: Error handling **[PARTIALLY FAILING]**
- [ ] Open `test-workspaces/error-examples/syntax-error.js`
- [ ] Note the syntax error on line 7 (missing closing parenthesis)
- [ ] Try to run sketch
- [ ] ~~Verify error appears in P5 Sketch output panel~~ *(Errors do not appear in panel)*
- [ ] ~~Check error location is highlighted in the editor~~ *(May not work without console relay)*
- [ ] Open `test-workspaces/error-examples/runtime-error.js`
- [ ] Run the sketch
- [ ] ~~Wait for runtime errors to appear (every 60 frames)~~ *(Errors only visible in browser console)*
- [ ] ~~Click to trigger additional error~~ *(Error occurs but not shown in VS Code)*

**Workaround**: Use the browser's developer console (F12 or right-click → Inspect) to view console output and errors until this issue is resolved.

### 8. Configuration

**Test**: Settings integration
- [ ] Open P5 Server settings (Command Palette → "P5 Server: Open Settings")
- [ ] Modify browser setting
- [ ] Test that changes take effect
- [ ] Verify status bar updates accordingly

**Test**: Status bar configuration
- [ ] Disable "P5 Server > Status Bar: Server Item Enabled"
- [ ] Verify server status bar item is hidden
- [ ] Re-enable and verify it reappears

### 9. Library Detection

**Test**: Automatic library inclusion
- [ ] Create a new sketch in `test-workspaces/basic-sketches`:
  ```javascript
  let osc;
  function setup() {
    osc = new p5.Oscillator();
    osc.setType('sine');
    osc.freq(440);
  }
  ```
- [ ] Run sketch
- [ ] Open browser developer tools (F12) → Network tab
- [ ] Verify p5.sound.min.js is automatically loaded from CDN
- [ ] The sketch explorer should show "p5.sound" under Libraries

### 10. File Operations

**Test**: File manipulation
- [ ] Create multiple sketches
- [ ] Test renaming sketches
- [ ] Test duplicating sketches
- [ ] Test deleting sketches with confirmation dialog
- [ ] Verify file system changes are reflected properly

## Error Scenarios

### Network Issues
- [ ] Start server, then manually kill the process
- [ ] Verify extension handles server disconnect gracefully
- [ ] Test server restart functionality

### File System Issues
- [ ] Try creating sketch with invalid name (special characters)
- [ ] Verify appropriate error messages
- [ ] Test behavior with read-only directories

### Browser Issues
- [ ] Set browser to non-existent application
- [ ] Verify fallback to system default browser
- [ ] Check error messaging

## Performance Tests

### High-Frequency Console Output **[CURRENTLY FAILING]**
> **Note**: This test depends on console output working. See Known Issue above.
- [ ] Open `test-workspaces/error-examples/console-spam.js`
- [ ] Run the sketch
- [ ] ~~Watch the message counter increase rapidly~~ *(Console output not working)*
- [ ] ~~Click and hold to generate burst messages~~ *(Messages generated but not visible in VS Code)*
- [ ] Verify VS Code remains responsive *(Can still be tested)*
- [ ] ~~Check that console batches messages efficiently~~ *(Cannot test without console output)*

### Multiple Sketches
- [ ] Open `test-workspaces` root folder
- [ ] Run `basic-sketches/simple-circle.js` in integrated browser
- [ ] Run `html-sketches/bouncing-ball.html` in another tab
- [ ] Run `folder-sketches/game-project/index.html` 
- [ ] Verify each runs independently in separate tabs/windows
- [ ] Test switching between running sketches
- [ ] ~~Console output should be sketch-specific~~ *(Console output not working - see Known Issue)*

## Clean-up

After testing:
- [ ] Stop any running servers
- [ ] Close test sketches
- [ ] Delete test files created during testing
- [ ] Reset any modified settings

## Reporting Issues

When you find issues during manual testing:

1. **Document the issue**: Include steps to reproduce, expected vs actual behavior
2. **Check browser console**: Include any JavaScript errors
3. **Check VS Code Developer Console**: Help → Toggle Developer Tools
4. **Include environment details**: OS, VS Code version, browser version
5. **Test in different environments**: Different browsers, OS, etc.

## Test Results Template

```
## Manual Testing Results - [Date]

**Environment:**
- OS: 
- VS Code Version: 
- Browser: 

**Test Results:**
- [ ] Extension Activation: PASS/FAIL
- [ ] Server Management: PASS/FAIL  
- [ ] Sketch Creation: PASS/FAIL
- [ ] Sketch Running: PASS/FAIL
- [ ] Sketch Explorer: PASS/FAIL
- [ ] Console Integration: PASS/FAIL
- [ ] Configuration: PASS/FAIL
- [ ] Library Detection: PASS/FAIL
- [ ] File Operations: PASS/FAIL

**Issues Found:**
1. [Issue description]
2. [Issue description]

**Notes:**
[Any additional observations]
```