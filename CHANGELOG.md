# Change Log

## [1.1.0]

- The Run Sketch command defaults to the new integrated browser. Change the
  `p5-server.browser` setting to `system` in order to open sketches in an
  external browser (such as Chrome, Edge, or Safari), or change it to the name
  of a specific browser.

- Enable the `p5-server.explorer.autoRunSketchOnSide` setting in order to run
  sketches when they are selected in the sketch explorer.

- In the `p5-server.browser setting`, renamed the default system browser from
  `default` => `system`

## [1.0.9]

New features:

- In the sketch explorer, click a library to view its home page.
- Rename and duplicate items in the sketch explorer. Right-click / control-click
  for a context menu.

The following features are disabled by default. Change the `p5-server.browser`
setting to `integrated` in order to use the integrated browser. This will be the
default in the next minor release.

- Add a config option to use the VSCode integrated (“Simple”) browser
- Display console messages from the sketch in an output channel

Bug fixes:

- Running a sketch always opens the main file
- In the explorer, sketches don't include files outside their directory

## [1.0.0]

- Move explorer to activity bar
- Show sketch libraries in the explorer
- Upgrade p5-server: can import more libraries
- Display paths relative to home directory

## [0.2.1]

- Upgrade p5-server: fixes filename case inconsistency that caused error on Linux

## [0.2.0]

- Add configuration settings to select the browser
- Add configuration settings to control visibility
- Upgrade to p5-server 0.3.0

## [0.1.1]

- A new 🌐 editor title menu opens the editor's sketch in the browser
- The 🌐 item in the status bar opens the root
- Sketch explorer:
  - Add dark icons
  - Add an icon. This is used when it is dragged to the Activity bar.
  - Changee the run command's icon 🌐->🞂
  - Display the run command only on sketch items
  - Enable the explorer commands only in that view
- Upgrade to p5-server 0.2.1. Refer to [its change
  notes](https://github.com/osteele/p5-server/blob/master/CHANGELOG.md#change-log)
  for additonal changes that affect this extension.

## [0.1.0]

- Add a Sketch explorer
- Open browser opens onto the current editor's sketch
- Launch server quick-picks from multiple workspace folders
- Added an icon to the marketplace
- Update p5-server version
- Separate commands to create sketch folder or sketch file
- Upgrade to p5-server@0.2.0

## [0.0.2]

- Add create sketch command
- Status bar uses product icons
- Open in the browser

## [0.0.1]

- Initial release
