import { parse as parseHTML } from 'node-html-parser';
import { Sketch } from 'p5-server';
import { Uri, window, workspace } from 'vscode';
import { fsExists } from '../helpers/fileHelpers';
import { exclusions } from '../configuration';
import path = require('path');

export async function convertSketch(sketch: Sketch, type: 'html' | 'script') {
  sketch.convert({ type });
}

export async function duplicateSketch(sketch: Sketch) {
  if (!(sketch instanceof Sketch)) throw new Error(`${sketch} is not a Sketch`);

  const defaultName = `${sketch.name}-2`;
  const name = await window.showInputBox({ value: defaultName });
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

export async function renameSketch(item: Sketch | Uri): Promise<void> {
  // TODO: close running windows
  const defaultName = item instanceof Sketch ? item.name : path.basename(item.fsPath);
  let name = await window.showInputBox({ value: defaultName });
  if (!name) return;
  // TODO: rename single-sketch folders
  if (item instanceof Sketch) {
    switch (item.structureType) {
      case 'html':
        if (!/\.html?$/i.test(name)) name += '.html';
        return workspace.fs.rename(Uri.file(item.mainFilePath), Uri.file(path.join(item.dir, name)));
      case 'script':
        if (!/\.js$/i.test(name)) name += '.js';
        return workspace.fs.rename(Uri.file(item.scriptFilePath), Uri.file(path.join(item.dir, name)));
    }
  } else {
    const target = Uri.file(path.join(path.dirname(item.fsPath), name));
    return workspace.fs.rename(item, target);
  }
}