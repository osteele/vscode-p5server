import { Server, BrowserConsoleEvent, BrowserErrorEvent, BrowserWindowEvent } from 'p5-server';
import * as vscode from 'vscode';
import { window, workspace } from 'vscode';

export class ScriptConsole {
  private _sketchConsole: vscode.OutputChannel | null = null;
  private clientId?: string;

  subscribe(server: Server) {
    server.onScriptEvent(
      'console',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (event: BrowserConsoleEvent) => {
        const { method, args, clientId, file, url } = event;
        if (method === 'clear') {
          this.sketchConsole.clear();
        } else {
          this.setFile(clientId, file || url);
          this.maybeShowConsole(method);
          const argStrings = event.argStrings.map((str, i) => str || String(args[i]));
          this.sketchConsole.appendLine(`[${method.toUpperCase()}] ${argStrings.join(', ')}`);
        }
      }
    );

    server.onScriptEvent('error', (event: BrowserErrorEvent) => {
      const { message, clientId, file, url, stack } = event;
      this.setFile(clientId, file || url);
      this.maybeShowConsole('error');
      let msg = 'Error';
      if (event.type === 'error' && event.line) {
        msg += ` at line ${event.line}`;
      }
      if (file || url) {
        msg += ` of ${file || url}`;
      }
      this.sketchConsole.appendLine(stack || `${msg}: ${message}`);
    });

    server.onScriptEvent('window', (event: BrowserWindowEvent) => {
      const { type, clientId, file, url } = event;
      if (type === 'DOMContentLoaded') {
        this.setFile(clientId, file || url, true);
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

  private setFile(clientId: string, file: string | undefined, always = false) {
    if ((this.clientId === clientId || !clientId) && !always) return;
    this.clientId = clientId;
    const label = file ? ` (${file}) ` : '';
    const halfLen = Math.floor((80 - label.length) / 2);
    this.sketchConsole.appendLine('='.repeat(halfLen) + label + '='.repeat(halfLen));
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
