import { ChildProcess } from 'child_process';
import { Server } from 'p5-server';
import * as vscode from 'vscode';
import { commands, Uri, window, workspace } from 'vscode';
import { getWorkspaceFolderPaths } from './utils';
import open = require('open');
import path = require('path');

type ServerState = 'stopped' | 'starting' | 'running' | 'stopping';

export class ServerManager {
  private server: Server | null = null;
  private _state: ServerState = 'stopped';
  private wsPath: string | undefined;
  private statusBarManager: StatusBarManager;
  private _sketchConsole: vscode.OutputChannel | null = null;

  constructor(context: vscode.ExtensionContext) {
    this.statusBarManager = new StatusBarManager();
    this.registerCommands(context);
  }

  static activate(context: vscode.ExtensionContext) {
    new ServerManager(context);
  }

  private registerCommands(context: vscode.ExtensionContext) {
    context.subscriptions.push(commands.registerCommand('p5-server.start', this.startServer.bind(this)));
    context.subscriptions.push(commands.registerCommand('p5-server.stop', this.stopServer.bind(this)));
    context.subscriptions.push(
      commands.registerCommand('p5-server.openInBrowser', () => {
        const editorPath = window.activeTextEditor?.document.fileName;
        commands.executeCommand('p5-server.openBrowser', editorPath ? Uri.file(editorPath) : undefined);
      })
    );
    context.subscriptions.push(
      commands.registerCommand('p5-server.openBrowser', async (uri?: Uri) => {
        if (this.state === 'stopped') {
          await this.startServer(uri);
        } else if (this.state === 'running') {
          await this.openBrowser(uri);
        }
      })
    );

    context.subscriptions.push(workspace.onDidChangeConfiguration(this.updateFromConfiguration.bind(this)));
    this.updateFromConfiguration();
  }

  updateFromConfiguration() {
    const config = workspace.getConfiguration('p5-server');
    const runIconEnabled = config.get('editorTitle.RunIcon.enabled', true);
    commands.executeCommand('setContext', 'p5-server.runIconEnabled', runIconEnabled);
    this.updateStatusBar();
  }

  updateStatusBar() {
    this.statusBarManager.update(this.server, this.state);
  }

  get state() {
    return this._state;
  }

  set state(state: ServerState) {
    this._state = state;
    this.updateStatusBar();
  }

  private get sketchConsole() {
    if (!this._sketchConsole) {
      this._sketchConsole = window.createOutputChannel('P5-Sketch');
    }
    return this._sketchConsole;
  }

  async startServer(uri?: Uri) {
    if (this.state !== 'stopped') {
      return;
    }

    this.state = 'starting';
    try {
      const wsFolders = getWorkspaceFolderPaths();
      // TODO: select the folder that contains uri
      const root =
        wsFolders.length > 1
          ? await window.showQuickPick(wsFolders, {
              placeHolder: 'Select a folder to serve'
            })
          : wsFolders[0] || '.';
      if (!root) return; // the user cancelled

      this.server?.stop();
      this.server = null;

      let sbm = window.setStatusBarMessage(`Starting the P5 server at ${root}`);

      this.server = new Server({ root, relayConsoleMessages: true });
      await this.server.start();
      this.wsPath = root;
      this.state = 'running';

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.server.onSketchEvent('console', (data: { method: string; args: any[] }) => {
        const { method, args } = data;
        if (method === 'clear') {
          this.sketchConsole.clear();
        } else {
          this.maybeShowConsole(method);
          this.sketchConsole.appendLine(`${method}: ${args.join(' ')}`);
        }
      });
      this.server.onSketchEvent(
        'error',
        (data: { message: string; file?: string; url?: string; line?: number; stack?: string }) => {
          const { message, url, file, line, stack } = data;
          this.maybeShowConsole('error');
          let msg = 'Error';
          if (line) {
            msg += ` at line ${line}`;
          }
          if (file || url) {
            msg += ` of ${file || url}`;
          }
          this.sketchConsole.appendLine(stack || `${msg}: ${message}`);
        }
      );
      this.server.onSketchEvent('window', ({ event }: { event: string }) => {
        if (event === 'load') {
          this.maybeShowConsole('always');
          this.sketchConsole.appendLine('='.repeat(80));
        }
      });

      sbm.dispose();
      sbm = window.setStatusBarMessage(`p5-server is running at ${this.server.url}`);
      setTimeout(() => sbm.dispose(), 10000);
    } finally {
      if (this.state !== 'running') {
        this.state = 'stopped';
      }
    }
    this.openBrowser(uri);
  }

  maybeShowConsole(level: string) {
    const browser = workspace.getConfiguration('p5-server').get('browser', 'integrated');
    const [configKey, defaultValue] =
      browser === 'integrated' ? ['integratedBrowser', 'info'] : ['externalBrowser', 'error'];
    const levels = ['error', 'warn', 'log', 'info', 'debug', 'always'];
    const threshold = workspace.getConfiguration('p5-server.console').get(configKey + '.autoShow.level', defaultValue);
    if (levels.includes(level) && threshold !== 'never' && levels.indexOf(level) <= levels.indexOf(threshold)) {
      this.sketchConsole.show();
    }
  }

