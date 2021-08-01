import * as vscode from 'vscode';
import { Server, Sketch } from 'p5-server';
import open = require('open');
import path = require('path');
import { Uri, window } from 'vscode';
import { SketchTreeProvider } from './sketchExplorer';

export function activate(context: vscode.ExtensionContext) {
  let servicesAvailable = false;
  let server: Server | null;
  let state: "stopped" | "starting" | "running" | "stopping" = "stopped";
  let wsPath: string | undefined;

  const rootPath = (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0)
    ? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined;
  const sketchTreeProvider = new SketchTreeProvider(rootPath);
  vscode.window.registerTreeDataProvider('p5sketchExplorer', sketchTreeProvider);

  context.subscriptions.push(vscode.commands.registerCommand('p5-explorer.refresh', () => sketchTreeProvider.refresh()));

  context.subscriptions.push(vscode.commands.registerCommand('p5-server.createSketchFile', createSketch.bind(null, false)));
  context.subscriptions.push(vscode.commands.registerCommand('p5-server.createSketchFolder', createSketch.bind(null, true)));

  if (!vscode.workspace.workspaceFolders) {
    return;
  }
  servicesAvailable = true;
  vscode.commands.executeCommand('setContext', 'p5-server.available', servicesAvailable);

  const statusBarOpenItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarOpenItem.text = `$(ports-open-browser-icon)P5 Browser`;
  statusBarOpenItem.command = 'p5-server.openBrowser';

  const statusBarServerItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  updateStatusBarItems();

  context.subscriptions.push(vscode.commands.registerCommand('p5-server.start', startServer));
  context.subscriptions.push(vscode.commands.registerCommand('p5-server.stop', stopServer));
  context.subscriptions.push(vscode.commands.registerCommand('p5-server.openInBrowser', () => {
    const editorPath = window.activeTextEditor?.document.fileName;
    vscode.commands.executeCommand('p5-server.openBrowser', editorPath ? Uri.file(editorPath) : undefined);
  }));
  context.subscriptions.push(vscode.commands.registerCommand('p5-server.openBrowser', (uri?: Uri) => {
    if (state === 'stopped') {
      startServer(uri);
    } else if (state === 'running') {
      openBrowser(uri);
    }
  }));
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(updateFromConfiguration));

  updateFromConfiguration();

  function updateFromConfiguration() {
    const config = vscode.workspace.getConfiguration('p5-server');
    const runIconEnabled = config.get('editorTitle.RunIcon.enabled', true);
    vscode.commands.executeCommand('setContext', 'p5-server.runIconEnabled', runIconEnabled);
    updateStatusBarItems();
  }

  function updateStatusBarItems() {
    switch (state) {
      case 'running': {
        const browserName = vscode.workspace.getConfiguration('p5-server').get<string>('browser', 'default');
        statusBarServerItem.text = "$(extensions-star-full)P5 Server";
        statusBarServerItem.tooltip = "Stop the P5 server";
        statusBarServerItem.command = 'p5-server.stop';
        statusBarOpenItem.tooltip = `Open ${server!.url} in the ${browserName} browser`;
      }
        break;
      case 'stopped':
        statusBarServerItem.text = "$(extensions-star-empty)P5 Server";
        statusBarServerItem.tooltip = "Click to start the P5 server";
        statusBarServerItem.command = 'p5-server.start';
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
    const config = vscode.workspace.getConfiguration('p5-server');
    if (config.get<boolean>('statusBar.browserItem.enabled', true) && state === 'running') {
      statusBarOpenItem.show();
    } else {
      statusBarOpenItem.hide();
    }
    if (config.get<boolean>('statusBar.serverItem.enabled', true)) {
      statusBarServerItem.show();
    } else {
      statusBarServerItem.hide();
    }
  }

  async function startServer(uri?: Uri) {
    if (state !== 'stopped') { return; }
    state = 'starting';

    try {
      const wsFolders = vscode.workspace?.workspaceFolders?.map(f => f.uri.fsPath) || [];
      // TODO: select the folder that contains uri
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
    openBrowser(uri);
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
    if (!servicesAvailable) {
      window.showErrorMessage("You must have at least one folder open to create a sketch.");
    }

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
    vscode.commands.executeCommand('p5-explorer.refresh');
    vscode.commands.executeCommand("revealInExplorer", dirPath);
  }

  async function openBrowser(uri?: Uri) {
    if (!server?.url || !wsPath) {
      return;
    }

    type BrowserKey = open.AppName | 'safari' | 'default';
    const browserName = vscode.workspace.getConfiguration('p5-server').get<string>('browser', 'default');
    const browserKey = browserName.toLowerCase() as BrowserKey;
    let openOptions: open.Options | undefined;
    if (browserKey !== 'default') {
      let name = browserKey === 'safari' ? browserKey : open.apps[browserKey];
      openOptions = { app: { name } };
    }

    const url = uri ? `${server.url}/${path.relative(wsPath, uri.fsPath)}` : server.url;
    let process = await open(url, openOptions);
    if (process.exitCode === null) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    if (process.exitCode !== 0) {
      let msg = "The browser failed to open.";
      if (browserKey !== 'default') {
        msg += ` The ${browserName} browser may not be available on your system.`;
      }
      vscode.window.showErrorMessage(msg);
    }
  }
}

export function deactivate() { }
