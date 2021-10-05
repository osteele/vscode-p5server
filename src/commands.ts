import { parse as parseHTML } from 'node-html-parser'; // eslint-disable-line @typescript-eslint/no-var-requires
import { Sketch } from 'p5-server';
import * as vscode from 'vscode';
import { commands, Uri, window, workspace } from 'vscode';
import { exclusions } from './sketchExplorer';
import { getWorkspaceFolderPaths } from './utils';
import path = require('path');

export function registerCommands(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    commands.registerCommand('p5-server.createSketchFile', createSketch.bind(null, false)),
    commands.registerCommand('p5-server.createSketchFolder', createSketch.bind(null, true)),
    commands.registerCommand('p5-server.duplicateSketch', duplicateSketch),
    commands.registerCommand('p5-server.openSettings', () =>
      commands.executeCommand('workbench.action.openSettings', 'p5-server')
    )
  );
}

async function createSketch(isFolderSketch: boolean, dir?: string) {
  const wsFolders = getWorkspaceFolderPaths();

  if (wsFolders.length === 0) {
    window.showErrorMessage('You must have at least one folder open to create a sketch.');
    return;
  }

  const wsPath =
    dir ??
    (wsFolders.length > 1
      ? await window.showQuickPick(wsFolders, { placeHolder: 'Select a workspace folder' })
      : wsFolders[0]);
  if (!wsPath) return; // the user cancelled

  let sketchName = await window.showInputBox({
    value: '',
    prompt: `Enter the name of the p5.js sketch`,
    ignoreFocusOut: true
  });
  if (!sketchName) {
    return;
  }
  sketchName = sketchName.trim();
  if (sketchName.length === 0) {
    return;
  }
  if (!isFolderSketch && !sketchName.endsWith('.js')) {
    sketchName += '.js';
  }

  const filePath = path.join(wsPath, sketchName);
  const dirPath = path.dirname(filePath);
  const basePath = path.basename(sketchName);
  const sketch = isFolderSketch
    ? Sketch.create(path.join(filePath, 'index.html'), {
        scriptFile: 'sketch.js',
        title: sketchName
      })
    : Sketch.create(path.join(dirPath, basePath));

  try {
    await sketch.generate();
  } catch (e) {
    window.showErrorMessage(e.message);
    console.error(e.message);
    return;
  }

  window.showTextDocument(Uri.file(sketch.scriptFilePath));
  commands.executeCommand('p5-server.explorer.refresh');
}

async function duplicateSketch(sketch: Sketch) {
  if (!(sketch instanceof Sketch)) throw new Error(`${sketch} is not a Sketch`);
  const name = await window.showInputBox();
  if (!name) return;
  // if the sketch is the only sketch in the directory, copy the directory
  const { sketches } = await Sketch.analyzeDirectory(sketch.dir, { exclusions });
  if (sketches.length === 1 && sketches[0].mainFilePath === sketch.mainFilePath) {
    await workspace.fs.copy(Uri.file(sketch.dir), Uri.file(path.join(path.dirname(sketch.dir), name)));
  } else {
    // copy the sketch files within the same directory
    const basename = name.replace(/\.(js|html?)$/i, '');
    const replacements = ([sketch.scriptFile, sketch.htmlFile].filter(Boolean) as string[]).map(name => ({
      src: Uri.file(path.join(sketch.dir, name)),
      target: Uri.file(path.join(sketch.dir, basename + path.extname(name)))
    }));
    const targetsExist = await Promise.all(replacements.map(({ target }) => fsExists(target)));
    if (targetsExist.some(Boolean)) {
      const target = replacements[targetsExist.indexOf(true)].target;
      window.showErrorMessage(`Can't create a duplicate named ${name}. ${target.fsPath} already exists`);
      return;
    }
    await Promise.all(replacements.map(({ src, target }) => workspace.fs.copy(src, target)));
    // rename the script file within the HTML tag
    // TODO: do this as part of the initial copy
    if (replacements.length > 1) {
      const [{ src: srcScript, target: targetScript }, { target: htmlFile }] = replacements;
      const dir = path.dirname(htmlFile.fsPath);
      const htmlBytes = await workspace.fs.readFile(htmlFile);
      const htmlRoot = parseHTML(htmlBytes.toString());
      const scripts = htmlRoot
        .querySelectorAll('script')
        .filter(script => script.attributes.src && path.join(dir, script.attributes.src) === srcScript.fsPath);
      scripts.forEach(script => script.setAttribute('src', path.relative(dir, targetScript.fsPath)));
      await workspace.fs.writeFile(htmlFile, Buffer.from(htmlRoot.toString(), 'utf-8'));
    }
  }
}

async function fsExists(uri: Uri): Promise<boolean> {
  return workspace.fs.stat(uri).then(
    () => true,
    () => false
  );
}
