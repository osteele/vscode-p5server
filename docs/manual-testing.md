# Manual Testing Plan

Use this checklist for behavior that automated tests cannot yet establish reliably: VS Code UI state, browser rendering, timing, external integrations, and resource use.

Run `bun test` before starting. The automated suite already covers:

- startup activation, command registration, and contribution metadata
- configuration exclusions and filename validation rules
- file watcher delivery, filtering, and duplicate-event suppression
- console inlay-hint summaries, diagnostic lifecycle, update coalescing, and retention limits

Do not repeat those assertions manually unless an automated test is failing. The checklist below tests their user-visible integration only.

## Setup

1. Run `bun install` and `bun run compile` in this repository.
2. Press `F5` to open an Extension Development Host.
3. Copy `test-workspaces/` to a temporary writable directory, then open the copy in the Extension Development Host.
4. Keep these views available:
   - **Output > P5 Sketch**
   - **Developer: Show Running Extensions**
   - **Developer Tools**, when a step calls for CPU or memory inspection
5. Begin with the default P5 Server settings unless a step says otherwise.

Record the extension version, VS Code version, operating system, browser, and any nondefault setting in the test report.

## Release smoke test

### 1. Startup activation, status bar, and explorer shell

- [ ] After VS Code finishes starting, **Developer: Show Running Extensions** lists P5 Server as active without opening its view or running a command.
- [ ] Before opening the Sketch Explorer, confirm that the configured P5 Server status-bar item is visible. This eager visibility is an intentional compatibility behavior.
- [ ] The P5 activity-bar icon is visible. Open it and confirm that the explorer is ready.
- [ ] The explorer lists the workspace's top-level directories and representative sketches without an explicit refresh.
- [ ] Expand one nested sketch and confirm that its files appear under the correct directory.
- [ ] The Output view contains no activation or initial-scan error.

### 2. Server lifecycle and browser routing

- [ ] Run **P5 Server: Start Server**. While startup is in progress, the status-bar icon spins and its tooltip describes the transition.
- [ ] After startup, the Output view reports the listening address, the status-bar icon becomes solid, and the server/browser status items show the active state.
- [ ] Run the simple circle sketch in the integrated browser. Confirm that the red circle renders and the Output view records the run.
- [ ] Run the same sketch from its explorer action and editor-title action. Each route opens the intended sketch.
- [ ] Set a breakpoint in the sketch and run **Debug P5 Sketch**. VS Code opens its browser debugger, stops at the breakpoint, and supports stepping and variable inspection without creating or changing `.vscode/launch.json`.
- [ ] Change **P5 Server > Browser** to the system browser and rerun the interactive sketch. Confirm that interaction works and relayed console output reaches the Output view.
- [ ] Use **Run in External Browser** while the integrated browser is configured. Confirm that this command still uses an external browser.
- [ ] Run **P5 Server: Stop Server**. The icon shows the stopping transition, then the server-only status items disappear and the server no longer accepts requests.

### 3. Live reload and directory updates

- [ ] Run the multi-file sketch, change one source file, and confirm that the browser reflects the edit without a manual refresh.
- [ ] Save once and confirm that the browser reloads once. Rapidly save several edits and confirm that the final version appears without a reload loop.
- [ ] Create, rename, and delete a root-level sketch file. The server directory listing updates after each operation.
- [ ] Create, rename, and delete a sketch directory. The listing and the P5 explorer update without restarting the server.

The unit suite verifies watcher overlap and duplicate callback suppression. This section verifies only the end-to-end effect on the browser and explorer.

### 4. Sketch and file workflows

Exercise each creation shape because the automated command tests do not yet create files in a real workspace:

- [ ] **Create p5.js Sketch File** creates a uniquely named script containing `setup()` and `draw()`, opens it, and adds it to the explorer.
- [ ] **Create p5.js Sketch (HTML + JS)** creates a matching HTML and JavaScript pair, links them correctly, opens the HTML file, and groups them in the explorer.
- [ ] **Create p5.js Sketch Folder** creates a folder containing `index.html` and `sketch.js`, links them correctly, opens the sketch, and adds the folder to the explorer.
- [ ] Invoke one creation command from a selected nested file. The new item is created beside that file rather than at the workspace root.
- [ ] Duplicate a sketch, rename the duplicate, cancel one delete, and then confirm a second delete. The filesystem and explorer agree after every step, the deleted files are in the operating system trash, and the rename appears in VS Code's workspace-edit history.
- [ ] Convert a script sketch to HTML, then convert a separate HTML sketch to a script. The expected source files remain intact and the explorer grouping updates.
- [ ] Enter one path-traversal name such as `../outside.js`. VS Code shows a validation error and creates nothing outside the selected directory.

