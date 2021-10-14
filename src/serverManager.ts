import { ChildProcess } from 'child_process';
import { Server } from 'p5-server';
import * as vscode from 'vscode';
import { commands, Uri, window, workspace } from 'vscode';
import { ScriptConsole } from './scriptConsole';
import { getWorkspaceFolderPaths } from './utils';
import open = require('open');

type ServerState = 'stopped' | 'starting' | 'running' | 'stopping';

export class ServerManager {
  private server: Server | null = null;
  private _state: ServerState = 'stopped';
  private statusBarManager: StatusBarManager;

  constructor(context: vscode.ExtensionContext) {
    this.statusBarManager = new StatusBarManager();
    this.registerCommands(context);
  }

  static activate(context: vscode.ExtensionContext) {
    new ServerManager(context);
  }

  private registerCommands(context: vscode.ExtensionContext) {
    context.subscriptions.push(
      commands.registerCommand('p5-server.start', this.startServer.bind(this)),
      commands.registerCommand('p5-server.stop', this.stopServer.bind(this)),
      commands.registerCommand('p5-server.openInBrowser', () => {
        const editorPath = window.activeTextEditor?.document.fileName;
        return commands.executeCommand('p5-server.openBrowser', editorPath ? Uri.file(editorPath) : undefined);
      }),
      commands.registerCommand('p5-server.openBrowser', async (uri?: Uri, options?: { browser: string }) => {
        if (this.state === 'stopped') {
          await this.startServer(uri, options);
        } else if (this.state === 'running') {
          await this.openBrowser(uri, options);
        }
      })
    );

    workspace.onDidChangeConfiguration(this.updateFromConfiguration.bind(this));
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

  async startServer(uri?: Uri, options?: { browser: string }) {
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

      this.server?.close();
      this.server = null;

      let sbm = window.setStatusBarMessage(`Starting the P5 server at ${root}`);

      this.server = new Server({ root });
      await this.server.start();
      const consolePane = new ScriptConsole();
      consolePane.subscribe(this.server);
      this.state = 'running';

      sbm.dispose();
      sbm = window.setStatusBarMessage(`p5-server is running at ${this.server.url}`);
      setTimeout(() => sbm.dispose(), 10000);
    } finally {
      if (this.state !== 'running') {
        this.state = 'stopped';
      }
    }
    this.openBrowser(uri?.with({ query: 'send-console-messages' }), options);
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

    await this.server.close();
    this.server = null;
    this.state = 'stopped';

    sbm.dispose();
    sbm = window.setStatusBarMessage('The P5 server is no longer running.');
    setTimeout(() => sbm.dispose(), 10000);
  }

  /** Open `uri` if supplied, or the server root if not, in the specified browser */
  async openBrowser(uri?: Uri, options?: { browser: string }) {
    const server = this.server;
    if (!server?.url) {
      return;
    }
    const target = uri ? server.filePathToUrl(uri.fsPath) : server.url;
    if (!target) {
      if (uri) {
        await window.showErrorMessage(`${uri.fsPath} is not in a directory that is served by the P5 server.`);
      }
      return;
    }

    // Wrap open.xxx with versions that know about Safari
    type AppName = open.AppName | 'safari';
    const openApps = { safari: 'safari', ...open.apps };

    type BrowserKey = AppName | 'system' | 'integrated';
    const configBrowser = workspace
      .getConfiguration('p5-server')
      .get('browser', 'integrated')
      .replace('default', 'system');
    const browserName =
      options?.browser === 'external'
        ? configBrowser.replace('integrated', 'system')
        : options?.browser || configBrowser;
    const browserKey = browserName.toLowerCase() as BrowserKey;

    if (browserKey === 'integrated') {
      await commands.executeCommand('simpleBrowser.api.open', target, {
        viewColumn: vscode.ViewColumn.Beside
      });
      return;
    }

    // TODO: exit with an error message if the browserKey === 'safari' and the os is not macOS
    let openOptions: open.Options | undefined;
    if (browserKey !== 'system') {
      const name = openApps[browserKey];
      openOptions = { app: { name } };
    }

    let process = await openInBrowser(target, openOptions);
    if (process.exitCode !== 0 && browserKey !== 'system') {
      const msg = `The ${browserName} browser failed to open. Retrying with the default system browser.`;
      const messageStatus = window.setStatusBarMessage(msg);
      process = await openInBrowser(target);
      await messageStatus.dispose();
    }
    if (process.exitCode !== 0) {
      const msg =
        browserKey === 'system'
          ? 'The default system browser failed to open.'
          : `The ${browserName} browser failed to open. It may not be available on your system.`;
      await window.showErrorMessage(msg);
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
          const browserName = workspace.getConfiguration('p5-server').get('browser', 'integrated');
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
      }, 5000);
    });
  }
  return process;
}
