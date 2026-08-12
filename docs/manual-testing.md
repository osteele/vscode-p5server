# Manual Testing Guide

Use this checklist to test the P5 Server extension in a VS Code Extension
Development Host. Several tests create, rename, modify, and delete files. Run
them in a disposable copy of `test-workspaces`, not in the repository copy.

## Setup

1. Install the project dependencies and open this repository in VS Code.
2. Press F5 and select the **Run Extension** launch configuration. The launch
   task compiles the extension before opening an Extension Development Host.
3. Make a disposable copy of `test-workspaces` outside the repository.
4. In the Extension Development Host, choose **File > Open Folder** and open the
   copied `test-workspaces` directory.
5. Record the current P5 Server settings so that you can restore them after the
   test. Use these values unless a test says otherwise:

   - `p5-server.browser`: `integrated`
   - `p5-server.console.clearOnReload`: `true`
   - `p5-server.console.integratedBrowser.autoShow.level`: `always`
   - `p5-server.editor.infoLens`: `true`
   - `p5-server.explorer.autoReveal`: `true`
   - `p5-server.explorer.autoRunSketchOnSide`: `true`
   - `p5-server.editorTitle.RunIcon.enabled`: `true`
   - `p5-server.statusBar.browserItem.enabled`: `true`
   - `p5-server.statusBar.serverItem.enabled`: `true`

## Core Functionality

### 1. Extension activation

- [ ] Confirm that the P5.js Sketch Explorer icon appears in the Activity Bar.
- [ ] Open the explorer and confirm that its view is named **Sketches**.
- [ ] Confirm that the top level contains `basic-sketches`, `error-examples`,
      `folder-sketches`, `html-sketches`, and `nested-projects`.
- [ ] Expand `basic-sketches` and confirm that it contains these sketches:

  - `interactive sketch`
  - `particle system`
  - `simple circle`

- [ ] Confirm that **P5 Server** appears on the right side of the status bar.
- [ ] Confirm that no error notification appears during activation or scanning.

### 2. Server management

- [ ] Hover over **P5 Server** and confirm that its tooltip says **Click to start
      the P5 server**.
- [ ] Click **P5 Server**. Confirm that the icon spins while the server starts.
- [ ] Confirm that the server's directory listing opens in the integrated
      browser.
- [ ] Confirm that the running server uses a solid icon and its tooltip says
      **Stop the P5 server**.
- [ ] Confirm that the **P5 Browser** status-bar item appears while the server is
      running and reopens the server page when clicked.
- [ ] Click **P5 Server** again. Confirm that the icon spins while the server
      stops, then returns to its stopped state.
- [ ] Confirm that **P5 Browser** is hidden after the server stops.

### 3. Sketch creation

Select a destination in the P5.js Sketch Explorer before using a command from
the view title. The commands create files relative to that selection.

#### JavaScript sketch

- [ ] Select `basic-sketches` in the P5.js Sketch Explorer.
- [ ] Click the **Create Sketch (JavaScript)** button in the view title, or run
      **Create Sketch (JavaScript)** from the Command Palette.
- [ ] Enter `my-new-sketch`.
- [ ] Confirm that `basic-sketches/my-new-sketch.js` is created and opens in the
      editor.
- [ ] Confirm that the generated file defines `setup()` and `draw()`.
- [ ] Confirm that `my new sketch` appears in the P5.js Sketch Explorer without
      a manual refresh.

#### HTML and JavaScript sketch

- [ ] Select `html-sketches` in the P5.js Sketch Explorer.
- [ ] Open the view's **...** menu and choose **Create Sketch (HTML +
      JavaScript)**.
- [ ] Enter `my-html-sketch`.
- [ ] Confirm that `html-sketches/my-html-sketch.html` and
      `html-sketches/sketch.js` are created.
- [ ] Confirm that `my-html-sketch.html` loads p5.js and refers to `sketch.js`.
- [ ] Confirm that `sketch.js` opens in the editor.

If `sketch.js` already exists, the command chooses an unused script name based
on the sketch name. The expected `sketch.js` name above assumes a fresh copy of
the fixtures.

#### Single-sketch folder

- [ ] Select `folder-sketches` in the P5.js Sketch Explorer.
- [ ] Open the view's **...** menu and choose **Create Sketch (Single-Sketch
      Folder)**.
- [ ] Enter `my-folder-sketch`.
- [ ] Confirm that `folder-sketches/my-folder-sketch` contains `index.html` and
      `sketch.js`.
