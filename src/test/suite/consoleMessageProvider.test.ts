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

  test('ignores messages while disabled', async () => {
    const config = vscode.workspace.getConfiguration('p5-server.editor');
    await config.update('infoLens', false, false);
    const provider = new ConsoleMessageProvider();
    const document = await vscode.workspace.openTextDocument({ language: 'javascript', content: '\n' });
    try {
      provider.addMessage(consoleEvent(0, document.fileName, 1));
      const hints = provider.provideInlayHints(document, fullRange(document));
      assert.strictEqual(hints.length, 0);
    } finally {
      provider.dispose();
      await config.update('infoLens', undefined, false);
    }
  });

  test('clears messages and errors when disabled', async () => {
    const config = vscode.workspace.getConfiguration('p5-server.editor');
    await config.update('infoLens', true, false);
    const provider = new ConsoleMessageProvider();
    const document = await vscode.workspace.openTextDocument({ language: 'javascript', content: '\n' });
    const uri = vscode.Uri.file(document.fileName);
    try {
      provider.addMessage(consoleEvent(0, document.fileName, 1));
      provider.addMessage(errorEvent(document.fileName));
      await sleep(100);
      assert.ok(provider.getDiagnostics(uri).length > 0);

      await config.update('infoLens', false, false);
      await sleep(100);
      assert.strictEqual(provider.provideInlayHints(document, fullRange(document)).length, 0);
      assert.strictEqual(provider.getDiagnostics(uri).length, 0);
    } finally {
      provider.dispose();
      await config.update('infoLens', undefined, false);
    }
  });

  test('removes messages by file', async () => {
    const provider = new ConsoleMessageProvider();
    const documentA = await vscode.workspace.openTextDocument({ language: 'javascript', content: '\n' });
    const documentB = await vscode.workspace.openTextDocument({ language: 'javascript', content: '\n' });
    try {
      provider.addMessage(consoleEvent(0, documentA.fileName, 1));
      provider.addMessage(consoleEvent(1, documentB.fileName, 1));
      await sleep(100);
      assert.strictEqual(provider.provideInlayHints(documentA, fullRange(documentA)).length, 1);
      assert.strictEqual(provider.provideInlayHints(documentB, fullRange(documentB)).length, 1);

      provider.removeMessages({ file: documentA.fileName });
      await sleep(100);
      assert.strictEqual(provider.provideInlayHints(documentA, fullRange(documentA)).length, 0);
      assert.strictEqual(provider.provideInlayHints(documentB, fullRange(documentB)).length, 1);
    } finally {
      provider.dispose();
    }
  });

  test('removes messages by client', async () => {
    const provider = new ConsoleMessageProvider();
    const file = '/tmp/sketch.js';
    const uri = vscode.Uri.file(file);
    try {
      provider.addMessage(errorEvent(file, 'client-a'));
      provider.addMessage(errorEvent(file, 'client-b'));
      await sleep(100);
      assert.strictEqual(provider.getDiagnostics(uri).length, 2);

      provider.removeMessages({ clientId: 'client-a' });
      await sleep(100);
      assert.strictEqual(provider.getDiagnostics(uri).length, 1);
    } finally {
      provider.dispose();
    }
  });

  test('clear removes everything', async () => {
    const provider = new ConsoleMessageProvider();
    const document = await vscode.workspace.openTextDocument({ language: 'javascript', content: '\n' });
    const uri = vscode.Uri.file(document.fileName);
    try {
      provider.addMessage(consoleEvent(0, document.fileName, 1));
      provider.addMessage(errorEvent(document.fileName));
      await sleep(100);
      assert.ok(provider.provideInlayHints(document, fullRange(document)).length > 0);
      assert.ok(provider.getDiagnostics(uri).length > 0);

      provider.clear();
      await sleep(100);
      assert.strictEqual(provider.provideInlayHints(document, fullRange(document)).length, 0);
      assert.strictEqual(provider.getDiagnostics(uri).length, 0);
    } finally {
      provider.dispose();
    }
  });

  test('console messages and runtime errors coexist on the same file', async () => {
    const provider = new ConsoleMessageProvider();
    const document = await vscode.workspace.openTextDocument({ language: 'javascript', content: '\n' });
    const uri = vscode.Uri.file(document.fileName);
    try {
      provider.addMessage(consoleEvent(0, document.fileName, 1));
      provider.addMessage(errorEvent(document.fileName));
      await sleep(100);

      const hints = provider.provideInlayHints(document, fullRange(document));
      const diagnostics = provider.getDiagnostics(uri);
      assert.strictEqual(hints.length, 1);
      assert.strictEqual(diagnostics.length, 1);
      const label = hints[0].label[0];
      const labelText = typeof label === 'string' ? label : label.value;
      assert.ok(labelText.includes('console.log'));
      assert.strictEqual(diagnostics[0].message, 'boom');
    } finally {
      provider.dispose();
    }
  });
});

function fullRange(document: vscode.TextDocument): vscode.Range {
  return new vscode.Range(0, 0, document.lineCount - 1, 0);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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

function errorEvent(file: string, clientId = 'client'): BrowserErrorEvent {
  return {
    type: 'error',
    message: 'boom',
    clientId,
    file,
    line: 2,
    col: 3,
    timestamp: new Date(),
    url: 'http://localhost/sketch.js',
  };
}