The automated suite covers the full invalid-name matrix. The last item checks only that the validation reaches the UI and contains the filesystem operation.

### 5. Explorer behavior

- [ ] Expand and collapse a branch containing nested directories. The hierarchy and expansion state remain stable after a refresh.
- [ ] With **Explorer: Auto Reveal** enabled, opening a sketch reveals its tree item. With the setting disabled, opening another sketch does not move the selection.
- [ ] Open context menus on a directory, script sketch, HTML sketch, and library. Commands appear only where they apply and disabled commands explain their unavailable state when VS Code provides one.
- [ ] Create or delete a file outside VS Code. The explorer refreshes automatically and does not retain a stale duplicate.

Command registration is automated. These checks cover menu placement, enablement, hierarchy, and cache invalidation.

### 6. Console and error presentation

- [ ] With **Console > Auto Show** set to its default, run the console fixture. `log`, `info`, `warn`, and `error` messages appear with VS Code log timestamps and severity, and recent messages appear as inlay hints at the correct lines.
- [ ] Generate a short burst of messages. Editing and scrolling remain responsive, and the inlay hints settle to the final recent-message state.
- [ ] Set **Console > Auto Show** to **never**, close the Output view, and rerun the fixture. The view stays closed. **Show Script Output** then reveals the buffered messages.
- [ ] Enable **Console > Clear On Reload**, reload, and confirm that old messages disappear. Disable it, reload again, and confirm that old and new sessions remain distinguishable.
- [ ] Run the syntax-error fixture. The browser error page identifies the source and location, and the Output view reports the same failure.
- [ ] Run the runtime-error fixture. The Output view and Problems view point to the failing source location. Selecting the diagnostic opens the correct line.
- [ ] Disable **Console > Info Lens**. Existing P5 Server inlay hints and diagnostics disappear while messages continue to reach the Output view.

Inlay-hint capacity, coalescing, and diagnostic cleanup are automated. The burst step checks perceived editor behavior and final presentation, not the exact internal limits.

### 7. Settings, visibility, and automatic run behavior

- [ ] Run **P5 Server: Open Settings**. VS Code opens Settings filtered to the extension.
- [ ] Change the configured browser. The editor-title action and its label or tooltip update to match the route.
- [ ] Disable the editor-title icon. It disappears without reloading the window and reappears when enabled.
- [ ] Toggle the server and browser status-bar settings independently. Only the requested items change visibility.
- [ ] Reload the window with the server status item enabled. It is visible after startup without first opening the Sketch Explorer.
- [ ] Enable automatic run in the configured side view, open a sketch, and confirm that it runs there. Disable automatic run, open another sketch, and confirm that no run starts.

### 8. Library integration

- [ ] Create or open a sketch that uses `p5.sound`.
- [ ] The explorer identifies the library and its **Open Library** action opens the expected library source or documentation.
- [ ] Run the sketch with network access and confirm in the browser Network panel that the library loads successfully.

This check intentionally stays end to end. Library analysis and server internals are tested in their own projects.

## Stress and compatibility checks

Run these checks for release candidates, performance-sensitive changes, or changes to the affected subsystem.

### High-volume console traffic

- [ ] Run the high-volume console fixture for a bounded interval.
- [ ] The Output view continues to receive messages, the editor remains usable, and inlay-hint updates settle after the burst.
- [ ] Record peak Extension Host CPU and resident memory. After traffic stops and editors close, memory should level off rather than continue growing.

### Large explorer tree

- [ ] Open a generated workspace with about 100 sketch directories and 1,000 files.
- [ ] Record time to first tree display and time to expand a previously unseen branch.
- [ ] Collapse and reopen the view. Cached display should be faster and should not materially increase retained memory.
- [ ] Modify one branch externally. The refresh should update that branch without a visible full-tree rebuild.

### Multiple sketches and clients

- [ ] Run two different sketches in separate browser tabs.
- [ ] Edit each sketch in turn. Only the corresponding page reloads, and console messages retain the correct source banner and location.
- [ ] Close both tabs, stop the server, and confirm that Extension Host memory returns near its post-activation baseline.

### Browser fallback

- [ ] Configure an unavailable browser and run a sketch.
- [ ] The extension reports an actionable error or uses the documented fallback without leaving the server or status bar in a transitional state.

### Remote and restricted workspaces

