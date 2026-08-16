import { parse as parseHTML } from 'node-html-parser';
import { migrateToP5v2, Sketch } from 'p5-server';
import { commands, Range, Uri, window, workspace, WorkspaceEdit } from 'vscode';
import { fsExists, workspaceUriForPath } from '../helpers/fileHelpers';
import { exclusions } from '../configuration';
import path = require('path');
import { validateChildName } from '../helpers/fileNames';

export async function convertSketch(sketch: Sketch, type: 'html' | 'script') {
  await sketch.convert({ type });
  await commands.executeCommand('p5-server.explorer.refresh');
}

export async function duplicateSketch(sketch: Sketch) {
  if (!(sketch instanceof Sketch)) throw new Error(`${sketch} is not a Sketch`);

  const defaultName = `${sketch.name}-2`;
  let name = await window.showInputBox({ value: defaultName, validateInput: validateChildName });
  if (!name) return;
  name = name.trim();

  // if the sketch is the only sketch in the directory, copy the directory
  const { sketches } = await Sketch.analyzeDirectory(sketch.dir, { exclusions });
  if (sketches.length === 1 && sketches[0].mainFilePath === sketch.mainFilePath) {
    await workspace.fs.copy(
      workspaceUriForPath(sketch.dir),
      workspaceUriForPath(path.join(path.dirname(sketch.dir), name)),
    );
  } else {
    // copy the sketch files within the same directory
    const basename = name.replace(/\.(js|html?)$/i, '');
    const replacements = ([sketch.scriptFile, sketch.htmlFile].filter(Boolean) as string[]).map(name => ({
      src: workspaceUriForPath(path.join(sketch.dir, name)),
      target: workspaceUriForPath(path.join(sketch.dir, basename + path.extname(name))),
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
  await commands.executeCommand('p5-server.explorer.refresh');
}

export async function renameSketch(item: Sketch | Uri): Promise<void> {
  // TODO: close running windows
  const defaultName = item instanceof Sketch ? item.name : path.basename(item.fsPath);
  let name = await window.showInputBox({ value: defaultName, validateInput: validateChildName });
  if (!name) return;
  name = name.trim();
  // TODO: rename single-sketch folders
  if (item instanceof Sketch) {
    switch (item.structureType) {
      case 'html':
        if (!/\.html?$/i.test(name)) name += '.html';
        await renameWithWorkspaceEdit(
          workspaceUriForPath(item.mainFilePath),
          workspaceUriForPath(path.join(item.dir, name)),
        );
        break;
      case 'script':
        if (!/\.js$/i.test(name)) name += '.js';
        await renameWithWorkspaceEdit(
          workspaceUriForPath(item.scriptFilePath),
          workspaceUriForPath(path.join(item.dir, name)),
        );
        break;
    }
  } else {
    const target = workspaceUriForPath(path.join(path.dirname(item.fsPath), name));
    await renameWithWorkspaceEdit(item, target);
  }
  await commands.executeCommand('p5-server.explorer.refresh');
}

/** Rewrite a p5.js 1.x sketch to the p5.js 2 asynchronous form, after showing
 * the author what would change. The transform reports anything it will not do
 * mechanically; those cases are surfaced rather than applied silently. */
export async function convertSketchToP5v2(sketch: Sketch): Promise<void> {
  if (!(sketch instanceof Sketch)) throw new Error(`${sketch} is not a Sketch`);

  const scriptUri = workspaceUriForPath(sketch.scriptFilePath);
  const document = await workspace.openTextDocument(scriptUri);
  const { code, warnings, changed } = migrateToP5v2(document.getText());

  if (!changed) {
    const message = warnings.length
      ? `${path.basename(sketch.scriptFilePath)} needs changes that cannot be made automatically. ${warnings.join(' ')}`
      : `${path.basename(sketch.scriptFilePath)} does not use preload(), so there is nothing to convert.`;
    await window.showWarningMessage(message);
    return;
  }

  // Show the change before making it. The preview is a scratch document, so
  // declining leaves the sketch untouched.
  const preview = await workspace.openTextDocument({ content: code, language: 'javascript' });
  await commands.executeCommand(
    'vscode.diff',
    scriptUri,
    preview.uri,
    `${path.basename(sketch.scriptFilePath)} — convert to p5.js 2`,
  );

  const confirmation = await window.showInformationMessage(
    `Convert ${path.basename(sketch.scriptFilePath)} to p5.js 2?`,
    { modal: true, detail: warnings.join('\n') || undefined },
    'Convert',
  );
  if (confirmation !== 'Convert') return;

  const edit = new WorkspaceEdit();
  edit.replace(scriptUri, document.validateRange(new Range(0, 0, document.lineCount, 0)), code);
  if (!(await workspace.applyEdit(edit))) {
    throw new Error(`VS Code could not update ${scriptUri.fsPath}`);
  }

  if (warnings.length) {
    await window.showWarningMessage(
      `Converted with ${warnings.length} thing${warnings.length === 1 ? '' : 's'} to check by hand. ${warnings.join(' ')}`,
    );
  }
  await commands.executeCommand('p5-server.explorer.refresh');
}

async function renameWithWorkspaceEdit(source: Uri, target: Uri): Promise<void> {
  const edit = new WorkspaceEdit();
  edit.renameFile(source, target);
  if (!(await workspace.applyEdit(edit))) {
    throw new Error(`VS Code could not rename ${source.fsPath}`);
  }
}
