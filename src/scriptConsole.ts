import { Server, BrowserConsoleEvent, BrowserErrorEvent, BrowserConnectionEvent } from 'p5-server';
import * as vscode from 'vscode';
import { window, workspace } from 'vscode';

export class ScriptConsole {
  private _sketchConsole: vscode.OutputChannel | null = null;
  private clientId?: string;
  private file?: string;
  private messageCount = 0;

  subscribe(server: Server) {
    server.onScriptEvent('console', (event: BrowserConsoleEvent) => {
      const { method, args, argStrings, clientId, file, url } = event;
      if (method === 'clear') {
        this.clear();
      } else {
        this.setFile(file || url, clientId);
        this.maybeShowConsole(method);
        const argsOrStrings = args.map((arg, i) => argStrings[i] ?? arg);
        // TODO:
        // const message = typeof args[0] === 'string' ? util.format(...argsOrStrings) : argsOrStrings.join(' ');
        this.appendLine(`[${method.toUpperCase()}] ${argsOrStrings.join(', ')}`);
      }
    });

    server.onScriptEvent('error', (event: BrowserErrorEvent) => {
      const { message, clientId, file, url, stack } = event;
      this.setFile(file || url, clientId);
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
      const { type, clientId, file, url } = event;
      if (type === 'opened') {
        if (!this.setFile(file || url, clientId)) {
          const label = '[RELOAD]';
          const halfLen = Math.floor((80 - label.length) / 2);
          this.sketchConsole.appendLine('-'.repeat(halfLen) + label + '-'.repeat(halfLen));
        }
        this.messageCount = 0;
        this.clientId = clientId;
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
  private setFile(file: string | undefined, clientId: string) {
    if (this.file === file) return false;
    this.file = file;
    this.clientId = clientId;
    const label = file ? ` (${file}) ` : '';
    const halfLen = Math.floor((80 - label.length) / 2);
    this.sketchConsole.appendLine('='.repeat(halfLen) + label + '='.repeat(halfLen));
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