  async stopServer() {
    if (!this.server) {
      return;
    }
    if (this.state !== 'running') {
      return;
    }
    this.state = 'stopping';

    let sbm = window.setStatusBarMessage('Shutting down the P5 server…');

    await this.server.stop();
    this.server = null;
    this.state = 'stopped';

    sbm.dispose();
    sbm = window.setStatusBarMessage('The P5 server is no longer running.');
    setTimeout(() => sbm.dispose(), 10000);
  }

  async openBrowser(uri?: Uri) {
    const server = this.server;
    if (!server?.url || !this.wsPath) {
      return;
    }

    // Wrap open.xxx with versions that know about Safari
    type AppName = open.AppName | 'safari';
    const openApps = { safari: 'safari', ...open.apps };

    type BrowserKey = AppName | 'default' | 'integrated';
    const browserName = workspace.getConfiguration('p5-server').get<string>('browser', 'default');
    const browserKey = browserName.toLowerCase() as BrowserKey;
    const url = uri ? `${server.url}/${path.relative(this.wsPath, uri.fsPath)}` : server.url;

    if (browserKey === 'integrated') {
      // await commands.executeCommand('livePreview.start.internalPreview.atFile', Uri.parse(url));
      await commands.executeCommand('simpleBrowser.api.open', url, {
        viewColumn: vscode.ViewColumn.Beside
      });
      return;
    }

    // TODO: exit with an error message if the browserKey === 'safari' and the os is not macOS
    let openOptions: open.Options | undefined;
    if (browserKey !== 'default') {
      const name = openApps[browserKey];
      openOptions = { app: { name } };
    }

    let process = await openInBrowser(url, openOptions);
    if (process.exitCode !== 0 && browserKey !== 'default') {
      const msg = `The ${browserName} browser failed to open. Retrying with the default system browser.`;
      const messageStatus = window.setStatusBarMessage(msg);
      process = await openInBrowser(url);
      messageStatus.dispose();
    }
    if (process.exitCode !== 0) {
      const msg =
        browserKey === 'default'
          ? 'The default system browser failed to open.'
          : `The ${browserName} browser failed to open. It may not be available on your system.`;
      window.showErrorMessage(msg);
    }
  }
}

class StatusBarManager {
  private readonly statusBarOpenItem: vscode.StatusBarItem;
  private readonly statusBarServerItem: vscode.StatusBarItem;

  constructor() {
    const statusBarOpenItem = window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.statusBarOpenItem = statusBarOpenItem;
    statusBarOpenItem.text = `$(ports-open-browser-icon)P5 Browser`;
    statusBarOpenItem.command = 'p5-server.openBrowser';

    this.statusBarServerItem = window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  }

  update(server: Server | null, state: string) {
    const { statusBarServerItem, statusBarOpenItem } = this;

    switch (state) {
      case 'running':
        {
          const browserName = workspace.getConfiguration('p5-server').get<string>('browser', 'default');
          statusBarServerItem.text = '$(extensions-star-full)P5 Server';
          statusBarServerItem.tooltip = 'Stop the P5 server';
          statusBarServerItem.command = 'p5-server.stop';
          statusBarOpenItem.tooltip = `Open ${server!.url} in the ${browserName} browser`;
        }
        break;
      case 'stopped':
        statusBarServerItem.text = '$(extensions-star-empty)P5 Server';
        statusBarServerItem.tooltip = 'Click to start the P5 server';
        statusBarServerItem.command = 'p5-server.start';
        break;
      case 'starting':
        statusBarServerItem.text = '$(extensions-star-full~spin)P5 Server';
        statusBarServerItem.tooltip = 'The P5 server is starting…';
        break;
      case 'stopping':
        statusBarServerItem.text = '$(extensions-star-empty~spin)P5 Server';
        statusBarServerItem.tooltip = 'The P5 server is stopping';
        break;
    }
    const config = workspace.getConfiguration('p5-server');
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
}

/**
 * A wrapper for the open.open function that waits until the process status code
 * has been set before returning.
 *
 * @internal */
async function openInBrowser(target: string, options?: open.Options): Promise<ChildProcess> {
  const process = await open(target, options);
  if (process.exitCode === null) {
    await new Promise<void>(resolve => {
      const intervalTimer = setInterval(() => {
        if (process.exitCode !== null) {
          clearInterval(intervalTimer);
          clearTimeout(timeoutTimer);
          resolve();
        }
      }, 50);
      const timeoutTimer = setTimeout(() => {
        clearInterval(intervalTimer);
        resolve();
      }, 1000);
    });
  }
  return process;
}
