import * as vscode from 'vscode';
import { registerCommands } from './commands';
import { ReleaseNotes } from './releaseNotes';
import { ServerManager } from './serverManager';
import { SketchExplorer } from './tree';

export function activate(context: vscode.ExtensionContext) {
  new SketchExplorer(context);

  registerCommands(context);

  // Always initialize ServerManager to ensure all commands are registered.
  // This fixes "Command 'p5-server.openBrowser' not found" errors.
  // The server itself is lazy-loaded and only starts when needed, so there's
  // minimal performance impact from always initializing the manager.
  ServerManager.activate(context);

  const releaseNoteManager = new ReleaseNotes(context);
  releaseNoteManager.showStartupMessageIfNewVersion();
}

export async function deactivate() {
  // Dispose ServerManager if it exists
  const serverManager = ServerManager.getInstance();
  if (serverManager) {
    await serverManager.dispose();
  }
}
