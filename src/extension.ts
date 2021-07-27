import * as vscode from 'vscode';
import { Server } from 'p5-server';

export function activate(context: vscode.ExtensionContext) {
  let server: Server = null;

  console.log('Congratulations, your extension "p5-server" is now active!');

  const statusBarOpenItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarOpenItem.tooltip = "Click to start the p5 server";
  statusBarOpenItem.command = 'p5-server.open-in-browser';

  const statusBarToggleItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  defaultStatusBar();
  statusBarToggleItem.show();

  context.subscriptions.push(vscode.commands.registerCommand('p5-server.start', () => {
    const wsFolders = vscode.workspace?.workspaceFolders;
    const wsPath = wsFolders ? wsFolders[0].uri.fsPath : '.';
    server?.stop();
    statusBarOpenItem.hide();
    let sbm = vscode.window.setStatusBarMessage(`Starting p5 server at ${wsPath}`);
    server = new Server({ root: wsPath }).start((url: string) => {
      sbm.dispose();
      sbm = vscode.window.setStatusBarMessage(`p5-server is running at ${url}`);
      setTimeout(() => sbm.dispose(), 10000);

      statusBarToggleItem.text = "Stop p5-server";
      statusBarToggleItem.tooltip = "Stop p5-server";
      statusBarToggleItem.command = 'p5-server.stop';

      statusBarOpenItem.text = `Open a browser`;
      statusBarOpenItem.tooltip = `Open ${url} in a browser`;
      statusBarOpenItem.show();
    });
  }));

  context.subscriptions.push(vscode.commands.registerCommand('p5-server.stop', () => {
    if (!server) { return; }

    let sbm = vscode.window.setStatusBarMessage("Shutting down the p5 server…");

    server.stop();
    server = null;
    sbm = vscode.window.setStatusBarMessage('p5 server has been shut down.');
    setTimeout(() => sbm.dispose(), 10000);

    defaultStatusBar();
    statusBarOpenItem.hide();
    sbm.dispose();
  }));

  context.subscriptions.push(vscode.commands.registerCommand('p5-server.open-in-browser', () => {
    vscode.window.showInformationMessage(`Server ${server} ${server.url}`);
    if (server?.url) {
      vscode.window.showInformationMessage(`TODO: open ${server.url} in a browser`);
    }
  }));

  function defaultStatusBar() {
    statusBarToggleItem.text = "Start p5-server";
    statusBarToggleItem.tooltip = "Click to start the p5 server";
    statusBarToggleItem.command = 'p5-server.start';
  }
}

export function deactivate() { }
