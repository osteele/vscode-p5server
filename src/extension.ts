import * as vscode from 'vscode';
import { commands, workspace } from 'vscode';
import { registerCommands } from './commands';
import { ReleaseNotes } from './releaseNotes';
import { ServerManager } from './serverManager';
import { SketchExplorer } from './tree';
import { getWorkspaceFolderPaths } from './helpers/fileHelpers';
import { Configuration } from './configuration';

export function activate(context: vscode.ExtensionContext) {
  new SketchExplorer(context);

  registerCommands(context);
  workspace.onDidChangeConfiguration(Configuration.update);
  Configuration.update();

  // Always initialize ServerManager to ensure all commands are registered.
  // This fixes "Command 'p5-server.openBrowser' not found" errors.
  // The server itself is lazy-loaded and only starts when needed, so there's
  // minimal performance impact from always initializing the manager.
  ServerManager.activate(context);
  
  // Set context variable when workspace folders are available
  if (getWorkspaceFolderPaths().length >= 1) {
    commands.executeCommand('setContext', 'p5-server.available', true);
  }

  const releaseNoteManager = new ReleaseNotes(context);
  releaseNoteManager.showStartupMessageIfNewVersion();
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
export function deactivate() {}
