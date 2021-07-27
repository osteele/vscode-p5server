import * as vscode from 'vscode';
import { Server } from 'p5-server';

export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "p5-server" is now active!');
  let server: Server = null;

  context.subscriptions.push(vscode.commands.registerCommand('p5-server.start', () => {
    const wsFolders = vscode.workspace?.workspaceFolders;
    const wsPath = wsFolders ? wsFolders[0].uri.fsPath : '.';
    console.log(`Starting server at ${wsPath}`);
    server?.stop();
    server = new Server({ root: wsPath }).start((url: string) => {
      vscode.window.showInformationMessage(`p5-server is at ${url}`);
    });
  }));

  context.subscriptions.push(vscode.commands.registerCommand('p5-server.stop', () => {
    console.log('Stopping server');
    server?.stop();
    server = null;
    vscode.window.showInformationMessage('p5-server is stopped!');
  }));
}

export function deactivate() { }
