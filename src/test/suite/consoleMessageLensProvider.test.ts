import * as assert from 'node:assert';
import type { BrowserConsoleEvent } from 'p5-server';
import * as vscode from 'vscode';
import { ConsoleMessageLensData, ConsoleMessageLensProvider } from '../../console/consoleMessageLensProvider';

suite('Console Message Lens Provider', () => {
  test('retains compact recent summaries', () => {
    const data = new ConsoleMessageLensData('/tmp/sketch.js', 'client', 1);
    for (let index = 0; index < 12; index++) data.addMessage(consoleEvent(index));

    assert.strictEqual(data.title, 'console.log: message 11 (+11 more)');
    assert.match(data.tooltip, /^message 11\nmessage 10/);
    assert.match(data.tooltip, /\+2 more$/);
    assert.doesNotMatch(data.tooltip, /message 0(?:\n|$)/);
  });

  test('coalesces updates and caps retained locations', async () => {
    const provider = new ConsoleMessageLensProvider();
    const document = await vscode.workspace.openTextDocument({ language: 'javascript', content: '' });
    let changes = 0;
    const changeSubscription = provider.onDidChangeCodeLenses(() => changes++);
    try {
      for (let index = 0; index < 1001; index++) {
        provider.addMessage(consoleEvent(index, document.fileName, index + 1));
      }
      await new Promise(resolve => setTimeout(resolve, 100));

      assert.strictEqual(changes, 1);
      const lenses = await provider.provideCodeLenses(document);
      assert.strictEqual(lenses?.length, 1000);
    } finally {
      changeSubscription.dispose();
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
