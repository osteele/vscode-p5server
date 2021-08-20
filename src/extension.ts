import { Sketch } from 'p5-server';
import * as vscode from 'vscode';
import { commands, Uri, window, workspace } from 'vscode';
import { ServerManager } from './serverManager';
import { SketchTreeProvider } from './sketchExplorer';
import { getWorkspaceFolderPaths } from './utils';
import path = require('path');

export function activate(context: vscode.ExtensionContext) {
  const workspaceFolderPaths = getWorkspaceFolderPaths();

  // create sketch explorer
  const sketchTreeProvider = new SketchTreeProvider(workspaceFolderPaths);
  window.registerTreeDataProvider('p5sketchExplorer', sketchTreeProvider);

  // register commands
  context.subscriptions.push(commands.registerCommand('p5-explorer.refresh', () => sketchTreeProvider.refresh()));
  context.subscriptions.push(commands.registerCommand('p5-server.createSketchFile', createSketch.bind(null, false)));
  context.subscriptions.push(commands.registerCommand('p5-server.createSketchFolder', createSketch.bind(null, true)));

  // create server manager and set context variable
  if (getWorkspaceFolderPaths().length >= 1) {
    ServerManager.activate(context);
    commands.executeCommand('setContext', 'p5-server.available', true);
  }

  async function createSketch(folder: boolean) {
    const folders = workspace.workspaceFolders;
    if (folders && folders.length > 0) {
      window.showErrorMessage('You must have at least one folder open to create a sketch.');
    }

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

    const wsFolders = workspace?.workspaceFolders;
    const wsPath = wsFolders ? wsFolders[0].uri.fsPath : '.';

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
    commands.executeCommand('revealInExplorer', dirPath);
  }
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
export function deactivate() {}
