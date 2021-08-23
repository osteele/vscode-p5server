import { Server } from 'p5-server';
import * as vscode from 'vscode';
import { window, workspace } from 'vscode';

export class ScriptConsole {
  private _sketchConsole: vscode.OutputChannel | null = null;
  private file?: string;

  subscribe(server: Server) {
    server.onScriptEvent(
      'console',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (data: { method: string; args: any[]; argStrings: string[]; file: string; url: string }) => {
        const { method, args, file, url } = data;
        if (method === 'clear') {
          this.sketchConsole.clear();
        } else {
          this.setFile(file || url);
          const argStrings = data.argStrings.map((str, i) => str || String(args[i]));
          this.sketchConsole.appendLine(`${method}: ${argStrings.join(', ')}`);
          this.maybeShowConsole(method);
        }
      }
    );

    server.onScriptEvent(
      'error',
      (data: { message: string; file?: string; url?: string; line?: number; stack?: string }) => {
        const { message, url, file, line, stack } = data;
        this.maybeShowConsole('error');
        let msg = 'Error';
        if (line) {
          msg += ` at line ${line}`;
        }
        if (file || url) {
          msg += ` of ${file || url}`;
        }
        this.setFile(file || url);
        this.sketchConsole.appendLine(stack || `${msg}: ${message}`);
      }
    );

    server.onScriptEvent('window', (data: { event: string; url?: string; file?: string }) => {
      const { event, file, url } = data;
      if (event === 'DOMContentLoaded') {
        this.setFile(file || url, true);
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

  private setFile(file: string | undefined, always = false) {
    if ((this.file === file || !file) && !always) return;
    this.file = file;
    const label = ` (${file}) `;
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
