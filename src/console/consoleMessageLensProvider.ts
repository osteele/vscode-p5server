import { BrowserConsoleEvent, BrowserErrorEvent } from 'p5-server';
import * as vscode from 'vscode';
import { workspace } from 'vscode';
import { formatConsoleEventArgs } from './consoleHelpers';
import { toZeroBasedPosition } from '../helpers';

export class ConsoleMessageLensProvider implements vscode.CodeLensProvider, vscode.Disposable {
  private messages = new Map<string, { data: ConsoleMessageLensData; lens: vscode.CodeLens }>();
  private keysByFile = new Map<string, Set<string>>();
  private readonly _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  private readonly configurationSubscription: vscode.Disposable;
  readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;
  private enabled: boolean;
  private changeTimer?: NodeJS.Timeout;

  private static readonly maxMessageLocations = 1000;
  private static readonly changeDebounceMs = 50;

  constructor() {
    this.enabled = workspace.getConfiguration('p5-server').get('editor.infoLens', true);
    this.configurationSubscription = workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('p5-server.editor.infoLens')) {
        this.enabled = workspace.getConfiguration('p5-server').get('editor.infoLens', true);
        if (!this.enabled) this.clearMessages();
        this.scheduleChangeEvent();
      }
    });
  }

  public addMessage(message: BrowserConsoleEvent | BrowserErrorEvent) {
    if (!this.enabled || message.type === 'unhandledRejection') return;
    const { file, clientId, line } = message;
    if (!file || !line) return;
    const key = ConsoleMessageLensData.key({ file, clientId, line });
    let record = this.messages.get(key);
    if (!record) {
      const position = toZeroBasedPosition(line, message.col);
      const range = new vscode.Range(position.line, position.col, position.line, position.col);
      const data = new ConsoleMessageLensData(file, clientId, line);
      const lens = new vscode.CodeLens(range, data);
      record = { data, lens };
      this.messages.set(key, record);
      const fileKeys = this.keysByFile.get(file) ?? new Set<string>();
      fileKeys.add(key);
      this.keysByFile.set(file, fileKeys);
      this.evictOldestLocations();
    } else {
      // Preserve insertion order as a least-recently-used eviction order.
      this.messages.delete(key);
      this.messages.set(key, record);
    }
    record.data.addMessage(message);
    this.scheduleChangeEvent();
  }

  public removeMessages({ file, clientId }: { file?: string; clientId?: string }) {
    let changed = false;
    if (file && !clientId) {
      for (const key of this.keysByFile.get(file) ?? []) {
        changed = this.deleteMessage(key) || changed;
      }
    } else {
      for (const [key, { data }] of this.messages) {
        if ((file && data.file === file) || (clientId && data.clientId === clientId)) {
          changed = this.deleteMessage(key) || changed;
        }
      }
    }
    if (changed) this.scheduleChangeEvent();
  }

  public provideCodeLenses(document: vscode.TextDocument): vscode.ProviderResult<vscode.CodeLens[]> {
    if (!this.enabled) return [];
    const lenses: vscode.CodeLens[] = [];
    for (const key of this.keysByFile.get(document.fileName) ?? []) {
      const record = this.messages.get(key);
      if (record) lenses.push(record.lens);
    }
    return lenses;
  }

  private scheduleChangeEvent() {
    if (this.changeTimer) return;
    this.changeTimer = setTimeout(() => {
      this.changeTimer = undefined;
      this._onDidChangeCodeLenses.fire();
    }, ConsoleMessageLensProvider.changeDebounceMs);
  }

  private evictOldestLocations() {
    while (this.messages.size > ConsoleMessageLensProvider.maxMessageLocations) {
      const oldestKey = this.messages.keys().next().value;
      if (oldestKey === undefined) return;
      this.deleteMessage(oldestKey);
    }
  }

  private deleteMessage(key: string): boolean {
    const record = this.messages.get(key);
    if (!record) return false;
    this.messages.delete(key);
    const fileKeys = this.keysByFile.get(record.data.file);
    fileKeys?.delete(key);
    if (fileKeys?.size === 0) this.keysByFile.delete(record.data.file);
    return true;
  }

  private clearMessages() {
    this.messages.clear();
    this.keysByFile.clear();
  }

  public dispose() {
    if (this.changeTimer) {
      clearTimeout(this.changeTimer);
      this.changeTimer = undefined;
    }
    this.configurationSubscription.dispose();
    this._onDidChangeCodeLenses.dispose();
    this.clearMessages();
  }
}

/** Aggregated console and error messages for a single (file, line) location. */
export class ConsoleMessageLensData implements vscode.Command {
  private messages: ConsoleMessageSummary[] = [];
  private count = 0; // number of messages ever, including messages windowed out from this.messages
  public readonly key: string;

  constructor(
    public readonly file: string,
    public readonly clientId: string,
    public readonly line: number,
  ) {
    this.key = ConsoleMessageLensData.key({ file, clientId, line });
  }

  public static key({ file, clientId, line }: { file: string; clientId: string; line: number }): string {
    return `${file}:${clientId}:${line}`;
  }

  public addMessage(message: BrowserConsoleEvent | BrowserErrorEvent) {
    const summary: ConsoleMessageSummary =
      message.type === 'error'
        ? { type: 'error', message: message.message, stack: message.stack }
        : message.type === 'unhandledRejection'
          ? { type: 'error', message: message.message }
          : { type: 'console', method: message.method, text: formatConsoleEventArgs(message) };
    if (this.messages.unshift(summary) > 10) {
      this.messages.pop();
    }
    this.count++;
  }

  public get command(): string {
    return 'p5-server.showScriptOutput';
  }

  public get title(): string {
    const top = this.messages[0];
    if (top.type === 'error') {
      return top.message;
    } else {
      const { method } = top;
      let title = `console.${method}: ${top.text}`;
      if (this.count > 1) {
        title += ` (+${this.count - 1} more)`;
      }
      return title;
    }
  }

  public get tooltip(): string {
    const top = this.messages[0];
    if (top.type === 'error') {
      return top.stack || top.message;
    }
    return [
      ...this.messages.map(message => (message.type === 'error' ? message.message : message.text)),
      this.count > this.messages.length ? `+${this.count - this.messages.length} more` : '',
    ].join('\n');
  }
}

type ConsoleMessageSummary =
  | { type: 'console'; method: BrowserConsoleEvent['method']; text: string }
  | { type: 'error'; message: string; stack?: string };
