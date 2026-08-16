import type { Server } from 'p5-server';
import type { AppName, Options as OpenOptions } from 'open';
import type {
  commands,
  debug,
  Disposable,
  env,
  ExtensionContext,
  Uri,
  ViewColumn,
  window,
  workspace,
  WorkspaceFolder,
} from 'vscode';
import type ScriptConsole from './console/scriptConsole';
import type { FileWatchProvider } from './fileWatchProvider';
import path from 'node:path';
import { withConsoleRelayQuery } from './helpers';
import { openInBrowser } from './openInBrowser';

type ServerState = 'stopped' | 'starting' | 'running' | 'stopping';

// Single source of truth for valid ServerManager lifecycle transitions.
const allowedTransitions: Record<ServerState, readonly ServerState[]> = {
  stopped: ['starting'],
  starting: ['running', 'stopped'],
  running: ['stopping', 'stopped'],
  stopping: ['stopped', 'running'],
};

function isValidTransition(from: ServerState, to: ServerState): boolean {
  return from === to || allowedTransitions[from].includes(to);
}

type StatusBarManagerLike = {
  update(server: Server | null, state: string): void;
  dispose(): void;
};

/** Subset of the VS Code API used by ServerManager, abstracted for testability. */
export type VSCodeHost = {
  commands: {
    registerCommand: typeof commands.registerCommand;
    getCommands: typeof commands.getCommands;
    executeCommand: typeof commands.executeCommand;
  };
  workspace: {
    onDidChangeConfiguration: typeof workspace.onDidChangeConfiguration;
    isTrusted: typeof workspace.isTrusted;
    workspaceFolders: typeof workspace.workspaceFolders;
    getWorkspaceFolder: typeof workspace.getWorkspaceFolder;
    getConfiguration: typeof workspace.getConfiguration;
  };
  window: {
    showWarningMessage: typeof window.showWarningMessage;
    showErrorMessage: typeof window.showErrorMessage;
    setStatusBarMessage: typeof window.setStatusBarMessage;
    showQuickPick: typeof window.showQuickPick;
    activeTextEditor: typeof window.activeTextEditor;
    createStatusBarItem: typeof window.createStatusBarItem;
  };
  env: {
    asExternalUri: typeof env.asExternalUri;
    openExternal: typeof env.openExternal;
    remoteName: typeof env.remoteName;
  };
  debug: {
    startDebugging: typeof debug.startDebugging;
  };
  // eslint-disable-next-line @typescript-eslint/naming-convention
  Uri: typeof Uri;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  ViewColumn: typeof ViewColumn;
  configuration: {
    browser: AppName | 'integrated' | 'safari' | 'system';
    enableProxyCache: boolean;
  };
};

function defaultVSCodeHost(): VSCodeHost {
  // The real VS Code API and configuration reader are only available in the
  // extension host. Delay the requires so unit tests that inject a fake host
  // never load them.
  const vscodeModule = require('vscode') as typeof import('vscode');
  const configurationModule = require('./configuration') as typeof import('./configuration');
  return {
    commands: vscodeModule.commands,
    workspace: vscodeModule.workspace,
    window: vscodeModule.window,
    env: vscodeModule.env,
    debug: vscodeModule.debug,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    Uri: vscodeModule.Uri,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    ViewColumn: vscodeModule.ViewColumn,
    configuration: {
      browser: configurationModule.Configuration.browser,
      enableProxyCache: configurationModule.Configuration.enableProxyCache,
    },
  };
}

export type ServerManagerOptions = {
  vscodeHost?: VSCodeHost;
  createServer?: (options: Server.Options) => Server | Promise<Server>;
  createFileWatchProvider?: FileWatchProvider;
  createStatusBarManager?: () => StatusBarManagerLike;
  createScriptConsole?: () => ScriptConsole | Promise<ScriptConsole>;
};

type CreateServer = NonNullable<ServerManagerOptions['createServer']>;
type CreateScriptConsole = NonNullable<ServerManagerOptions['createScriptConsole']>;

async function defaultCreateServer(options: Server.Options): Promise<Server> {
  const serverModule = await import('p5-server');
  return new serverModule.Server(options);
}

async function defaultCreateFileWatchProvider(): Promise<FileWatchProvider> {
  const fileWatchProviderModule = await import('./fileWatchProvider');
  return fileWatchProviderModule.createVSCodeFileWatchProvider;
}

function defaultCreateStatusBarManager(): StatusBarManagerLike {
  const statusBarModule = require('./statusBar') as typeof import('./statusBar');
  return new statusBarModule.StatusBarManager();
}

async function defaultCreateScriptConsole(): Promise<ScriptConsole> {
  const scriptConsoleModule = await import('./console/scriptConsole');
  return new scriptConsoleModule.default();
}

