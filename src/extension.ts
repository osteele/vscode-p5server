import * as vscode from 'vscode';
import { Server, Sketch } from 'p5-server';
import open = require('open');
import path = require('path');
import { Uri, window } from 'vscode';
import { SketchTreeProvider } from './sketchExplorer';

export function activate(context: vscode.ExtensionContext) {
  let server: Server | null;
  let state: "stopped" | "starting" | "running" | "stopping" = "stopped";
  let wsPath: string | undefined;

  const rootPath = (vscode.workspace.workspaceFolders && (vscode.workspace.workspaceFolders.length > 0))
    ? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined;
  const sketchTreeProvider = new SketchTreeProvider(rootPath);
  vscode.window.registerTreeDataProvider('p5sketchExplorer', sketchTreeProvider);
  vscode.commands.registerCommand('p5sketchExplorer.refresh', () =>
    sketchTreeProvider.refresh()
  );

  if (!vscode.workspace.workspaceFolders) {
    return;
  }

  const statusBarOpenItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarOpenItem.text = `$(ports-open-browser-icon)Browse P5 sketch`;
  statusBarOpenItem.command = 'extension.p5-server.open-in-browser';

  const statusBarServerItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  updateStatusBarItems();
  statusBarServerItem.show();

  context.subscriptions.push(vscode.commands.registerCommand('extension.p5-server.start', startServer));
  context.subscriptions.push(vscode.commands.registerCommand('extension.p5-server.stop', stopServer));
  context.subscriptions.push(vscode.commands.registerCommand('extension.p5-server.open-in-browser', () => {
    if (state === 'stopped') {
      startServer();
    } else if (state === 'running' && server?.url) {
      openBrowser();
    }
  }));
  context.subscriptions.push(vscode.commands.registerCommand('extension.p5-server.create-sketch-file', createSketch.bind(null, false)));
  context.subscriptions.push(vscode.commands.registerCommand('extension.p5-server.create-sketch-folder', createSketch.bind(null, true)));

  function updateStatusBarItems() {
    switch (state) {
      case 'running':
        statusBarServerItem.text = "$(extensions-star-full)P5 Server";
        statusBarServerItem.tooltip = "Stop the P5 server";
        statusBarServerItem.command = 'extension.p5-server.stop';
        statusBarOpenItem.tooltip = `Open ${server!.url} in a browser`;
        break;
      case 'stopped':
        statusBarServerItem.text = "$(extensions-star-empty)P5 Server";
        statusBarServerItem.tooltip = "Click to start the P5 server";
        statusBarServerItem.command = 'extension.p5-server.start';
        break;
      case 'starting':
        statusBarServerItem.text = "$(extensions-star-full~spin)P5 Server";
        statusBarServerItem.tooltip = "The P5 server is starting…";
        break;
      case 'stopping':
        statusBarServerItem.text = "$(extensions-star-empty~spin)P5 Server";
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
      const wsFolders = vscode.workspace?.workspaceFolders?.map(f => f.uri.fsPath) || [];
      wsPath = wsFolders.length > 1
        ? await vscode.window.showQuickPick(
          wsFolders,
          { placeHolder: 'Select a folder to serve' })
        : (wsFolders[0] || '.');
      if (!wsPath) { return; }

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

    } finally {
      if (state !== 'running') {
        state = 'stopped';
      }
      updateStatusBarItems();
    }
    openBrowser();
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

    vscode.window.showTextDocument(Uri.file(path.join(sketch.dirPath, sketch.jsSketchPath)));
    vscode.commands.executeCommand('p5sketchExplorer.refresh');
    vscode.commands.executeCommand("revealInExplorer", dirPath);
  }

  function openBrowser() {
    if (!server?.url || !wsPath) {
      return;
    }

    // TODO if it's a js file associated with a sketch, open the sketch instead
    let editorPath = window.activeTextEditor?.document.fileName;
    if (editorPath) {
      editorPath = path.relative(wsPath, editorPath);
    }
    const reqPath = editorPath && /\.(js|html)/.test(editorPath) && !/^(\.){1,2}\//.test(editorPath)
      ? '/' + editorPath
      : '';
    open(server.url + reqPath);
  }
}

export function deactivate() { }
