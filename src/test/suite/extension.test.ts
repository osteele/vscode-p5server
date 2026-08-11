import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
// import * as myExtension from '../../extension';

suite('Extension Test Suite', () => {
  test('activates the extension', async () => {
    const extension = vscode.extensions.getExtension('osteele.p5-server');
    assert.ok(extension, 'Extension should be installed in the test host');
    await extension.activate();
    assert.ok(extension.isActive, 'Extension should be active');
  });
});
