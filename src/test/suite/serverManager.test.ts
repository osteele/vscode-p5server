import * as assert from 'assert';
import type { Server } from 'p5-server';
import type { Disposable, ExtensionContext, Uri, WorkspaceConfiguration, WorkspaceFolder } from 'vscode';
import type ScriptConsole from '../../console/scriptConsole';
import { ServerManager, type ServerManagerOptions, type VSCodeHost } from '../../serverManager';

// Fake Server implementation that captures the calls ServerManager makes.
// It is cast to the real Server type at the factory boundary.
class FakeServer {
  url?: string;
  started = false;
  closed = false;
  closeShouldFail: Error | null = null;
  filePathToUrlResult: string | null = null;
  private startResolve?: (value: this) => void;
  private startReject?: (reason: Error) => void;
  private startPromiseInternal?: Promise<this>;

  constructor(
    private startShouldFail: Error | null = null,
    public deferred = false,
  ) {
    if (deferred) {
      this.startPromiseInternal = new Promise<this>((resolve, reject) => {
        this.startResolve = resolve;
        this.startReject = reject;
      });
    }
  }

  async start(): Promise<this> {
    if (this.startShouldFail) {
      throw this.startShouldFail;
    }
    if (this.deferred && this.startPromiseInternal) {
      return this.startPromiseInternal;
    }
    this.url = 'http://localhost:3000';
    this.started = true;
    return this;
  }

  resolveStart() {
    this.url = 'http://localhost:3000';
    this.started = true;
    this.startResolve?.(this);
    return this.startPromiseInternal!;
  }

  rejectStart(error: Error) {
    this.startReject?.(error);
  }

  async close(): Promise<void> {
    if (this.closeShouldFail) {
      throw this.closeShouldFail;
    }
    this.closed = true;
    this.url = undefined;
  }

  filePathToUrl(): string | null {
    return this.filePathToUrlResult;
  }

  onScriptEvent(): unknown {
    return this;
  }

  emitScriptEvent(): boolean {
    return true;
  }

  urlPathToFilePath(): string | null {
    return null;
  }

  serverUrlToFileUrl(): string | null {
    return null;
  }
}

// Minimal status-bar interface captured by ServerManager.
type StatusBarManagerLike = {
  update(server: Server | null, state: string): void;
  dispose(): void;
};

class FakeStatusBarManager implements StatusBarManagerLike {
  updates: { server: Server | null; state: string }[] = [];
  disposed = false;

  update(server: Server | null, state: string) {
    this.updates.push({ server, state });
  }

  dispose() {
    this.disposed = true;
  }
}

class FakeScriptConsole {
  subscribedServers: Server[] = [];
  shown = false;
  disposed = false;

  show() {
    this.shown = true;
  }

  subscribe(server: Server) {
    this.subscribedServers.push(server);
  }

  dispose() {
    this.disposed = true;
  }
}

const fakeWorkspaceFolder: WorkspaceFolder = {
  uri: { fsPath: '/workspace', scheme: 'file', toString: () => '/workspace' } as Uri,
  name: 'workspace',
  index: 0,
};

