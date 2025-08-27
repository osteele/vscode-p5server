import { Sketch } from 'p5-server';
import * as vscode from 'vscode';
import { Uri, window, workspace } from 'vscode';
import { fileExists, getWorkspaceFolderPaths } from '../helpers/fileHelpers';
import path = require('path');

export async function createSketch({ dir, type }: { dir?: string; type: 'script' | 'html' | 'folder' }) {
  const wsFolders = getWorkspaceFolderPaths();

  if (!dir && wsFolders.length === 0) {
    window.showErrorMessage('You must have at least one folder open to create a sketch.');
    return;
  }

  const wsPath =
    dir ??
    (wsFolders.length === 1
      ? wsFolders[0]
      : await window.showQuickPick(wsFolders, { placeHolder: 'Select a workspace folder' }));
  if (!wsPath) return; // the user cancelled

  let sketchName = await window.showInputBox({
    prompt: `Enter the name of the p5.js sketch`
  });
  sketchName = sketchName?.trim();
  if (!sketchName) return;

  let sketch: Sketch;
  let filePath = path.join(wsPath, sketchName);
  switch (type) {
    case 'folder':
      await workspace.fs.createDirectory(Uri.file(filePath));
      sketch = Sketch.create(path.join(filePath, 'index.html'), {
        scriptFile: 'sketch.js',
        title: sketchName
      });
      break;
    case 'script':
      if (!/\.js/i.test(filePath)) filePath += '.js';
      sketch = Sketch.create(filePath);
      break;
    case 'html': {
      if (!/\.html?/i.test(filePath)) filePath += '.html';

      // find a unique name for the script file
      const dir = path.dirname(filePath);
      const baseName = sketchName.replace(/(\.html?)?$/i, '');
      let scriptFile = 'sketch.js';
      if (await fileExists(path.join(dir, scriptFile))) scriptFile = baseName + '.js';
      // find a unique filename but appending successive numbers
      for (let i = 1; await fileExists(path.join(dir, scriptFile)); i++) {
        scriptFile = `${baseName}-${i}.js`;
      }

      sketch = Sketch.create(filePath, { scriptFile });
      break;
    }
  }

  try {
    await sketch.generate();
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    window.showErrorMessage(`Failed to generate sketch: ${errorMessage}`);
    console.error('Sketch generation failed:', e);
    return;
  }

  window.showTextDocument(Uri.file(sketch.scriptFilePath));
  vscode.commands.executeCommand('p5-server.explorer.refresh');
}

export async function deleteSketch(sketch: Sketch) {
  // TODO: check whether any of these are used by other sketches
  // TODO: close any open editors and run windows
  const files = sketch.files.map(file => path.join(sketch.dir, file));
  const result = await window.showInformationMessage(
    files.length === 1
      ? `Are you sure you want to delete '${files.join(' ')}'?`
      : `Are you sure you want to delete the following files: ${files.map(s => `'${s}'`).join(', ')}?`,
    'Delete',
    'Cancel'
  );
  if (result !== 'Delete') return;
  await Promise.all(files.map(Uri.file).map(uri => workspace.fs.delete(uri)));
}