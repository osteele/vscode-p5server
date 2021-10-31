# Change Log

## Unreleased

Changed:

- Reloading a sketch clears the console. A new configuration "P5-server >
  Console: Clear on Reload" restores the old behavior.

## [1.1.8] - 2021-10-28

Added:

- Add antiboredom/p5.patgrad to list of libraries

Fixed:

- Restore syntax-error reporting functionality
- Performance improvements

## [1.1.7] - 2021-10-28

Added:

- Update release notes.

## [1.1.6] - 2021-10-27

Added:

- Menu items to open sketch in internal, external browser

Changed:

- A directory is classified as a single-directory sketch only if the HTML file
  is named index.html
- performance improvements in sketch detection, library inference

## [1.1.5] - 2021-10-05

Added:

- New Sketch Explorer menu w/ Create Sketch, Create Sketch (Folder), Create
  Sketch (HTML)

Fixed:

- In Sketch Explorer, create sketch is relative to selected file or folder
- Auto import works for p5.xr, p5.3D, and libraries hosted only on GitHub

## [1.1.3] - 2021-10-03

Fixed:

- integrated console output was broken in 1.1.2

Added:

- Recognize libraries: anime, CCapture.js, p5.pattern, p5.rotate-about

## [1.1.2] - 2021-10-02

Fixed:

- Remove annoying upgrade information message, was showing up on very workspace
  activation instead of just once

## [1.1.1] - 2021-10-01

Fixed:

- p5-server upgrade handles file names with spaces

## [1.1.0] - 2021-09-15

New:

- The Run Sketch command defaults to the new integrated browser. Change the
  "*P5-server: Browser*" setting to `system` in order to open sketches in the
  default system browser. Or, change it to the name of a specific browser (such
  as Chrome, Edge, or Safari).

- In the sketch explorer, clicking on a sketch runs it in the internal browser.
  Uncheck the "*P5-server: Explorer > Explorer: Auto Run Sketch On Side*" setting
  to disabled this.

- The first time the extension is activated, it displays release notes (this
  page) if there are signficant changes. For this release only, it also displays
  the release notes if the extension has been just been installed.

Changed:

- In the "*P5-server: Browser*" setting, the default system browser is named
  `system` instead of `default`.

## [1.0.9] - 2021-09-12

New:

- In the sketch explorer, click a library to open its home page in the default
  system browser.
- The sketch explorer can be used to rename and duplicate sketches. Right-click
  / control-click for a context menu that provides these items.

The following features are disabled by default. Change the "*P5-server:
Browser*" setting to `integrated` in order to use the integrated browser. This
will be the default in the next minor release.

New:

- The extension now includes an integrated browser, that runs inside of VS Code.
  To activate this, change the new "*P5-server: Browser*" setting to
  `integrated`. (In the next release, this will become the default value for
  this setting.)
- Console messages from the integrated browser are displayed in an output
  channel. This channel opens automatically when a message is printed to the
  console. Use the "*Console > Integrated Browser > Auto Show: Level*" setting
  to modify this behavior.

Fixed:

- Clicking a sketch opens the main file. (Previously, clicking an HTML sketch
  opened the HTML file.)
- In the sketch explorer, disclosing a sketch's files no longer lists files
  outside the sketch directory.

## [1.0.0] - 2021-08-09

Changed:

- The sketch explorer has its own item on the activity bar. It defaults to this
  location rather than the Explorer container. In order to restore the previous
  behavior, drag it back into the Explorer container (or into any other
  container).
- In the sketch explorer, disclosing a sketch shows its libraries.

Improved:

- Upgraded p5-server: more libraries are recognized for automatic import.
- In the sketch explorer, file paths are shown relative to the workspace
  directory.

## [0.2.1] - 2021-08-03

Fixed:

- Upgrade p5-server: fixes filename case inconsistency that caused error on Linux

## [0.2.0] - 2021-08-02

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
  - Changed the run command's icon 🌐->🞂
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