- [ ] Confirm that `index.html` refers to `sketch.js` and `sketch.js` opens in
      the editor.

### 4. Running sketches

#### Integrated browser

- [ ] Set `p5-server.browser` to `integrated`.
- [ ] Open `basic-sketches/simple-circle.js`.
- [ ] Run **Run P5 Sketch (in Browser or Sidebar)** from the Command Palette.
- [ ] Confirm that the sketch opens beside the editor in VS Code.
- [ ] Confirm that a red circle moves across the canvas.
- [ ] Confirm that `[LOG] Simple circle sketch started` appears in the **P5
      Sketch** output channel.
- [ ] Right-click `simple circle` in the P5.js Sketch Explorer and choose **Run
      in integrated browser**. Confirm that the same sketch opens.
- [ ] Confirm that the editor-title run icon uses the integrated browser while
      `p5-server.browser` is `integrated`.

Another extension can contribute a different editor-title play button. When a
button runs the file with Node.js, use the P5 Server command or the P5.js Sketch
Explorer context menu.

#### External browser

- [ ] Set `p5-server.browser` to `system`, or choose an installed named browser.
- [ ] Open `basic-sketches/interactive-sketch.js`.
- [ ] Run **Run P5 Sketch in Browser** from the Command Palette.
- [ ] Confirm that the sketch opens in the selected external browser.
- [ ] Move the pointer and confirm that circles follow it.
- [ ] Click the canvas and confirm that the click coordinates appear in the
      **P5 Sketch** output channel.
- [ ] Right-click `interactive sketch` and choose **Run in external browser**.
      Confirm that this forces an external browser even when
      `p5-server.browser` is later restored to `integrated`.

### 5. Live reload and file watching

#### Main sketch file

- [ ] Set `p5-server.browser` to `integrated` and run
      `basic-sketches/simple-circle.js`.
- [ ] Change `fill(255, 0, 0)` to `fill(0, 0, 255)` and save the file.
- [ ] Confirm that the browser reloads without restarting the server and the
      circle becomes blue.
- [ ] Restore `fill(255, 0, 0)` and save. Confirm that the circle becomes red.

#### File within a multi-file sketch

- [ ] Run `folder-sketches/game-project/index.html`.
- [ ] In `folder-sketches/game-project/player.js`, change
      `fill(0, 255, 0)` to `fill(0, 0, 255)` and save.
- [ ] Confirm that the browser reloads and the player circle becomes blue.
- [ ] Restore `fill(0, 255, 0)` and save. Confirm that the player becomes green.

#### Created, renamed, and deleted files

- [ ] Click **P5 Browser** to open the server's top-level directory listing.
- [ ] Create `watcher-created.js` at the workspace root with this content and
      save it:

  ```javascript
  function setup() {
    createCanvas(100, 100);
  }

  function draw() {
    background(220);
  }
  ```

- [ ] Confirm that the directory listing reloads and shows `watcher created`.
- [ ] Rename the file to `watcher-renamed.js` in VS Code.
- [ ] Confirm that the directory listing reloads and shows `watcher renamed`
      instead of `watcher created`.
- [ ] Delete `watcher-renamed.js` in VS Code.
- [ ] Confirm that the directory listing reloads and removes the sketch.
- [ ] Confirm that all four event types above work without restarting the P5
      server: file change, file creation, rename, and deletion.

### 6. Sketch Explorer

#### Tree structure and auto-reveal

- [ ] Expand `nested-projects` and confirm this hierarchy:

  - `project-a` contains `main sketch`.
  - `project-b/experiments` contains `test`.
  - `project-b/sketches` contains `sketch1`.

- [ ] Collapse and expand `project-b` and confirm that its children remain
      correctly nested.
- [ ] Open `nested-projects/project-b/sketches/sketch1.js` from the File
      Explorer. Confirm that the P5.js Sketch Explorer reveals and selects it.
- [ ] Set `p5-server.explorer.autoReveal` to `false`, open
      `nested-projects/project-a/main-sketch.js`, and confirm that the P5.js
      Sketch Explorer does not change its selection.
- [ ] Restore `p5-server.explorer.autoReveal` to `true`.

#### Context menu operations

- [ ] Right-click `particle system` under `basic-sketches` and confirm that the
      menu contains **Open in editor**, **Run sketch**, **Run in integrated
      browser**, **Run in external browser**, **Convert to HTML + JavaScript**,
      **Duplicate**, **Delete**, and **Rename**.
- [ ] Choose **Duplicate**, accept the default name `particle system-2`, and
      confirm that `particle system-2.js` appears.
