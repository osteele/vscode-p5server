# p5-server

Launch a local developer server that knows about p5.js sketches.

The server provides features that make it easier to manage collections of
sketches (smart directory listings, JavaScript-only sketches); and that automate
some of the features that I see beginners struggle with (noticing syntax errors,
adding libraries).

## Features

### Live reload

The browser reloads the page, when any file in its directory is modified.

### JavaScript-only sketches

Click on a JavaScript sketch file (or run e.g. `p5 serve sketch.js`) to run a
p5.js sketch that consists of a single JavaScript file, without an associated
HTML file.

### Automatic library inclusion

JavaScript-only sketches automatically include many of the libraries that are
isted on the [p5.js Libraries page](https://p5js.org/libraries/), as well as
[dat.gui](https://github.com/dataarts/dat.gui). For example, if the sketch calls
`loadSound`, it will include the p5.sound library. If it refers to `ml5`, it
will include the ml5.js library.

### In-Page Syntax errors

Syntax error are displayed in the HTML body. This way you see them ecven if you
don't open the browser developer console.

(Yes, everybody should do program development with the console open or a
debugger attached. I've still found this to be a barrier to getting started with
p5.js: no matter of classroom instruction reduces the time to build that habit
to zero.)

### Directory listing

Viewing a directory in the browser lists the sketches in that directory.

### Sketch generation

`p5 generate` creates an `index.html` / `sketch.js` pair of files.

## Extension Settings

Include if your extension adds any VS Code settings through the `contributes.configuration` extension point.

For example:

This extension contributes the following settings:

* `myExtension.enable`: enable/disable this extension
* `myExtension.thing`: set to `blah` to do something

## Acknowledgements

Inspired by Ritwick Dey's [Live Server extension](https://ritwickdey.github.io/vscode-live-server/).
