import type { Server } from 'p5-server';
import * as vscode from 'vscode';
import { commands, debug, env, Uri, window, workspace, WorkspaceFolder } from 'vscode';
import type ScriptConsole from './console/scriptConsole';
import { withConsoleRelayQuery } from './helpers';
import { getWorkspaceFolderForPath } from './helpers/fileHelpers';
import { openInBrowser } from './openInBrowser';
import { StatusBarManager } from './statusBar';
import type { AppName, Options as OpenOptions } from 'open';
import { Configuration } from './configuration';
import { createVSCodeFileWatchProvider } from './fileWatchProvider';

type ServerState = 'stopped' | 'starting' | 'running' | 'stopping';

export class ServerManager {
  private static instance: ServerManager | null = null;
  private server: Server | null = null;
  private _state: ServerState = 'stopped';
  private statusBarManager: StatusBarManager;
  private scriptConsole: ScriptConsole | null = null;
  private startPromise: Promise<void> | null = null;
  private servedWorkspaceFolder: WorkspaceFolder | undefined;

  constructor(context: vscode.ExtensionContext) {
    this.statusBarManager = new StatusBarManager();
    this.registerCommands(context);
  }

  static activate(context: vscode.ExtensionContext) {
    ServerManager.instance = new ServerManager(context);
    return ServerManager.instance;
  }

  static getInstance(): ServerManager | null {
    return ServerManager.instance;
  }

