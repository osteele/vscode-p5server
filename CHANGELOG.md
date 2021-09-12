# Change Log

## [1.1.0 -- 2021-09-13]

New:

- The Run Sketch command defaults to the new integrated browser. Change the
  `p5-server.browser` setting to `system` in order to open sketches in an
  external browser (such as Chrome, Edge, or Safari), or change it to the name
  of a specific browser.

- Enable the `p5-server.explorer.autoRunSketchOnSide` setting in order to run
  sketches when they are selected in the sketch explorer.

- In the `p5-server.browser setting`, renamed the default system browser from
  `default` => `system`

- Display release notes on first run since update

## [1.0.9 -- 2021-09-12]

New:

- In the sketch explorer, click a library to view its home page.
- Rename and duplicate items in the sketch explorer. Right-click / control-click
  for a context menu.

The following features are disabled by default. Change the `p5-server.browser`
setting to `integrated` in order to use the integrated browser. This will be the
default in the next minor release.

New:

- Add a config option to use the VSCode integrated (“Simple”) browser
- Display console messages from the sketch in an output channel

Fixed:

- Running a sketch always opens the main file
- In the explorer, sketches don't include files outside their directory

## [1.0.0 -- 2021-08-09]

Changed:

- Move explorer to activity bar
- Show sketch libraries in the explorer

Improved:

- Upgrade p5-server: can import more libraries
- Display paths relative to home directory

## [0.2.1 -- 2021-08-03]

Fixed:

- Upgrade p5-server: fixes filename case inconsistency that caused error on Linux

## [0.2.0 -- 2021-08-02]

Added:

- Add configuration settings to select the browser
- Add configuration settings to control visibility

Improved:

- Upgrade to p5-server 0.3.0

## [0.1.1]

New:

- A new 🌐 editor title menu opens the editor's sketch in the browser
- The 🌐 item in the status bar opens the root
- Sketch explorer:
  - Add dark icons
  - Add an icon. This is used when it is dragged to the Activity bar.
  - Changee the run command's icon 🌐->🞂
  - Display the run command only on sketch items
  - Enable the explorer commands only in that view

Improved:

- Upgrade to p5-server 0.2.1. Refer to [its change
  notes](https://github.com/osteele/p5-server/blob/master/CHANGELOG.md#change-log)
  for additonal changes that affect this extension.

## [0.1.0]

New:

- Add a Sketch explorer
- Open browser opens onto the current editor's sketch
- Launch server quick-picks from multiple workspace folders
- Added an icon to the marketplace

Improved:

- Separate commands to create sketch folder or sketch file
- Upgrade to p5-server@0.2.0

## [0.0.2]

New:

- Add create sketch command
- Open in the browser

Improved:

- Status bar uses product icons

## [0.0.1]

- Initial release
