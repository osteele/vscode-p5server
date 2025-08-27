import * as vscode from 'vscode';
import { commands, workspace } from 'vscode';
import { registerCommands } from './commands';
import { ReleaseNotes } from './releaseNotes';
import { ServerManager } from './serverManager';
import { SketchExplorer } from './tree';
import { getWorkspaceFolderPaths } from './helpers/fileHelpers';
import { Configuration } from './configuration';

let configUpdateTimer: NodeJS.Timeout | undefined;

export function activate(context: vscode.ExtensionContext) {
  new SketchExplorer(context);

  registerCommands(context);

  // Debounce configuration updates to prevent excessive calls
  const debouncedConfigUpdate = () => {
    if (configUpdateTimer) {
      clearTimeout(configUpdateTimer);
    }
    configUpdateTimer = setTimeout(() => {
      Configuration.update();
      configUpdateTimer = undefined;
    }, 500); // Wait 500ms after last change before updating
  };

  context.subscriptions.push(workspace.onDidChangeConfiguration(debouncedConfigUpdate));
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

export async function deactivate() {
  // Clean up any pending configuration update timer
  if (configUpdateTimer) {
    clearTimeout(configUpdateTimer);
    configUpdateTimer = undefined;
  }

  // Dispose ServerManager if it exists
  const serverManager = ServerManager.getInstance();
  if (serverManager) {
    await serverManager.dispose();
  }
}