- [ ] Rename `particle system-2` to `particles-renamed` and confirm that the file
      becomes `particles-renamed.js` and the explorer label becomes
      `particles renamed`.
- [ ] Delete `particles renamed`, choose **Cancel**, and confirm that the file
      remains.
- [ ] Delete it again, choose **Delete**, and confirm that the file is removed.
- [ ] Confirm that each change appears without using **p5.js Explorer: Refresh**.

### 7. Sketch conversion

- [ ] Right-click `simple circle` under `basic-sketches` and choose **Convert to
      HTML + JavaScript**.
- [ ] Confirm that `basic-sketches/simple-circle.html` is created alongside
      `simple-circle.js` and refers to that script.
- [ ] Confirm that the explorer now represents the files as one HTML sketch.
- [ ] Right-click `html-sketches/bouncing-ball` and choose **Convert to
      Script-Only**.
- [ ] Confirm that `bouncing-ball.html` is deleted and `bouncing-ball.js`
      remains.
- [ ] Confirm that the explorer now represents `bouncing-ball.js` as a
      JavaScript-only sketch.

### 8. Console and error reporting

#### Console output and auto-show behavior

- [ ] Set `p5-server.browser` to `integrated` and
      `p5-server.console.integratedBrowser.autoShow.level` to `always`.
- [ ] Run `error-examples/console-spam.js`.
- [ ] Confirm that the **P5 Sketch** output channel opens automatically.
- [ ] Confirm that `[LOG]`, `[INFO]`, `[WARN]`, and `[ERROR]` messages appear.
- [ ] Hold the pointer button over the sketch. Confirm that burst messages
      continue to appear and VS Code remains responsive.
- [ ] Open `console-spam.js` in the editor and confirm that console messages also
      appear as CodeLens text above the corresponding source lines.
- [ ] Set `p5-server.console.integratedBrowser.autoShow.level` to `never` and
      close the output panel.
- [ ] Reload the sketch and confirm that new messages do not reopen the panel.
- [ ] Run **P5 Server: Show Script Output** and confirm that the buffered
      messages are present.
- [ ] Restore the auto-show setting to `always`.

#### Reload behavior

- [ ] Set `p5-server.console.clearOnReload` to `true`, save
      `console-spam.js`, and confirm that earlier output is cleared after the
      reload.
- [ ] Set `p5-server.console.clearOnReload` to `false`, save again, and confirm
      that earlier output remains with a `[RELOAD]` separator.
- [ ] Restore `p5-server.console.clearOnReload` to `true`.

#### Syntax and runtime errors

- [ ] Run `error-examples/syntax-error.js`.
- [ ] Confirm that the browser page displays the syntax error, file, line,
      column, and nearby source text.
- [ ] Confirm that the syntax error is also reported in the **P5 Sketch** output
      channel.
- [ ] Run `error-examples/runtime-error.js`.
- [ ] Wait for the error generated every 60 frames. Confirm that it appears in
      the output channel.
- [ ] Click the sketch and confirm that the additional runtime error appears.
- [ ] Open `runtime-error.js` and confirm that runtime errors appear as CodeLens
      text at the corresponding source lines.
- [ ] Set `p5-server.editor.infoLens` to `false` and confirm that the CodeLens
      messages disappear while output-channel messages remain available.
- [ ] Restore `p5-server.editor.infoLens` to `true`.

### 9. Settings and UI contributions

- [ ] Run **P5 Server: Open Settings** and confirm that the Settings editor is
      filtered to P5 Server settings.
- [ ] Change `p5-server.browser` between `integrated` and `system`. Confirm that
      the editor-title run command changes between **Run P5 Sketch in Sidebar**
      and **Run P5 Sketch in Browser**.
- [ ] Set `p5-server.editorTitle.RunIcon.enabled` to `false` and confirm that the
      P5 run icon is hidden from JavaScript and HTML editor titles. Restore it to
      `true`.
- [ ] Set `p5-server.statusBar.serverItem.enabled` to `false` and confirm that
      **P5 Server** is hidden. Restore it to `true`.
- [ ] Start the server, set `p5-server.statusBar.browserItem.enabled` to `false`,
      and confirm that **P5 Browser** is hidden. Restore it to `true`.
- [ ] Set `p5-server.explorer.autoRunSketchOnSide` to `true` and click a sketch
      in the P5.js Sketch Explorer. Confirm that its source opens on the left and
      the sketch runs on the right.