function createFakeVSCodeHost(overrides: Partial<VSCodeHost> = {}) {
  const calls: Record<string, unknown[][]> = {};
  const record =
    <T>(name: string, value: T) =>
    (...args: unknown[]): T => {
      calls[name] = calls[name] ?? [];
      calls[name].push(args);
      return value;
    };

  const host: VSCodeHost = {
    commands: {
      registerCommand: record('commands.registerCommand', { dispose: () => {} } as Disposable),
      getCommands: async () => ['simpleBrowser.api.open'],
      executeCommand: ((...args: unknown[]) => {
        calls['commands.executeCommand'] = calls['commands.executeCommand'] ?? [];
        calls['commands.executeCommand'].push(args);
        return Promise.resolve(undefined) as unknown as Thenable<unknown>;
      }) as VSCodeHost['commands']['executeCommand'],
    },
    workspace: {
      onDidChangeConfiguration: () => ({ dispose: () => {} }) as Disposable,
      isTrusted: true,
      workspaceFolders: [fakeWorkspaceFolder],
      getWorkspaceFolder: () => fakeWorkspaceFolder,
      getConfiguration: () =>
        ({
          get: <T>(_key: string, defaultValue?: T) => defaultValue,
        }) as WorkspaceConfiguration,
    },
    window: {
      showWarningMessage: record('window.showWarningMessage', Promise.resolve(undefined)),
      showErrorMessage: record('window.showErrorMessage', Promise.resolve(undefined)),
      setStatusBarMessage: () => ({ dispose: () => {} }) as Disposable,
      showQuickPick: async () => undefined,
      activeTextEditor: undefined,
      createStatusBarItem: () =>
        ({
          show: () => {},
          hide: () => {},
          dispose: () => {},
        }) as unknown as ReturnType<typeof import('vscode').window.createStatusBarItem>,
    },
    env: {
      asExternalUri: async (uri: Uri) => uri,
      openExternal: ((...args: unknown[]) => {
        calls['env.openExternal'] = calls['env.openExternal'] ?? [];
        calls['env.openExternal'].push(args);
        return Promise.resolve(true);
      }) as VSCodeHost['env']['openExternal'],
      remoteName: undefined,
    },
    debug: {
      startDebugging: ((...args: unknown[]) => {
        calls['debug.startDebugging'] = calls['debug.startDebugging'] ?? [];
        calls['debug.startDebugging'].push(args);
        return Promise.resolve(true) as unknown as Thenable<boolean>;
      }) as VSCodeHost['debug']['startDebugging'],
    },
    // eslint-disable-next-line @typescript-eslint/naming-convention
    Uri: {
      parse: (source: string) =>
        ({ toString: () => source, fsPath: source.replace(/^file:\/\//, '') }) as unknown as Uri,
    } as unknown as VSCodeHost['Uri'],
    // eslint-disable-next-line @typescript-eslint/naming-convention
    ViewColumn: { Beside: 2 } as unknown as VSCodeHost['ViewColumn'],
    configuration: {
      browser: 'integrated',
      enableProxyCache: true,
    },
  };

  if (overrides.workspace) {
    host.workspace = { ...host.workspace, ...overrides.workspace };
  }
  if (overrides.configuration) {
    host.configuration = { ...host.configuration, ...overrides.configuration };
  }

  return { host, calls };
}

function createFakeContext(): ExtensionContext {
  return { subscriptions: [] } as unknown as ExtensionContext;
}

async function withSuppressedConsoleError<T>(fn: () => Promise<T>): Promise<T> {
  const original = console.error;
  console.error = () => {};
  try {
    return await fn();
  } finally {
    console.error = original;
  }
}

function createManager(
  options: {
    createServer?: () => Promise<FakeServer>;
    createScriptConsole?: () => Promise<FakeScriptConsole>;
    vscodeHost?: Partial<VSCodeHost>;
  } = {},
) {
  const statusBarManager = new FakeStatusBarManager();
  const { host: vscodeHost, calls } = createFakeVSCodeHost(options.vscodeHost);
  const manager = new ServerManager(createFakeContext(), {
    vscodeHost,
    createStatusBarManager: () => statusBarManager as StatusBarManagerLike,
    createServer: options.createServer ? async () => (await options.createServer!()) as unknown as Server : undefined,
    createFileWatchProvider: () => ({ dispose: () => {} }) as Disposable,
    createScriptConsole: options.createScriptConsole
      ? async () => (await options.createScriptConsole!()) as unknown as ScriptConsole
      : async () => new FakeScriptConsole() as unknown as ScriptConsole,
  } as ServerManagerOptions);
  return { manager, statusBarManager, vscodeHost, calls };
}

suite('ServerManager state transitions', () => {
  test('stopped + start (trusted) -> starting -> running', async () => {
    const fakeServer = new FakeServer();
    const fakeConsole = new FakeScriptConsole();
    const { manager, statusBarManager } = createManager({
      createServer: async () => fakeServer,
      createScriptConsole: async () => fakeConsole,
    });

    assert.strictEqual(manager.state, 'stopped');

    await manager.startServer();

    assert.strictEqual(manager.state, 'running');
    assert.strictEqual(fakeServer.started, true);
    assert.strictEqual(fakeConsole.subscribedServers.length, 1);
    assert.deepStrictEqual(
      statusBarManager.updates.map(u => u.state),
      ['stopped', 'starting', 'running'],
    );
  });

  test('stopped + start (untrusted) -> stopped', async () => {
    const { manager, statusBarManager, calls } = createManager({
      createServer: async () => new FakeServer(),
      vscodeHost: { workspace: { isTrusted: false } as VSCodeHost['workspace'] },
    });

    await manager.startServer();

    assert.strictEqual(manager.state, 'stopped');
    assert.strictEqual(statusBarManager.updates.map(u => u.state).includes('starting'), false);
    assert.ok((calls['window.showWarningMessage']?.length ?? 0) > 0);
  });

  test('starting + start waits for the existing startup', async () => {
    const fakeServer = new FakeServer(null, true);
    const { manager, statusBarManager } = createManager({
      createServer: async () => fakeServer,
    });

    const firstStart = manager.startServer();
    await Promise.resolve();
    assert.strictEqual(manager.state, 'starting');

    const secondStart = manager.startServer();
    await Promise.resolve();
    assert.strictEqual(manager.state, 'starting');

    fakeServer.resolveStart();
    await Promise.all([firstStart, secondStart]);

    assert.strictEqual(manager.state, 'running');
    assert.strictEqual(
      statusBarManager.updates.filter(u => u.state === 'starting').length,
      1,
      'status bar should only transition to starting once',
    );
  });

  test('running + stop -> stopping -> stopped', async () => {
    const fakeServer = new FakeServer();
    const fakeConsole = new FakeScriptConsole();
    const { manager, statusBarManager } = createManager({
      createServer: async () => fakeServer,
      createScriptConsole: async () => fakeConsole,
    });

    await manager.startServer();
    assert.strictEqual(manager.state, 'running');

    await manager.stopServer();

    assert.strictEqual(manager.state, 'stopped');
    assert.strictEqual(fakeServer.closed, true);
    assert.strictEqual(fakeConsole.disposed, true);
    assert.ok(statusBarManager.updates.some(u => u.state === 'stopping'));
    assert.ok(statusBarManager.updates.some(u => u.state === 'stopped'));
  });

  test('stopped + stop is a no-op', async () => {
    const { manager, statusBarManager } = createManager();

    await manager.stopServer();

    assert.strictEqual(manager.state, 'stopped');
    assert.deepStrictEqual(
      statusBarManager.updates.map(u => u.state),
      ['stopped'],
    );
  });

  test('starting + stop is ignored', async () => {
    const fakeServer = new FakeServer(null, true);
    const { manager, statusBarManager } = createManager({
      createServer: async () => fakeServer,
    });

    const startPromise = manager.startServer();
    await Promise.resolve();
    assert.strictEqual(manager.state, 'starting');

    await manager.stopServer();
    assert.strictEqual(manager.state, 'starting');

    fakeServer.resolveStart();
    await startPromise;

    assert.strictEqual(manager.state, 'running');
    assert.strictEqual(statusBarManager.updates.map(u => u.state).join(','), 'stopped,starting,running');
  });

  test('running + openBrowser opens the configured URL', async () => {
    const fakeServer = new FakeServer();
    fakeServer.filePathToUrlResult = 'http://localhost:3000/sketch.js';
    const { manager, calls } = createManager({
      createServer: async () => fakeServer,
      vscodeHost: { configuration: { browser: 'system' } as VSCodeHost['configuration'] },
    });

    await manager.startServer();
    await manager.openBrowser();

    assert.ok((calls['env.openExternal']?.length ?? 0) > 0);
  });

  test('running + debug starts a debugging session', async () => {
    const fakeServer = new FakeServer();
    fakeServer.filePathToUrlResult = 'http://localhost:3000/sketch.js';
    const { manager, calls } = createManager({
      createServer: async () => fakeServer,
    });

    await manager.startServer();
    await manager.debugSketch();

    assert.ok((calls['debug.startDebugging']?.length ?? 0) > 0);
  });

  test('starting + start failure -> stopped with cleanup', async () => {
    const fakeServer = new FakeServer(new Error('port in use'));
    const { manager, statusBarManager, calls } = createManager({
      createServer: async () => fakeServer,
    });

    await withSuppressedConsoleError(async () => manager.startServer());

    assert.strictEqual(manager.state, 'stopped');
    assert.ok((calls['window.showErrorMessage']?.length ?? 0) > 0);
    assert.ok(statusBarManager.updates.some(u => u.state === 'starting'));
    assert.strictEqual(statusBarManager.updates[statusBarManager.updates.length - 1].state, 'stopped');
  });

  test('stopping + close failure restores running when server remains', async () => {
    const fakeServer = new FakeServer();
    fakeServer.closeShouldFail = new Error('close failed');
    const { manager, statusBarManager, calls } = createManager({
      createServer: async () => fakeServer,
    });

    await manager.startServer();
    assert.strictEqual(manager.state, 'running');

    await withSuppressedConsoleError(async () => manager.stopServer());

    assert.strictEqual(manager.state, 'running');
    assert.ok((calls['window.showErrorMessage']?.length ?? 0) > 0);
    assert.ok(statusBarManager.updates.some(u => u.state === 'stopping'));
    assert.strictEqual(statusBarManager.updates[statusBarManager.updates.length - 1].state, 'running');
  });

  test('running + dispose -> stopped with cleanup', async () => {
    const fakeServer = new FakeServer();
    const fakeConsole = new FakeScriptConsole();
    const { manager, statusBarManager } = createManager({
      createServer: async () => fakeServer,
      createScriptConsole: async () => fakeConsole,
    });

    await manager.startServer();
    await manager.dispose();

    assert.strictEqual(manager.state, 'stopped');
    assert.strictEqual(fakeServer.closed, true);
    assert.strictEqual(fakeConsole.disposed, true);
    assert.strictEqual(statusBarManager.disposed, true);
  });
});
