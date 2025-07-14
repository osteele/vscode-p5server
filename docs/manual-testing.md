# Manual Testing Guide

This document provides step-by-step instructions for manually testing the P5 Server VS Code extension to ensure all functionality works correctly.

## Prerequisites

1. VS Code installed
2. Extension loaded in development mode (F5 from the extension development environment)
3. A test workspace folder open in VS Code
4. Basic p5.js knowledge for testing sketch functionality

## Core Functionality Tests

### 1. Extension Activation

**Test**: Extension loads properly
- [ ] Open VS Code with a folder containing `.js` files
- [ ] Verify P5.js Sketch Explorer appears in the activity bar
- [ ] Check that status bar shows "P5 Server" item
- [ ] Verify no error notifications appear

### 2. Server Management

**Test**: Server start/stop functionality
- [ ] Click "P5 Server" in status bar (should show "Click to start")
- [ ] Verify server starts successfully
- [ ] Check status bar updates to show running state with spinning icon, then solid icon
- [ ] Status bar should show "Stop the P5 server" tooltip when running
- [ ] Click to stop server
- [ ] Verify server stops and status bar updates accordingly

### 3. Sketch Creation

**Test**: Create JavaScript-only sketch
- [ ] Right-click in sketch explorer → "Create Sketch (JavaScript)"
- [ ] Enter name: `test-script`
- [ ] Verify `test-script.js` is created with basic p5.js template
- [ ] Check file opens in editor automatically

**Test**: Create HTML + JavaScript sketch
- [ ] Right-click in sketch explorer → "Create Sketch (HTML + JavaScript)"
- [ ] Enter name: `test-html`
- [ ] Verify `test-html.html` and corresponding `.js` file are created
- [ ] Check HTML file includes proper script tag reference

**Test**: Create sketch folder
- [ ] Right-click in sketch explorer → "Create Sketch (Single-Sketch Folder)"
- [ ] Enter name: `test-folder`
- [ ] Verify folder is created with `index.html` and `sketch.js`
- [ ] Check proper folder structure

### 4. Sketch Running

**Test**: Run sketch in integrated browser
- [ ] Create or open a simple p5.js sketch
- [ ] Set browser preference to "integrated" in settings
- [ ] Click run button in editor title or use "Run P5 Sketch" command
- [ ] Verify sketch opens in integrated browser pane
- [ ] Check sketch renders correctly

**Test**: Run sketch in external browser
- [ ] Set browser preference to "Chrome" (or available browser)
- [ ] Run the same sketch
- [ ] Verify sketch opens in external browser
- [ ] Test with different browser options

**Test**: Live reload
- [ ] With sketch running, modify the sketch code
- [ ] Save the file
- [ ] Verify sketch automatically reloads in browser
- [ ] Check changes are reflected

### 5. Sketch Explorer

**Test**: Tree view functionality
- [ ] Verify sketches appear in the P5.js Sketch Explorer
- [ ] Check folder structure is correctly displayed
- [ ] Verify sketch files show appropriate icons
- [ ] Test collapsing/expanding folders

**Test**: Context menu operations
- [ ] Right-click on sketch → "Run sketch"
- [ ] Right-click on sketch → "Run in integrated browser"
- [ ] Right-click on sketch → "Run in external browser"
- [ ] Right-click on sketch → "Open in editor"
- [ ] Right-click on sketch → "Rename"
- [ ] Right-click on sketch → "Duplicate"
- [ ] Right-click on sketch → "Delete"

### 6. Sketch Conversion

**Test**: Convert between formats
- [ ] Create a JavaScript-only sketch
- [ ] Right-click → "Convert to HTML + JavaScript"
- [ ] Verify HTML file is created with proper structure
- [ ] Test conversion from HTML back to script-only

### 7. Console Integration

**Test**: Console output (with integrated browser)
- [ ] Create sketch with `console.log("Hello World")`
- [ ] Run in integrated browser
- [ ] Verify "P5 Sketch" output panel opens automatically
- [ ] Check console message appears in output
- [ ] Test with different log levels (info, warn, error)

**Test**: Error handling
- [ ] Create sketch with syntax error: `let x = )`
- [ ] Run sketch
- [ ] Verify error appears in P5 Sketch output panel
- [ ] Check error shows in editor as CodeLens

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
- [ ] Create sketch using p5.sound: `let sound = loadSound('audio.mp3')`
- [ ] Run sketch
- [ ] Check browser developer tools → Network tab
- [ ] Verify p5.sound.min.js is automatically loaded

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

### High-Frequency Console Output
- [ ] Create sketch with rapid console output:
  ```javascript
  function draw() {
    console.log(frameCount);
  }
  ```
- [ ] Run sketch and verify console handles high message volume
- [ ] Check that VS Code remains responsive

### Multiple Sketches
- [ ] Open multiple sketches simultaneously
- [ ] Verify each runs independently
- [ ] Test switching between running sketches

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