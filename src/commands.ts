import { Sketch } from 'p5-server';
import { commands, Uri, window, workspace } from 'vscode';
import { exclusions } from './sketchExplorer';
import { getWorkspaceFolderPaths } from './utils';
import path = require('path');

export async function createSketch(folder: boolean) {
  const wsFolders = getWorkspaceFolderPaths();

  if (wsFolders.length === 0) {
    window.showErrorMessage('You must have at least one folder open to create a sketch.');
    return;
  }

  const wsPath =
    wsFolders.length > 1
      ? await window.showQuickPick(wsFolders, { placeHolder: 'Select a workspace folder' })
      : wsFolders[0];
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
  if (!folder && !sketchName.endsWith('.js')) {
    sketchName += '.js';
  }

  const filePath = path.join(wsPath, sketchName);
  const dirPath = path.dirname(filePath);
  const basePath = path.basename(sketchName);
  const sketch = folder
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

  window.showTextDocument(Uri.file(path.join(sketch.dir, sketch.scriptFile)));
  commands.executeCommand('p5-explorer.refresh');
}

export async function duplicateSketch(sketch: Sketch) {
  if (!(sketch instanceof Sketch)) throw new Error(`${sketch} is not a Sketch`);
  let name = await window.showInputBox();
  if (!name) return;
  name = name.replace(/-?\s+-?/g, '-');
  // if the sketch is the only item in the directory, copy the directory
  const { sketches } = await Sketch.analyzeDirectory(sketch.dir, { exclusions });
  if (sketches.length === 1 && sketches[0].mainFile === sketch.mainFile) {
    await workspace.fs.copy(Uri.file(sketch.dir), Uri.file(path.join(path.dirname(sketch.dir), name)));
  } else {
    // copy the sketch files within the same directory
    const basename = name.replace(/\.(js|html?)$/i, '');
    const replacements = [sketch.mainFile, sketch.scriptFile]
      .filter(Boolean)
      .map(file => ({
        src: Uri.file(path.join(sketch.dir, file)),
        target: Uri.file(path.join(sketch.dir, basename + path.extname(file)))
      }))
      .map(rec => ({ ...rec, targetExists: fsExists(rec.target) }));
    const targetsExist = await Promise.all(replacements.map(({ target }) => fsExists(target)));
    if (targetsExist.some(Boolean)) {
      const target = replacements[targetsExist.indexOf(true)].target;
      window.showErrorMessage(`Can't create a duplicate named ${name}. ${target.fsPath} already exists`);
      return;
    }
    await Promise.all(replacements.map(({ src, target }) => workspace.fs.copy(src, target)));
  }
  async function fsExists(uri: Uri): Promise<boolean> {
    return workspace.fs.stat(uri).then(
      () => true,
      () => false
    );
  }
}