- [ ] Set `p5-server.explorer.autoRunSketchOnSide` to `false` and click another
      sketch. Confirm that its source opens without automatically running it.
- [ ] Restore `p5-server.explorer.autoRunSketchOnSide` to `true`.

### 10. Library detection

- [ ] Create `basic-sketches/sound-test.js` with this content:

  ```javascript
  let oscillator;

  function setup() {
    createCanvas(200, 200);
    oscillator = new p5.Oscillator();
    oscillator.setType('sine');
    oscillator.freq(440);
  }

  function draw() {
    background(220);
  }
  ```

- [ ] Confirm that `sound test` appears in the P5.js Sketch Explorer.
- [ ] Expand it and confirm that **p5.sound** appears as a library.
- [ ] Run the sketch in an external browser and inspect its Network panel.
- [ ] Confirm that `p5.sound.min.js` is loaded. The request may use the local
      proxy cache when `p5-server.enableProxyCache` is enabled.
- [ ] Delete `sound-test.js` after this test.

### 11. File operations and validation

- [ ] Select `basic-sketches`, open its context menu, and choose **Create
      Folder**.
- [ ] Enter `scratch` and confirm that `basic-sketches/scratch` is created.
- [ ] Select a file inside `basic-sketches`, run **Create Sketch
      (JavaScript)**, enter `selected-location-test`, and confirm that the new
      sketch is created beside the selected file.
- [ ] Start another create or rename operation and enter `../outside`.
- [ ] Confirm that the input reports **Enter a name without a directory path**
      and does not create a file outside the selected directory.
- [ ] Repeat with `.` and `..` and confirm that both names are rejected.
- [ ] Delete `selected-location-test.js` and the `scratch` directory after this
      test.

## Failure and Stress Scenarios

### Unavailable browser fallback

Run this test only when one of the named browsers in the Browser setting is not
installed.

- [ ] Set `p5-server.browser` to a named browser that is not installed.
- [ ] Run `basic-sketches/interactive-sketch.js`.
- [ ] Confirm that a status message reports the named browser failure.
- [ ] Confirm that the extension retries with the default system browser.
- [ ] Restore `p5-server.browser` to `integrated`.

### High-frequency console output

- [ ] Run `error-examples/console-spam.js`.
- [ ] Hold the pointer button over the sketch for at least five seconds.
- [ ] Confirm that the output channel continues to update and VS Code remains
      responsive.
- [ ] Release the pointer button and confirm that buffered messages finish
      appearing.
- [ ] Confirm that CPU use returns near its pre-test level after message traffic
      slows.

### Multiple sketches

- [ ] Run `basic-sketches/simple-circle.js`,
      `html-sketches/custom-style.html`, and
      `folder-sketches/game-project/index.html`.
- [ ] Confirm that each requested sketch opens and runs.
- [ ] Switch among their browser tabs or panes and confirm that each sketch
      remains usable.
- [ ] Generate console output from more than one sketch and confirm that the
      **P5 Sketch** output includes a source banner when the source changes.

## Cleanup

- [ ] Stop the P5 server.
- [ ] Close the Extension Development Host.
- [ ] Restore every P5 Server setting changed during testing.
- [ ] Delete the disposable test workspace.
- [ ] Confirm that the repository working copy was not changed by the manual
      tests.

## Reporting Issues

Include these details in each issue:

1. Steps to reproduce the problem.
2. Expected and actual behavior.
3. Relevant messages from the **P5 Sketch** output channel.
4. Relevant errors from **Help > Toggle Developer Tools** in the Extension
   Development Host.
5. OS, VS Code version, extension commit or version, and browser version.

## Test Results Template

```markdown
# Manual Testing Results: YYYY-MM-DD

## Environment

- OS:
- VS Code version:
- Extension commit or version:
- Browser and version:

## Results

- [ ] Extension activation: PASS / FAIL
- [ ] Server management: PASS / FAIL
- [ ] Sketch creation: PASS / FAIL
- [ ] Running sketches: PASS / FAIL
- [ ] Live reload and file watching: PASS / FAIL
- [ ] Sketch Explorer: PASS / FAIL
- [ ] Sketch conversion: PASS / FAIL
- [ ] Console and error reporting: PASS / FAIL
- [ ] Settings and UI contributions: PASS / FAIL
- [ ] Library detection: PASS / FAIL
- [ ] File operations and validation: PASS / FAIL
- [ ] Failure and stress scenarios: PASS / FAIL / SKIPPED

## Issues

1. Issue description or link

## Notes

Additional observations
```
