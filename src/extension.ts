import * as vscode from 'vscode';
import { Server, Sketch } from 'p5-server';
import open = require('open');
import path = require('path');
import { Uri } from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  let server: Server | null;
  let state: "stopped" | "starting" | "running" | "stopping" = "stopped";

  const statusBarOpenItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarOpenItem.text = `$(ports-open-browser-icon) Open P5 browser`;
  statusBarOpenItem.command = 'extension.p5-server.open-in-browser';

  const statusBarServerItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  updateStatusBarItems();
  statusBarServerItem.show();

  context.subscriptions.push(vscode.commands.registerCommand('extension.p5-server.start', startServer));
  context.subscriptions.push(vscode.commands.registerCommand('extension.p5-server.stop', stopServer));
  context.subscriptions.push(vscode.commands.registerCommand('extension.p5-server.open-in-browser', () => {
    if (!server) {
      startServer();
    } else if (server?.url) {
      open(server.url);
    }
  }));
  context.subscriptions.push(vscode.commands.registerCommand('extension.p5-server.create-sketch-file', createSketch.bind(null, false)));
  context.subscriptions.push(vscode.commands.registerCommand('extension.p5-server.create-sketch-folder', createSketch.bind(null, true)));

  function updateStatusBarItems() {
    switch (state) {
      case 'running':
        statusBarServerItem.text = "$(extensions-star-full) P5 Server";
        statusBarServerItem.tooltip = "Stop the P5 server";
        statusBarServerItem.command = 'extension.p5-server.stop';
        statusBarOpenItem.tooltip = `Open ${server!.url} in a browser`;
        break;
      case 'stopped':
        statusBarServerItem.text = "$(extensions-star-empty) P5 Server";
        statusBarServerItem.tooltip = "Click to start the P5 server";
        statusBarServerItem.command = 'extension.p5-server.start';
        break;
      case 'starting':
        statusBarServerItem.text = "$(extensions-star-full~spin) P5 Server";
        statusBarServerItem.tooltip = "The P5 server is starting…";
        break;
      case 'stopping':
        statusBarServerItem.text = "$(extensions-star-empty~spin) P5 Server";
        statusBarServerItem.tooltip = "The P5 server is stopping";
        break;
    }
    if (state === 'running') {
      statusBarOpenItem.show();
    } else {
      statusBarOpenItem.hide();
    }
  }

  async function startServer() {
    if (state !== 'stopped') { return; }
    state = 'starting';

    try {
      const wsFolders = vscode.workspace?.workspaceFolders;
      const wsPath = wsFolders ? wsFolders[0].uri.fsPath : '.';

      server?.stop();
      server = null;

      let sbm = vscode.window.setStatusBarMessage(`Starting the P5 server at ${wsPath}`);

      statusBarServerItem.text = "$(extensions-star-empty) P5 Server";
      server = new Server({ root: wsPath });
      await server.start();
      state = 'running';

      sbm.dispose();
      sbm = vscode.window.setStatusBarMessage(`p5-server is running at ${server.url}`);
      setTimeout(() => sbm.dispose(), 10000);

      if (server.url) {
        open(server.url);
      }
    } finally {
      if (state !== 'running') {
        state = 'stopped';
      }
      updateStatusBarItems();
    }
  }

  function stopServer() {
    if (!server) { return; }
    if (state !== 'running') { return; }
    state = 'stopping';

    let sbm = vscode.window.setStatusBarMessage("Shutting down the p5 server…");

    server.stop();
    server = null;
    state = 'stopped';

    sbm.dispose();
    sbm = vscode.window.setStatusBarMessage('The P5 server is no longer running.');
    setTimeout(() => sbm.dispose(), 10000);

    updateStatusBarItems();
  }

  async function createSketch(folder: boolean) {
    let sketchName = await vscode.window
      .showInputBox({
        value: ``,
        prompt: `Enter the name of the p5.js sketch`,
        ignoreFocusOut: true,
      });
    if (!sketchName) { return; }
    sketchName = sketchName.trim();
    if (sketchName.length === 0) { return; }
    if (!folder && !sketchName.endsWith('.js')) {
      sketchName += '.js';
    }

    const wsFolders = vscode.workspace?.workspaceFolders;
    const wsPath = wsFolders ? wsFolders[0].uri.fsPath : '.';

    const filePath = path.join(wsPath, sketchName);
    const dirPath = path.dirname(filePath);
    const basePath = path.basename(sketchName);
    const sketch = folder
      ? new Sketch(filePath, 'index.html', 'sketch.js', { title: sketchName })
      : new Sketch(dirPath, null, basePath);
    try {
      sketch.generate();
    } catch (e) {
      vscode.window.showErrorMessage(e.message);
      console.error(e.message);
      return;
    }

    vscode.commands.executeCommand("revealInExplorer", dirPath);
    vscode.window.showTextDocument(Uri.file(path.join(sketch.dirPath, sketch.jsSketchPath)));
  }
}

export function deactivate() { }