export class ServerManager {
  private static instance: ServerManager | null = null;
  private server: Server | null = null;
  private _state: ServerState = 'stopped';
  private statusBarManager: StatusBarManagerLike;
  private scriptConsole: ScriptConsole | null = null;
  private startPromise: Promise<void> | null = null;
  private servedWorkspaceFolder: WorkspaceFolder | undefined;
  private readonly vscode: VSCodeHost;
  private readonly createServer: CreateServer;
  private readonly createFileWatchProvider: Promise<FileWatchProvider>;
  private readonly createScriptConsole: CreateScriptConsole;

  constructor(context: ExtensionContext, options: ServerManagerOptions = {}) {
    this.vscode = options.vscodeHost ?? defaultVSCodeHost();
    this.createServer = options.createServer ?? defaultCreateServer;
    this.createFileWatchProvider = options.createFileWatchProvider
      ? Promise.resolve(options.createFileWatchProvider)
      : defaultCreateFileWatchProvider();
    this.createScriptConsole = options.createScriptConsole ?? defaultCreateScriptConsole;
    this.statusBarManager = (options.createStatusBarManager ?? defaultCreateStatusBarManager)();
    this.registerCommands(context);
  }

  static activate(context: ExtensionContext, options?: ServerManagerOptions) {
    ServerManager.instance = new ServerManager(context, options);
    return ServerManager.instance;
  }

  static getInstance(): ServerManager | null {
    return ServerManager.instance;
  }

  private registerCommands(context: ExtensionContext) {
    context.subscriptions.push(
      this.vscode.commands.registerCommand('p5-server.start', this.startServer.bind(this)),
      this.vscode.commands.registerCommand('p5-server.stop', this.stopServer.bind(this)),
      this.vscode.commands.registerCommand('p5-server.debug', this.debugSketch.bind(this)),
      this.vscode.commands.registerCommand('p5-server.showScriptOutput', async () => {
        const scriptConsole = await this.getScriptConsole();
        scriptConsole.show();
      }),
      this.vscode.commands.registerCommand(
        'p5-server.openBrowser',
        async (uri?: Uri, options?: { browser: string }) => {
          if (this.state === 'stopped' || this.state === 'starting') {
            await this.startServer(uri, options);
          } else if (this.state === 'running') {
            await this.openBrowser(uri, options);
          }
        },
      ),
    );

    context.subscriptions.push(
      this.vscode.workspace.onDidChangeConfiguration(event => {
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
      this.scriptConsole = await this.createScriptConsole();
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
    if (state === this._state) return;
    if (!isValidTransition(this._state, state)) {
      console.warn(`Invalid ServerManager state transition: ${this._state} -> ${state}`);
      return;
    }
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
    let sbm: Disposable | undefined;

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

      sbm = this.vscode.window.setStatusBarMessage(`Starting the P5 server at ${root}`);

      const serverOptions = {
        fileWatchProvider: await this.createFileWatchProvider,
        root,
        theme: 'grid',
        proxyCache: this.vscode.configuration.enableProxyCache,
        relayConsoleMessages: true,
      };
      this.server = await this.createServer(serverOptions);
      // Subscribe before starting. The relay reports failures as an 'error' event, which
      // throws if it is emitted before a listener is attached. A browser left open from a
      // previous run reconnects as soon as the server accepts connections, so subscribing
      // afterwards leaves a window in which a sketch error takes down the extension host.
      const scriptConsole = await this.getScriptConsole();
      scriptConsole.subscribe(this.server);
      await this.server.start();
      this.state = 'running';

      sbm.dispose();
      sbm = this.vscode.window.setStatusBarMessage(`p5-server is running at ${this.server.url}`);
      setTimeout(() => sbm?.dispose(), 10000);
    } catch (error) {
      await this.server?.close();
      this.server = null;
      this.servedWorkspaceFolder = undefined;
      this.disposeScriptConsole();
      this.state = 'stopped';
      sbm?.dispose();
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.vscode.window.showErrorMessage(`Failed to start P5 server: ${errorMessage}`);
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

    let sbm = this.vscode.window.setStatusBarMessage('Shutting down the P5 server…');

    try {
      await this.server.close();
      this.server = null;
      this.servedWorkspaceFolder = undefined;
      this.disposeScriptConsole();
      this.state = 'stopped';

      sbm.dispose();
      sbm = this.vscode.window.setStatusBarMessage('The P5 server is no longer running.');
      setTimeout(() => sbm.dispose(), 10000);
    } catch (error) {
      this.state = this.server ? 'running' : 'stopped';
      sbm.dispose();
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.vscode.window.showErrorMessage(`Failed to stop P5 server: ${errorMessage}`);
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
        await this.vscode.window.showErrorMessage(
          `${uri.fsPath} is not in a directory that is served by the P5 server.`,
        );
      }
      return;
    }
    const target = this.vscode.Uri.parse(withConsoleRelayQuery(serverTarget));

    // Wrap open.xxx with versions that know about Safari
    type SupportedAppName = AppName | 'safari';

    type BrowserKey = SupportedAppName | 'system' | 'integrated';
    const configBrowser = this.vscode.configuration.browser;
    const browserName =
      options?.browser === 'external'
        ? this.vscode.configuration.browser.replace('integrated', 'system')
        : options?.browser || configBrowser;
    const browserKey = browserName.toLowerCase() as BrowserKey;

    if (browserKey === 'integrated') {
      await this.openIntegratedBrowser(await this.vscode.env.asExternalUri(target));
      return;
    }

    if (browserKey === 'system' || this.vscode.env.remoteName) {
      const opened = await this.vscode.env.openExternal(await this.vscode.env.asExternalUri(target));
      if (!opened) await this.vscode.window.showErrorMessage('The system browser could not open the sketch.');
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
      const messageStatus = this.vscode.window.setStatusBarMessage(msg);
      process = await openInBrowser(target.toString());
      await messageStatus.dispose();
    }
    if (process.exitCode !== 0) {
      const msg = `The ${browserName} browser failed to open. It may not be available on your system.`;
      await this.vscode.window.showErrorMessage(msg);
    }
  }

  async debugSketch(uri?: Uri) {
    if (!(await this.requireTrustedWorkspace())) return;
    const resource = uri ?? this.vscode.window.activeTextEditor?.document.uri;
    if (this.state === 'stopped') await this.startServer(resource, undefined, false);
    else if (this.state === 'starting') await this.startPromise;
    const server = this.server;
    if (!server?.url || this.state !== 'running') return;

    const serverTarget = resource ? server.filePathToUrl(resource.fsPath) : server.url;
    if (!serverTarget) {
      await this.vscode.window.showErrorMessage(
        `${resource?.fsPath ?? 'The selected file'} is outside the served workspace folder.`,
      );
      return;
    }
    const target = await this.vscode.env.asExternalUri(this.vscode.Uri.parse(withConsoleRelayQuery(serverTarget)));
    const folder = resource
      ? (this.vscode.workspace.getWorkspaceFolder(resource) ?? this.getWorkspaceFolderForPath(resource.fsPath))
      : this.servedWorkspaceFolder;
    await this.vscode.debug.startDebugging(folder, {
      type: 'editor-browser',
      request: 'launch',
      name: 'Debug p5.js Sketch',
      url: target.toString(),
      webRoot: folder?.uri.fsPath,
    });
  }

  private getWorkspaceFolderForPath(filePath: string): WorkspaceFolder | undefined {
    return this.vscode.workspace.workspaceFolders?.find(folder => {
      const relative = path.relative(folder.uri.fsPath, filePath);
      return (
        relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative))
      );
    });
  }

