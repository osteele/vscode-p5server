import type { BrowserConsoleEvent, BrowserErrorEvent } from 'p5-server';
import * as vscode from 'vscode';
import { workspace } from 'vscode';
import { toZeroBasedPosition } from '../helpers';
import { workspaceUriForPath } from '../helpers/fileHelpers';
import { formatConsoleEventArgs } from './consoleHelpers';

/** Presents relayed console messages as inlay hints and runtime failures as Problems. */
export class ConsoleMessageProvider implements vscode.InlayHintsProvider, vscode.Disposable {
  private readonly messages = new Map<string, ConsoleMessageData>();
  private readonly keysByFile = new Map<string, Set<string>>();
  private readonly errors = new Map<string, RuntimeErrorData>();
  private readonly errorKeysByFile = new Map<string, Set<string>>();
  private readonly diagnostics = vscode.languages.createDiagnosticCollection('p5-server');
  private readonly changeEmitter = new vscode.EventEmitter<void>();
  private readonly configurationSubscription: vscode.Disposable;
  readonly onDidChangeInlayHints = this.changeEmitter.event;
  private enabled: boolean;
  private changeTimer?: NodeJS.Timeout;

  private static readonly maxLocations = 1000;
  private static readonly changeDebounceMs = 50;

  constructor() {
    this.enabled = workspace.getConfiguration('p5-server').get('editor.infoLens', true);
    this.configurationSubscription = workspace.onDidChangeConfiguration(event => {
      if (!event.affectsConfiguration('p5-server.editor.infoLens')) return;
      this.enabled = workspace.getConfiguration('p5-server').get('editor.infoLens', true);
      if (!this.enabled) this.clear();
      this.scheduleChangeEvent();
    });
  }

  addMessage(message: BrowserConsoleEvent | BrowserErrorEvent) {
    if (!this.enabled || !message.file) return;
    if (message.type === 'console' && message.line) {
      this.addConsoleMessage(message);
    } else if (message.type === 'error' && message.line) {
      this.addRuntimeError(message);
    }
  }

  removeMessages({ file, clientId }: { file?: string; clientId?: string }) {
    const changedFiles = new Set<string>();
    for (const [key, data] of this.messages) {
      if (matches(data, file, clientId)) this.deleteConsoleMessage(key);
    }
    for (const [key, data] of this.errors) {
      if (matches(data, file, clientId)) {
        changedFiles.add(data.file);
        this.deleteRuntimeError(key);
      }
    }
    changedFiles.forEach(changedFile => this.updateDiagnostics(changedFile));
    this.scheduleChangeEvent();
  }

  provideInlayHints(document: vscode.TextDocument, range: vscode.Range): vscode.InlayHint[] {
    if (!this.enabled) return [];
    const hints: vscode.InlayHint[] = [];
    for (const key of this.keysByFile.get(document.fileName) ?? []) {
      const data = this.messages.get(key);
      if (!data) continue;
      const lineNumber = data.line - 1;
      if (lineNumber < 0 || lineNumber >= document.lineCount || !range.contains(new vscode.Position(lineNumber, 0))) {
        continue;
      }
      const part = new vscode.InlayHintLabelPart(data.title);
      part.command = { command: 'p5-server.showScriptOutput', title: 'Show P5 Sketch Output' };
      part.tooltip = data.tooltip;
      const hint = new vscode.InlayHint(document.lineAt(lineNumber).range.end, [part]);
      hint.paddingLeft = true;
      hint.tooltip = data.tooltip;
      hints.push(hint);
    }
    return hints;
  }

  getDiagnostics(uri: vscode.Uri): readonly vscode.Diagnostic[] {
    return this.diagnostics.get(uri) ?? [];
  }

  clear() {
    this.messages.clear();
    this.keysByFile.clear();
    this.errors.clear();
    this.errorKeysByFile.clear();
    this.diagnostics.clear();
    this.scheduleChangeEvent();
  }

  private addConsoleMessage(message: BrowserConsoleEvent) {
    const { file, clientId, line } = message;
    if (!file || !line) return;
    const key = locationKey(file, clientId, line);
    let data = this.messages.get(key);
    if (!data) {
      data = new ConsoleMessageData(file, clientId, line);
      this.messages.set(key, data);
      addKey(this.keysByFile, file, key);
      this.evictOldest(this.messages, keyToDelete => this.deleteConsoleMessage(keyToDelete));
    } else {
      this.messages.delete(key);
      this.messages.set(key, data);
    }
    data.addMessage(message);
    this.scheduleChangeEvent();
  }

