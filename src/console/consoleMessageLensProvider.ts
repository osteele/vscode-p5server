import { BrowserConsoleEvent, BrowserErrorEvent } from 'p5-server';
import * as vscode from 'vscode';
import { workspace } from 'vscode';
import { formatConsoleEventArgs } from './consoleHelpers';

export class ConsoleMessageLensProvider implements vscode.CodeLensProvider {
  private messages = new Map<string, { data: ConsoleMessageLensData; lens: vscode.CodeLens }>();
  private readonly _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  // Adaptive debouncing for CodeLens updates
  private updateTimes: number[] = [];
  private debounceMode = false;
  private debounceTimer?: NodeJS.Timeout;
  private pendingUpdate = false;
  private readonly rateWindowMs = 1000; // Track updates over 1 second
  private readonly highRateThreshold = 15; // Updates per second
  private readonly lowRateThreshold = 3; // Updates per second to exit debounce mode
  private readonly debounceIntervalMs = 200; // Debounce for 200ms when in debounce mode

  constructor() {
    workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('p5-server.editor.infoLens')) {
        this.fireChangeEvent();
      }
    });
  }

  public addMessage(message: BrowserConsoleEvent | BrowserErrorEvent) {
    if (message.type === 'unhandledRejection') return;
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
    this.fireChangeEvent();
  }

  public removeMessages({ file, clientId }: { file?: string; clientId?: string }) {
    let changed = false;
    for (const [key, { data }] of this.messages) {
      if ((file && data.file === file) || (clientId && data.clientId === clientId)) {
        this.messages.delete(key); // delete during iteration is safe in javascript
        changed = true;
      }
    }
    if (changed) this.fireChangeEvent();
  }

  public provideCodeLenses(document: vscode.TextDocument): vscode.ProviderResult<vscode.CodeLens[]> {
    if (!workspace.getConfiguration('p5-server').get<boolean>('editor.infoLens')) return [];
    const lenses = [];
    for (const { data, lens } of this.messages.values()) {
      if (data.file === document.fileName) {
        lenses.push(lens);
      }
    }
    return lenses;
  }

  /** Fire a change event with adaptive debouncing */
  private fireChangeEvent() {
    this.updateRate();

    if (this.debounceMode) {
      // In debounce mode, schedule an update if not already pending
      this.pendingUpdate = true;
      if (!this.debounceTimer) {
        this.debounceTimer = setTimeout(() => {
          if (this.pendingUpdate) {
            this._onDidChangeCodeLenses.fire();
            this.pendingUpdate = false;
          }
          this.debounceTimer = undefined;
        }, this.debounceIntervalMs);
      }
    } else {
      // Immediate mode - fire directly
      this._onDidChangeCodeLenses.fire();
    }
  }

  /** Track update rate and adjust debounce mode */
  private updateRate() {
    const now = Date.now();
    // Remove timestamps older than the rate window
    this.updateTimes = this.updateTimes.filter(time => now - time < this.rateWindowMs);
    // Add current timestamp
    this.updateTimes.push(now);

    const currentRate = this.updateTimes.length;

    if (!this.debounceMode && currentRate > this.highRateThreshold) {
      // Enter debounce mode
      this.debounceMode = true;
    } else if (this.debounceMode && currentRate < this.lowRateThreshold) {
      // Exit debounce mode
      this.debounceMode = false;
      // Clear any pending debounced update
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = undefined;
      }
      // Fire immediately if there was a pending update
      if (this.pendingUpdate) {
        this._onDidChangeCodeLenses.fire();
        this.pendingUpdate = false;
      }
    }
  }
}

/** Aggregated console and error messages for a single (file, line) location. */
export class ConsoleMessageLensData implements vscode.Command {
  private messages = new Array<BrowserConsoleEvent | BrowserErrorEvent>();
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
    if (this.messages.unshift(message) > 10) {
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
    } else if (top.type === 'unhandledRejection') {
      throw new Error('unandledRejection');
    } else {
      const { method } = top;
      let title = `console.${method}: ${formatConsoleEventArgs(top)}`;
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
      ...this.messages.map(event => {
        // const ago = `(${(new Date() as any) - (event.timestamp as any)} ago)`;
        switch (event.type) {
          case 'error':
            return `${event.message}`;
          case 'unhandledRejection':
            return `${event.message}`;
          default:
            return formatConsoleEventArgs(event);
        }
      }),
      this.count > this.messages.length ? `+${this.count - this.messages.length} more` : '',
    ].join('\n');
  }
}
