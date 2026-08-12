import * as assert from 'node:assert';
import type { BrowserConsoleEvent, BrowserErrorEvent } from 'p5-server';
import * as vscode from 'vscode';
import { ConsoleMessageData, ConsoleMessageProvider } from '../../console/consoleMessageProvider';

suite('Console Message Provider', () => {
  test('retains compact recent summaries', () => {
    const data = new ConsoleMessageData('/tmp/sketch.js', 'client', 1);
    for (let index = 0; index < 12; index++) data.addMessage(consoleEvent(index));

    assert.strictEqual(data.title, 'console.log: message 11 (+11 more)');
    assert.match(data.tooltip, /^message 11\nmessage 10/);
    assert.match(data.tooltip, /\+2 more$/);
    assert.doesNotMatch(data.tooltip, /message 0(?:\n|$)/);
  });

  test('coalesces updates and caps retained locations', async () => {
    const provider = new ConsoleMessageProvider();
    const document = await vscode.workspace.openTextDocument({ language: 'javascript', content: '\n'.repeat(1000) });
    let changes = 0;
    const changeSubscription = provider.onDidChangeInlayHints(() => changes++);
    try {
      for (let index = 0; index < 1001; index++) {
        provider.addMessage(consoleEvent(index, document.fileName, index + 1));
      }
      await new Promise(resolve => setTimeout(resolve, 100));

      assert.strictEqual(changes, 1);
      const range = new vscode.Range(0, 0, document.lineCount - 1, 0);
      const hints = provider.provideInlayHints(document, range);
      assert.strictEqual(hints.length, 1000);
    } finally {
      changeSubscription.dispose();
      provider.dispose();
    }
  });

  test('publishes runtime errors as diagnostics and removes them by client', () => {
    const provider = new ConsoleMessageProvider();
    const file = '/tmp/sketch.js';
    const uri = vscode.Uri.file(file);
    try {
      provider.addMessage(errorEvent(file));
      const diagnostics = provider.getDiagnostics(uri);
      assert.strictEqual(diagnostics.length, 1);
      assert.strictEqual(diagnostics[0].message, 'boom');
      assert.strictEqual(diagnostics[0].source, 'P5 Server');

      provider.removeMessages({ clientId: 'client' });
      assert.strictEqual(provider.getDiagnostics(uri).length, 0);
    } finally {
      provider.dispose();
    }
  });
});

function consoleEvent(index: number, file = '/tmp/sketch.js', line = 1): BrowserConsoleEvent {
  return {
    type: 'console',
    method: 'log',
    args: [`message ${index}`],
    argStrings: [null],
    clientId: 'client',
    file,
    line,
    timestamp: new Date(),
    url: 'http://localhost/sketch.js',
  };
}

function errorEvent(file: string): BrowserErrorEvent {
  return {
    type: 'error',
    message: 'boom',
    clientId: 'client',
    file,
    line: 2,
    col: 3,
    timestamp: new Date(),
    url: 'http://localhost/sketch.js',
  };
}
