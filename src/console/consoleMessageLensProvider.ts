import { BrowserConsoleEvent, BrowserErrorEvent } from 'p5-server';
import * as vscode from 'vscode';
import { workspace } from 'vscode';
import { formatConsoleEventArgs } from './helpers';

export class ConsoleMessageLensProvider implements vscode.CodeLensProvider {
  private messages = new Map<string, { data: ConsoleMessageLensData; lens: vscode.CodeLens }>();
  private readonly _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  constructor() {
    workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('p5-server.editor.infoLens')) {
        this._onDidChangeCodeLenses.fire();
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
    if (!workspace.getConfiguration('p5-server').get<boolean>('editor.infoLens')) return [];
    const lenses = [];
    for (const { data, lens } of this.messages.values()) {
      if (data.file === document.fileName) {
        lenses.push(lens);
      }
    }
    return lenses;
  }
}

/** Aggregated console and error messages for a single (file, line) location. */
export class ConsoleMessageLensData implements vscode.Command {
  private messages = new Array<BrowserConsoleEvent | BrowserErrorEvent>();
  private count = 0; // number of messages ever, including messages windowed out from this.messages
  public readonly key: string;

  constructor(public readonly file: string, public readonly clientId: string, public readonly line: number) {
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
      this.count > this.messages.length ? `+${this.count - this.messages.length} more` : ''
    ].join('\n');
  }
}
