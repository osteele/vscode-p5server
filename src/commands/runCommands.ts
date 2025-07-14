import { Library } from 'p5-server';
import * as vscode from 'vscode';
import { commands, Uri, window } from 'vscode';

export function runSketch() {
  const editorPath = window.activeTextEditor?.document.fileName;
  return commands.executeCommand('p5-server.openBrowser', editorPath ? Uri.file(editorPath) : undefined);
}

export function runSketchInBrowser() {
  const editorPath = window.activeTextEditor?.document.fileName;
  return commands.executeCommand('p5-server.openBrowser', editorPath ? Uri.file(editorPath) : undefined, {
    browser: 'external'
  });
}

export function runSketchInSidebar() {
  const editorPath = window.activeTextEditor?.document.fileName;
  return commands.executeCommand('p5-server.openBrowser', editorPath ? Uri.file(editorPath) : undefined, {
    browser: 'integrated'
  });
}

export function openSettings() {
  return commands.executeCommand('workbench.action.openSettings', 'p5-server');
}

export function openLibraryPane(library: Library) {
  const enableIntegratedLibraryBrowser = false;
  if (!enableIntegratedLibraryBrowser) {
    return commands.executeCommand('vscode.open', Uri.parse(library.homepage));
    // return commands.executeCommand('simpleBrowser.api.open', Uri.parse(library.homepage));
  }
  const panel = vscode.window.createWebviewPanel('p5LibraryHomepage', library.name, vscode.ViewColumn.One, {
    enableScripts: true
  });
  panel.webview.html = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="ie=edge">
        <title>${library.name}</title>
        <style type="text/css">
          body,html {
            height: 100%;
            min-height: 100%;
            padding: 0;
            margin: 0;
          }
          iframe {
            width: 100%;
            height: 100%;
            border: none;
            background: white;
          }
        </style>
      </head>
      <body>
          <iframe src="${library.homepage}"></iframe>
      </body>
    </html>
  `;
}