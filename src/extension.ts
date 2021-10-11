import * as vscode from 'vscode';
import { commands } from 'vscode';
import { registerCommands } from './sketchCommands';
import { ReleaseNotes } from './releaseNotes';
import { ServerManager } from './serverManager';
import { SketchExplorer } from './sketchExplorer';
import { getWorkspaceFolderPaths } from './utils';

export function activate(context: vscode.ExtensionContext) {
  // create sketch explorer
  new SketchExplorer(context);

  registerCommands(context);

  // create server manager and set context variable
  if (getWorkspaceFolderPaths().length >= 1) {
    ServerManager.activate(context);
    commands.executeCommand('setContext', 'p5-server.available', true);
  }

  const releaseNoteManager = new ReleaseNotes(context);
  releaseNoteManager.showStartupMessage();
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
export function deactivate() {}
