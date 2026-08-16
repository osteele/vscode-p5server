import * as assert from 'node:assert';
import * as vscode from 'vscode';

suite('Extension manifest', () => {
  const manifest = vscode.extensions.getExtension('osteele.p5-server')?.packageJSON;

  test('keeps status items available after startup', () => {
    assert.ok(manifest.activationEvents.includes('onStartupFinished'));
    assert.strictEqual(
      manifest.contributes.configuration.properties['p5-server.statusBar.browserItem.enabled'].default,
      true,
    );
    assert.strictEqual(
      manifest.contributes.configuration.properties['p5-server.statusBar.serverItem.enabled'].default,
      true,
    );
  });

  test('declares remote and workspace trust behavior', () => {
    assert.deepStrictEqual(manifest.extensionKind, ['workspace']);
    assert.strictEqual(manifest.capabilities.virtualWorkspaces.supported, false);
    assert.strictEqual(manifest.capabilities.untrustedWorkspaces.supported, 'limited');
    const debugCommand = manifest.contributes.commands.find(
      (contribution: { command: string }) => contribution.command === 'p5-server.debug',
    );
    assert.match(debugCommand.enablement, /isWorkspaceTrusted/);
  });

  test('offers the p5.js 2 conversion on a compatibility add-on row', () => {
    const command = manifest.contributes.commands.find(
      (contribution: { command: string }) => contribution.command === 'p5-server.convertSketch#p5v2',
    );
    assert.ok(command, 'the conversion command is contributed');

    const menuItem = manifest.contributes.menus['view/item/context'].find(
      (contribution: { command: string }) => contribution.command === 'p5-server.convertSketch#p5v2',
    );
    // The row is what tells the user the sketch has not been converted, so the
    // conversion has to be reachable from it.
    assert.match(menuItem.when, /viewItem == compat-library/);
  });

  test('contributes the getting-started walkthrough', () => {
    const walkthrough = manifest.contributes.walkthroughs.find(
      (contribution: { id: string }) => contribution.id === 'p5-server.gettingStarted',
    );
    assert.deepStrictEqual(
      walkthrough.steps.map((step: { id: string }) => step.id),
      ['createSketch', 'runSketch', 'inspectConsole', 'debugSketch'],
    );
  });
});
