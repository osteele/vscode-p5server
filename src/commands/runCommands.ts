import { Library } from 'p5-server';
import { commands, env, Uri, window } from 'vscode';

export function runSketch() {
  return commands.executeCommand('p5-server.openBrowser', window.activeTextEditor?.document.uri);
}

export function runSketchInBrowser() {
  return commands.executeCommand('p5-server.openBrowser', window.activeTextEditor?.document.uri, {
    browser: 'external',
  });
}

export function runSketchInSidebar() {
  return commands.executeCommand('p5-server.openBrowser', window.activeTextEditor?.document.uri, {
    browser: 'integrated',
  });
}

export function openSettings() {
  return commands.executeCommand('workbench.action.openSettings', 'p5-server');
}

export function openLibraryPane(library: Library) {
  return env.openExternal(Uri.parse(library.homepage));
}
