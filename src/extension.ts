import * as vscode from 'vscode';
import { Sketch } from 'p5-server';
import path = require('path');
import { Uri, window } from 'vscode';
import { SketchTreeProvider } from './sketchExplorer';
import { ServerManager } from './serverManager';

export function activate(context: vscode.ExtensionContext) {
  const rootPath =
    vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
      ? vscode.workspace.workspaceFolders[0].uri.fsPath
      : undefined;

  // create sketch explorer
  const sketchTreeProvider = new SketchTreeProvider(rootPath);
  vscode.window.registerTreeDataProvider('p5sketchExplorer', sketchTreeProvider);

  // register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('p5-explorer.refresh', () => sketchTreeProvider.refresh())
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('p5-server.createSketchFile', createSketch.bind(null, false))
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('p5-server.createSketchFolder', createSketch.bind(null, true))
  );

  // set context variable
  if (rootPath) {
    vscode.commands.executeCommand('setContext', 'p5-server.available', Boolean(rootPath));
    ServerManager.activate(context);
  }

  async function createSketch(folder: boolean) {
    const folders = vscode.workspace.workspaceFolders;
    if (folders && folders.length > 0) {
      window.showErrorMessage('You must have at least one folder open to create a sketch.');
    }

    let sketchName = await vscode.window.showInputBox({
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

    const wsFolders = vscode.workspace?.workspaceFolders;
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
      vscode.window.showErrorMessage(e.message);
      console.error(e.message);
      return;
    }

    vscode.window.showTextDocument(Uri.file(path.join(sketch.dir, sketch.scriptFile)));
    vscode.commands.executeCommand('p5-explorer.refresh');
    vscode.commands.executeCommand('revealInExplorer', dirPath);
  }
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
export function deactivate() {}
