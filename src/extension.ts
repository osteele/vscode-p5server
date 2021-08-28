import * as vscode from 'vscode';
import { commands, window, workspace } from 'vscode';
import { createSketch, duplicateSketch } from './commands';
import { ServerManager } from './serverManager';
import { SketchTreeProvider } from './sketchExplorer';
import { getWorkspaceFolderPaths } from './utils';

export function activate(context: vscode.ExtensionContext) {
  // create sketch explorer
  const sketchTreeProvider = new SketchTreeProvider();
  window.registerTreeDataProvider('p5sketchExplorer', sketchTreeProvider);
  context.subscriptions.push(workspace.onDidChangeWorkspaceFolders(() => sketchTreeProvider.refresh()));
  sketchTreeProvider.registerCommands(context);

  // register commands
  context.subscriptions.push(commands.registerCommand('p5-server.createSketchFile', createSketch.bind(null, false)));
  context.subscriptions.push(commands.registerCommand('p5-server.createSketchFolder', createSketch.bind(null, true)));
  context.subscriptions.push(commands.registerCommand('p5-server.duplicateSketch', duplicateSketch));

  // create server manager and set context variable
  if (getWorkspaceFolderPaths().length >= 1) {
    ServerManager.activate(context);
    commands.executeCommand('setContext', 'p5-server.available', true);
  }
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
export function deactivate() {}