  private addRuntimeError(message: Extract<BrowserErrorEvent, { type: 'error' }>) {
    const { file, clientId, line } = message;
    if (!file || !line) return;
    const position = toZeroBasedPosition(line, message.col);
    const range = new vscode.Range(position.line, position.col, position.line, position.col + 1);
    const diagnostic = new vscode.Diagnostic(range, message.message, vscode.DiagnosticSeverity.Error);
    diagnostic.source = 'P5 Server';
    diagnostic.code = 'runtime';
    const key = locationKey(file, clientId, line, message.col);
    this.errors.delete(key);
    this.errors.set(key, { file, clientId, diagnostic });
    addKey(this.errorKeysByFile, file, key);
    while (this.errors.size > ConsoleMessageProvider.maxLocations) {
      const oldestKey = this.errors.keys().next().value;
      if (oldestKey === undefined) break;
      const evictedFile = this.errors.get(oldestKey)?.file;
      this.deleteRuntimeError(oldestKey);
      if (evictedFile) this.updateDiagnostics(evictedFile);
    }
    this.updateDiagnostics(file);
  }

  private updateDiagnostics(file: string) {
    const fileDiagnostics = [...(this.errorKeysByFile.get(file) ?? [])]
      .map(key => this.errors.get(key)?.diagnostic)
      .filter((diagnostic): diagnostic is vscode.Diagnostic => Boolean(diagnostic));
    const uri = workspaceUriForPath(file);
    if (fileDiagnostics.length) this.diagnostics.set(uri, fileDiagnostics);
    else this.diagnostics.delete(uri);
  }

  private evictOldest<T>(records: Map<string, T>, deleteRecord: (key: string) => void) {
    while (records.size > ConsoleMessageProvider.maxLocations) {
      const oldestKey = records.keys().next().value;
      if (oldestKey === undefined) return;
      deleteRecord(oldestKey);
    }
  }

  private deleteConsoleMessage(key: string) {
    const data = this.messages.get(key);
    if (!data) return;
    this.messages.delete(key);
    deleteKey(this.keysByFile, data.file, key);
  }

  private deleteRuntimeError(key: string) {
    const data = this.errors.get(key);
    if (!data) return;
    this.errors.delete(key);
    deleteKey(this.errorKeysByFile, data.file, key);
  }

  private scheduleChangeEvent() {
    if (this.changeTimer) return;
    this.changeTimer = setTimeout(() => {
      this.changeTimer = undefined;
      this.changeEmitter.fire();
    }, ConsoleMessageProvider.changeDebounceMs);
  }

  dispose() {
    if (this.changeTimer) clearTimeout(this.changeTimer);
    this.configurationSubscription.dispose();
    this.diagnostics.dispose();
    this.changeEmitter.dispose();
    this.messages.clear();
    this.keysByFile.clear();
    this.errors.clear();
    this.errorKeysByFile.clear();
  }
}

/** Aggregated console messages for a single browser client and source line. */
export class ConsoleMessageData {
  private readonly messages: { method: BrowserConsoleEvent['method']; text: string }[] = [];
  private count = 0;

  constructor(
    readonly file: string,
    readonly clientId: string,
    readonly line: number,
  ) {}

  addMessage(message: BrowserConsoleEvent) {
    if (this.messages.unshift({ method: message.method, text: formatConsoleEventArgs(message) }) > 10) {
      this.messages.pop();
    }
    this.count++;
  }

  get title(): string {
    const top = this.messages[0];
    return `console.${top.method}: ${top.text}${this.count > 1 ? ` (+${this.count - 1} more)` : ''}`;
  }

  get tooltip(): string {
    return [
      ...this.messages.map(message => message.text),
      this.count > this.messages.length ? `+${this.count - this.messages.length} more` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }
}

type RuntimeErrorData = {
  file: string;
  clientId: string;
  diagnostic: vscode.Diagnostic;
};

function locationKey(file: string, clientId: string, line: number, col?: number): string {
  return `${file}:${clientId}:${line}:${col ?? ''}`;
}

function matches(data: { file: string; clientId: string }, file?: string, clientId?: string): boolean {
  if (file && clientId) return data.file === file && data.clientId === clientId;
  return (file !== undefined && data.file === file) || (clientId !== undefined && data.clientId === clientId);
}

function addKey(index: Map<string, Set<string>>, file: string, key: string) {
  const keys = index.get(file) ?? new Set<string>();
  keys.add(key);
  index.set(file, keys);
}

function deleteKey(index: Map<string, Set<string>>, file: string, key: string) {
  const keys = index.get(file);
  keys?.delete(key);
  if (keys?.size === 0) index.delete(file);
}