  private async openIntegratedBrowser(target: Uri) {
    const availableCommands = await this.vscode.commands.getCommands(true);
    if (availableCommands.includes('workbench.action.browser.open')) {
      await this.vscode.commands.executeCommand('workbench.action.browser.open', target.toString());
    } else {
      await this.vscode.commands.executeCommand('simpleBrowser.api.open', target, {
        viewColumn: this.vscode.ViewColumn.Beside,
      });
    }
  }

  private async selectWorkspaceFolder(uri?: Uri): Promise<WorkspaceFolder | undefined> {
    const folders = this.vscode.workspace.workspaceFolders ?? [];
    if (uri) {
      const containingFolder =
        this.vscode.workspace.getWorkspaceFolder(uri) ?? this.getWorkspaceFolderForPath(uri.fsPath);
      if (containingFolder) return containingFolder;
    }
    if (folders.length === 1) return folders[0];
    if (folders.length === 0) {
      await this.vscode.window.showErrorMessage('Open a workspace folder before starting P5 Server.');
      return undefined;
    }
    const selection = await this.vscode.window.showQuickPick(
      folders.map(folder => ({ label: folder.name, description: folder.uri.fsPath, folder })),
      { placeHolder: 'Select a folder to serve' },
    );
    return selection?.folder;
  }

  private async requireTrustedWorkspace(): Promise<boolean> {
    if (this.vscode.workspace.isTrusted) return true;
    const choice = await this.vscode.window.showWarningMessage(
      'P5 Server can run JavaScript from this workspace. Trust the workspace before starting or debugging a sketch.',
      'Manage Workspace Trust',
    );
    if (choice === 'Manage Workspace Trust') {
      await this.vscode.commands.executeCommand('workbench.trust.manage');
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