- [ ] Open the fixtures through one supported remote environment: Remote SSH, a Dev Container, WSL, or Codespaces. The Sketch Explorer loads the remote files, live reload works, and the integrated and system browser routes open a forwarded URL on the client.
- [ ] Debug a remote sketch. Breakpoints map to the remote source file and the debugger reaches the forwarded server URL.
- [ ] Open an untrusted copy of the fixture workspace. Sketch browsing, creation, rename, and delete remain available, while start, run, and debug actions are disabled.
- [ ] Invoke a server command indirectly in Restricted Mode. The extension explains the trust requirement and offers the Workspace Trust manager rather than starting the server.

## Automation migration backlog

Remove a manual item only after its replacement asserts the same user-visible contract and runs in the normal automated suite. Keep one integrated-browser visual smoke test even after browser automation is added because VS Code webview behavior varies by release.

| Priority | Migration | Proposed automated boundary | Manual coverage retired after migration |
| --- | --- | --- | --- |
| P1 | Filesystem command tests | Run creation, duplicate, rename, delete, and conversion commands against a temporary VS Code workspace; assert file contents, unique naming, selection-relative paths, and tree refresh signals. | Most of **Sketch and file workflows**, retaining one creation and one conversion smoke test. |
| P1 | Explorer model tests | Extract directory analysis and cache invalidation behind a filesystem adapter; feed create, change, rename, and delete events into the tree provider. | Hierarchy, external refresh, and large-tree correctness checks. Keep visual menu placement and performance timing. |
| P1 | Console state tests | Put auto-show policy, clear-on-reload behavior, source banners, severity formatting, and InfoLens enablement behind injected output/editor adapters. | Most console setting combinations, retaining one real relay and error-location smoke test. |
| P2 | Status-bar activation suite | Launch a separate Extension Development Host and inspect the contributed status items after `onStartupFinished`. | The Running Extensions and pre-explorer status checks. |
| P2 | Contribution manifest tests | Extend current manifest assertions to cover every menu `when` clause and visibility command. | Exhaustive context-menu and settings-contribution checks. Keep a UI spot check. |
| P2 | Server and browser controller tests | Inject the server factory, browser opener, status-bar items, and clock; assert transitions, concurrent starts, stops, failures, and unavailable-browser fallback. | Transitional-state and fallback permutations. Keep one real start/run/stop path. |
| P3 | External-browser end-to-end suite | Use a real browser against a bounded fixture workspace to assert rendering, live reload routing, console relay, syntax/runtime errors, and multi-client isolation. | Most browser and live-reload scenarios. Keep integrated-browser rendering and interaction checks. |
| P3 | Repeatable performance harness | Generate fixed console and explorer workloads; record p50/p95 latency, Extension Host CPU, and resident memory with generous regression thresholds. | Ad hoc resource measurements, once the harness is stable across supported platforms. |

Suggested implementation order:

1. Add filesystem command tests. They cover the largest manual block with little UI automation.
2. Add console state and explorer model tests while keeping VS Code APIs at thin adapters.
3. Add controller and manifest tests for state transitions and contribution wiring.
4. Add browser end-to-end tests only after the lower-level seams are stable.
5. Establish performance baselines from several clean CI runs before enforcing thresholds.

## Cleanup

1. Stop the P5 server.
2. Close external browser tabs and the Extension Development Host.
3. Delete only the temporary workspace copy created for this run.
4. Restore changed user settings.
5. Confirm that no extension process or listening server remains.

## Reporting

For each failure, record:

- checklist section and step
- expected and observed behavior
- reproduction steps
- relevant settings
- VS Code, extension, operating system, and browser versions
- Output log excerpt and screenshot or recording when useful
- CPU, resident-memory, and timing measurements for performance failures

## Results template

```text
Date:
Tester:
Commit / extension version:
VS Code version:
OS:
Browser:

Automated suite:                 PASS / FAIL
Startup activation and explorer: PASS / FAIL
Server lifecycle and routing:    PASS / FAIL
Live reload and directory state: PASS / FAIL
Sketch and file workflows:       PASS / FAIL
Explorer behavior:               PASS / FAIL
Console and errors:              PASS / FAIL
Settings and automatic run:      PASS / FAIL
Library integration:             PASS / FAIL
Stress and compatibility:        PASS / FAIL / NOT RUN
Remote and restricted workspace: PASS / FAIL / NOT RUN

Peak Extension Host CPU:
Peak Extension Host RSS:
Large-tree first display:
Large-tree cached display:

Failures / notes:
```
