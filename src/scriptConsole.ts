import { BrowserConnectionEvent, BrowserConsoleEvent, BrowserErrorEvent, Server } from 'p5-server';
import { BrowserDocumentEvent } from 'p5-server/dist/server/eventTypes';
import * as vscode from 'vscode';
import { window, workspace } from 'vscode';
import util = require('util');

export class ScriptConsole {
  private _sketchConsole: vscode.OutputChannel | null = null;
  private file?: string;
  private messageCount = 0;
  private consoleMessages: ConsoleMessageLensProvider;

  constructor() {
    const provider = new ConsoleMessageLensProvider();
    this.consoleMessages = provider;
    vscode.languages.registerCodeLensProvider('javascript', provider);
    vscode.commands.registerCommand('p5-explorer.showScriptConsole', () => {
      this.sketchConsole.show(true);
    });
  }

  subscribe(server: Server) {
    server.onScriptEvent('console', (event: BrowserConsoleEvent) => {
      const { method, args, file, url, clientId } = event;
      if (method === 'clear') {
        this.clear();
        this.consoleMessages.removeMessages({ clientId });
      } else {
        this.setFile(file, url);
        this.maybeShowConsole(method);
        this.appendLine(util.format(`[${method.toUpperCase()}] ${formatArgs(event)}`));
        if (file && event.line && args.length > 0) this.consoleMessages.addMessage(event);
      }
    });

    server.onScriptEvent('document', (event: BrowserDocumentEvent) => {
      const { type, clientId, visibilityState } = event;
      if (type === 'visibilitychange' && !visibilityState) {
        this.consoleMessages.removeMessages({ clientId });
      }
    });

    server.onScriptEvent('error', (event: BrowserErrorEvent) => {
      const { message, file, url, stack } = event;
      this.setFile(file, url);
      this.maybeShowConsole('error');
      let msg = 'Error';
      if (event.type === 'error' && event.line) {
        msg += ` at line ${event.line}`;
      }
      if (file || url) {
        msg += ` of ${file || url}`;
      }
      this.appendLine(stack || `${msg}: ${message}`);
    });

    server.onScriptEvent('connection', (event: BrowserConnectionEvent) => {
      const { type, file, url } = event;
      if (type === 'opened') {
        if (file) this.consoleMessages.removeMessages({ file });
        if (!this.setFile(file, url) && this.messageCount > 0) {
          const label = '[RELOAD]';
          const halfLen = Math.floor((80 - label.length) / 2);
          this.sketchConsole.appendLine('-'.repeat(halfLen) + label + '-'.repeat(halfLen));
        }
        this.maybeShowConsole('always');
      }
    });
  }

  private get sketchConsole() {
    if (!this._sketchConsole) {
      this._sketchConsole = window.createOutputChannel('P5-Sketch');
    }
    return this._sketchConsole;
  }

  private appendLine(value: string) {
    this.sketchConsole.appendLine(value);
    this.messageCount++;
  }

  private clear() {
    this.sketchConsole.clear();
    this.messageCount = 0;
  }

  /** Display the banner if the console is empty, or this is a different url than was
   * previously displayed in this console.
   *
   * Return true iff the banner was displayed.
   */
  private setFile(file?: string, url?: string) {
    if (this.file === file) return false;
    this.file = file;
    const label = file ? ` (${file || url}) ` : '';
    const halfLen = Math.floor((80 - label.length) / 2);
    this.sketchConsole.appendLine('='.repeat(halfLen) + label + '='.repeat(halfLen));
    this.messageCount = 0;
    return true;
  }

  private maybeShowConsole(level: string) {
    const browser = workspace.getConfiguration('p5-server').get('browser', 'integrated');
    const [configKey, defaultValue] =
      browser === 'integrated' ? ['integratedBrowser', 'info'] : ['externalBrowser', 'error'];
    const levels = ['error', 'warn', 'log', 'info', 'debug', 'always'];
    const threshold = workspace.getConfiguration('p5-server.console').get(configKey + '.autoShow.level', defaultValue);
    if (levels.includes(level) && threshold !== 'never' && levels.indexOf(level) <= levels.indexOf(threshold)) {
      this.sketchConsole.show(true);
    }
  }
}

class ConsoleMessageLensProvider implements vscode.CodeLensProvider {
  private messages = new Map<string, { data: ConsoleMessageLensData; lens: vscode.CodeLens }>();
  private readonly _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  public addMessage(message: BrowserConsoleEvent) {
    const { file, clientId, line } = message;
    if (!file || !line) return;
    const key = ConsoleMessageLensData.key({ file, clientId, line });
    let record = this.messages.get(key);
    if (!record) {
      const col = message.col || 0;
      const range = new vscode.Range(line, col, line, col);
      const data = new ConsoleMessageLensData(file, clientId, line);
      const lens = new vscode.CodeLens(range, data);
      record = { data, lens };
      this.messages.set(key, record);
    }
    record.data.addMessage(message);
    this._onDidChangeCodeLenses.fire();
  }

  public removeMessages({ file, clientId }: { file?: string; clientId?: string }) {
    let changed = false;
    for (const [key, { data }] of this.messages) {
      if ((file && data.file === file) || (clientId && data.clientId === clientId)) {
        this.messages.delete(key); // delete during iteration is safe in javascript
        changed = true;
      }
    }
    if (changed) this._onDidChangeCodeLenses.fire();
  }

  public provideCodeLenses(document: vscode.TextDocument): vscode.ProviderResult<vscode.CodeLens[]> {
    const lenses = [];
    for (const { data, lens } of this.messages.values()) {
      if (data.file === document.fileName) {
        lenses.push(lens);
      }
    }
    return lenses;
  }
}

class ConsoleMessageLensData implements vscode.Command {
  private messages = new Array<BrowserConsoleEvent>();
  private count = 0;
  public readonly key: string;

  constructor(public readonly file: string, public readonly clientId: string, public readonly line: number) {
    this.key = ConsoleMessageLensData.key({ file, clientId, line });
  }

  public static key({ file, clientId, line }: { file: string; clientId: string; line: number }): string {
    return `${file}:${clientId}:${line}`;
  }

  public addMessage(message: BrowserConsoleEvent) {
    if (this.messages.unshift(message) > 10) {
      this.messages.pop();
    }
    this.count++;
  }

  private get message() {
    return this.messages[0];
  }

  public get command(): string {
    return 'p5-explorer.showScriptConsole';
  }

  public get title(): string {
    const { method } = this.message;
    let title = `console.${method}: ${formatArgs(this.message)}`;
    if (this.count > 1) {
      title += ` (+${this.count - 1} more)`;
    }
    return title;
  }

  public get tooltip(): string {
    return [
      ...this.messages.map(event => {
        // const ago = `(${(new Date() as any) - (event.timestamp as any)} ago)`;
        return formatArgs(event);
      }),
      this.count > this.messages.length ? `+${this.count - this.messages.length} more` : ''
    ].join('\n');
  }
}

function formatArgs({ args, argStrings }: BrowserConsoleEvent) {
  const argsOrStrings = args.map((arg, i) => argStrings[i] || arg);
  return typeof args[0] === 'string' ? util.format(...argsOrStrings) : argsOrStrings.join(' ');
}
