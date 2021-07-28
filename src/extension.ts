import * as vscode from 'vscode';
import { Server, Sketch } from 'p5-server';
import open = require('open');
import path = require('path');
import { Uri } from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  let server: Server | null;

  console.log('Congratulations, your extension "p5-server" is now active!');
  console.info(Server);

  const statusBarOpenItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarOpenItem.tooltip = "Click to start the p5 server";
  statusBarOpenItem.command = 'extension.p5-server.open-in-browser';

  const statusBarToggleItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  updateStatusBarItems();
  statusBarToggleItem.show();

  context.subscriptions.push(vscode.commands.registerCommand('extension.p5-server.start', startServer));
  context.subscriptions.push(vscode.commands.registerCommand('extension.p5-server.stop', stopServer));
  context.subscriptions.push(vscode.commands.registerCommand('extension.p5-server.open-in-browser', () => {
    if (!server) {
      startServer();
    } else if (server?.url) {
      open(server.url);
    }
  }));
  context.subscriptions.push(vscode.commands.registerCommand('extension.p5-server.create-sketch', async () => {
    let sketchName = await vscode.window
      .showInputBox({
        value: ``,
        prompt: `Enter the name of the p5.js sketch`,
        ignoreFocusOut: true,
      });
    if (!sketchName) { return; }
    sketchName = sketchName.trim();
    if (sketchName.length === 0) { return; }
    if (!sketchName.endsWith('.js')) {
      sketchName += '.js';
    }

    const wsFolders = vscode.workspace?.workspaceFolders;
    const wsPath = wsFolders ? wsFolders[0].uri.fsPath : '.';

    const filePath = path.join(wsPath, sketchName);
    const dirPath = path.dirname(filePath);
    const basePath = path.basename(sketchName);
    const sketch = new Sketch(dirPath, null, basePath);
    try {
      sketch.generate();
    } catch (e) {
      vscode.window.showErrorMessage(e.message);
      console.error(e.message);
      return;
    }

    vscode.commands.executeCommand("revealInExplorer", dirPath);
    vscode.window.showTextDocument(Uri.file(filePath));
  }));

  function updateStatusBarItems() {
    statusBarToggleItem.text = "$(extensions-star-empty) P5 Server";
    statusBarToggleItem.tooltip = "Click to start the p5 server";
    statusBarToggleItem.command = 'extension.p5-server.start';
  }

  async function startServer() {
    const wsFolders = vscode.workspace?.workspaceFolders;
    const wsPath = wsFolders ? wsFolders[0].uri.fsPath : '.';

    server?.stop();
    statusBarOpenItem.hide();
    let sbm = vscode.window.setStatusBarMessage(`Starting p5 server at ${wsPath}`);

    server = new Server({ root: wsPath });
    await server.start();
    sbm.dispose();
    sbm = vscode.window.setStatusBarMessage(`p5-server is running at ${server.url}`);
    setTimeout(() => sbm.dispose(), 10000);

    statusBarToggleItem.text = "$(extensions-star-full) P5 Server";
    statusBarToggleItem.tooltip = "Stop p5-server";
    statusBarToggleItem.command = 'extension.p5-server.stop';

    statusBarOpenItem.text = `$(ports-open-browser-icon) Open P5 browser`;
    statusBarOpenItem.tooltip = `Open ${server.url} in a browser`;
    statusBarOpenItem.command = 'extension.p5-server.open-in-browser';
    statusBarOpenItem.show();

    if (server.url) {
      open(server.url);
    }
  }

  function stopServer() {
    if (!server) { return; }

    let sbm = vscode.window.setStatusBarMessage("Shutting down the p5 server…");

    server.stop();
    server = null;

    sbm.dispose();
    sbm = vscode.window.setStatusBarMessage('The p5 server has been shut down.');
    setTimeout(() => sbm.dispose(), 10000);

    updateStatusBarItems();
    statusBarOpenItem.hide();
  }
}

export function deactivate() { }