  private registerCommands(context: vscode.ExtensionContext) {
    context.subscriptions.push(
      commands.registerCommand('p5-server.start', this.startServer.bind(this)),
      commands.registerCommand('p5-server.stop', this.stopServer.bind(this)),
      commands.registerCommand('p5-server.debug', this.debugSketch.bind(this)),
      commands.registerCommand('p5-server.showScriptOutput', async () => {
        const scriptConsole = await this.getScriptConsole();
        scriptConsole.show();
      }),
      commands.registerCommand('p5-server.openBrowser', async (uri?: Uri, options?: { browser: string }) => {
        if (this.state === 'stopped' || this.state === 'starting') {
          await this.startServer(uri, options);
        } else if (this.state === 'running') {
          await this.openBrowser(uri, options);
        }
      }),
    );

    context.subscriptions.push(
      workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('p5-server')) this.updateFromConfiguration();
      }),
    );
    this.updateFromConfiguration();
  }

  updateFromConfiguration() {
    this.updateStatusBar();
  }

  updateStatusBar() {
    this.statusBarManager.update(this.server, this.state);
  }

  private async getScriptConsole(): Promise<ScriptConsole> {
    if (!this.scriptConsole) {
      const scriptConsoleModule = await import('./console/scriptConsole');
      this.scriptConsole = new scriptConsoleModule.default();
    }
    return this.scriptConsole;
  }

  private disposeScriptConsole() {
    this.scriptConsole?.dispose();
    this.scriptConsole = null;
  }

  get state() {
    return this._state;
  }

  set state(state: ServerState) {
    this._state = state;
    this.updateStatusBar();
  }

  async startServer(uri?: Uri, options?: { browser: string }, openAfterStart = true) {
    if (!(await this.requireTrustedWorkspace())) return;
    if (this.startPromise) {
      await this.startPromise;
      if (openAfterStart && this.state === 'running') {
        await this.openBrowser(uri, options);
      }
      return;
    }
    if (this.state !== 'stopped') {
      return;
    }

    const startPromise = this.startServerOnce(uri, options, openAfterStart);
    this.startPromise = startPromise;
    try {
      await startPromise;
    } finally {
      if (this.startPromise === startPromise) {
        this.startPromise = null;
      }
    }
  }

  private async startServerOnce(uri?: Uri, options?: { browser: string }, openAfterStart = true) {
    this.state = 'starting';
    let sbm: vscode.Disposable | undefined;

    try {
      const folder = await this.selectWorkspaceFolder(uri);
      if (!folder) {
        this.state = 'stopped';
        return; // the user cancelled
      }
      const root = folder.uri.fsPath;
      this.servedWorkspaceFolder = folder;

      await this.server?.close();
      this.server = null;

      sbm = window.setStatusBarMessage(`Starting the P5 server at ${root}`);

      const serverOptions = {
        fileWatchProvider: createVSCodeFileWatchProvider,
        root,
        theme: 'grid',
        proxyCache: Configuration.enableProxyCache,
        relayConsoleMessages: true,
      };
      const serverModule = await import('p5-server');
      this.server = new serverModule.Server(serverOptions);
      await this.server.start();
      const scriptConsole = await this.getScriptConsole();
      scriptConsole.subscribe(this.server);
      this.state = 'running';

      sbm.dispose();
      sbm = window.setStatusBarMessage(`p5-server is running at ${this.server.url}`);
      setTimeout(() => sbm?.dispose(), 10000);
    } catch (error) {
      await this.server?.close();
      this.server = null;
      this.servedWorkspaceFolder = undefined;
      this.disposeScriptConsole();
      this.state = 'stopped';
      sbm?.dispose();
      const errorMessage = error instanceof Error ? error.message : String(error);
      window.showErrorMessage(`Failed to start P5 server: ${errorMessage}`);
      console.error('Failed to start P5 server:', error);
      return;
    } finally {
      if (this.state !== 'running') {
        this.state = 'stopped';
      }
    }
    if (openAfterStart) await this.openBrowser(uri, options);
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

    try {
      await this.server.close();
      this.server = null;
      this.servedWorkspaceFolder = undefined;
      this.disposeScriptConsole();
      this.state = 'stopped';

      sbm.dispose();
      sbm = window.setStatusBarMessage('The P5 server is no longer running.');
      setTimeout(() => sbm.dispose(), 10000);
    } catch (error) {
      this.state = this.server ? 'running' : 'stopped';
      sbm.dispose();
      const errorMessage = error instanceof Error ? error.message : String(error);
      window.showErrorMessage(`Failed to stop P5 server: ${errorMessage}`);
      console.error('Failed to stop P5 server:', error);
    }
  }

  /** Open `uri` if supplied, or the server root if not, in the specified browser */
  async openBrowser(uri?: Uri, options?: { browser: string }) {
    const server = this.server;
    if (!server?.url) {
      return;
    }
    const serverTarget = uri ? server.filePathToUrl(uri.fsPath) : server.url;
    if (!serverTarget) {
      if (uri) {
        await window.showErrorMessage(`${uri.fsPath} is not in a directory that is served by the P5 server.`);
      }
      return;
    }
    const target = Uri.parse(withConsoleRelayQuery(serverTarget));

    // Wrap open.xxx with versions that know about Safari
    type SupportedAppName = AppName | 'safari';

    type BrowserKey = SupportedAppName | 'system' | 'integrated';
    const configBrowser = Configuration.browser;
    const browserName =
      options?.browser === 'external'
        ? Configuration.browser.replace('integrated', 'system')
        : options?.browser || configBrowser;
    const browserKey = browserName.toLowerCase() as BrowserKey;

    if (browserKey === 'integrated') {
      await this.openIntegratedBrowser(await env.asExternalUri(target));
      return;
    }

    if (browserKey === 'system' || env.remoteName) {
      const opened = await env.openExternal(await env.asExternalUri(target));
      if (!opened) await window.showErrorMessage('The system browser could not open the sketch.');
      return;
    }

    // TODO: exit with an error message if the browserKey === 'safari' and the os is not macOS
    const { apps } = await import('open');
    const openApps = { safari: 'safari', ...apps };
    const name = openApps[browserKey];
    const openOptions: OpenOptions = { app: { name } };

    let process = await openInBrowser(target.toString(), openOptions);
    if (process.exitCode !== 0) {
      const msg = `The ${browserName} browser failed to open. Retrying with the default system browser.`;
      const messageStatus = window.setStatusBarMessage(msg);
      process = await openInBrowser(target.toString());
      await messageStatus.dispose();
    }
    if (process.exitCode !== 0) {
      const msg = `The ${browserName} browser failed to open. It may not be available on your system.`;
      await window.showErrorMessage(msg);
    }
  }

  async debugSketch(uri?: Uri) {
    if (!(await this.requireTrustedWorkspace())) return;
    const resource = uri ?? window.activeTextEditor?.document.uri;
    if (this.state === 'stopped') await this.startServer(resource, undefined, false);
    else if (this.state === 'starting') await this.startPromise;
    const server = this.server;
    if (!server?.url || this.state !== 'running') return;

    const serverTarget = resource ? server.filePathToUrl(resource.fsPath) : server.url;
    if (!serverTarget) {
      await window.showErrorMessage(
        `${resource?.fsPath ?? 'The selected file'} is outside the served workspace folder.`,
      );
      return;
    }
    const target = await env.asExternalUri(Uri.parse(withConsoleRelayQuery(serverTarget)));
    const folder = resource
      ? (workspace.getWorkspaceFolder(resource) ?? getWorkspaceFolderForPath(resource.fsPath))
      : this.servedWorkspaceFolder;
    await debug.startDebugging(folder, {
      type: 'editor-browser',
      request: 'launch',
      name: 'Debug p5.js Sketch',
      url: target.toString(),
      webRoot: folder?.uri.fsPath,
    });
  }

  private async openIntegratedBrowser(target: Uri) {
    const availableCommands = await commands.getCommands(true);
    if (availableCommands.includes('workbench.action.browser.open')) {
      await commands.executeCommand('workbench.action.browser.open', target.toString());
    } else {
      await commands.executeCommand('simpleBrowser.api.open', target, {
        viewColumn: vscode.ViewColumn.Beside,
      });
    }
  }

  private async selectWorkspaceFolder(uri?: Uri): Promise<WorkspaceFolder | undefined> {
    const folders = workspace.workspaceFolders ?? [];
    if (uri) {
      const containingFolder = workspace.getWorkspaceFolder(uri) ?? getWorkspaceFolderForPath(uri.fsPath);
      if (containingFolder) return containingFolder;
    }
    if (folders.length === 1) return folders[0];
    if (folders.length === 0) {
      await window.showErrorMessage('Open a workspace folder before starting P5 Server.');
      return undefined;
    }
    const selection = await window.showQuickPick(
      folders.map(folder => ({ label: folder.name, description: folder.uri.fsPath, folder })),
      { placeHolder: 'Select a folder to serve' },
    );
    return selection?.folder;
  }

  private async requireTrustedWorkspace(): Promise<boolean> {
    if (workspace.isTrusted) return true;
    const choice = await window.showWarningMessage(
      'P5 Server can run JavaScript from this workspace. Trust the workspace before starting or debugging a sketch.',
      'Manage Workspace Trust',
    );
    if (choice === 'Manage Workspace Trust') {
      await commands.executeCommand('workbench.trust.manage');
    }
    return false;
  }

  /** Clean up resources */
  async dispose() {
    if (this.server) {
      await this.server.close();
      this.server = null;
    }
    this.servedWorkspaceFolder = undefined;
    this.disposeScriptConsole();
    this.state = 'stopped';
    this.statusBarManager.dispose();
    ServerManager.instance = null;
  }
}
