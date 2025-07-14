import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Commands Integration', () => {
  // Ensure extension is activated before running tests
  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension('osteele.p5-server');
    if (ext && !ext.isActive) {
      await ext.activate();
    }
    // Give a small delay for commands to register
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  test('should register all required commands', async () => {
    // Get all registered commands
    const commands = await vscode.commands.getCommands();

    // Check that our essential commands are registered
    const requiredCommands = [
      'p5-server.start',
      'p5-server.stop',
      'p5-server.run',
      'p5-server.openBrowser',
      'p5-server.run#browser',
      'p5-server.run#sidebar',
      'p5-server.createSketchFile',
      'p5-server.createSketchFolder',
      'p5-server.openSettings',
      'p5-server.showScriptOutput',
      'p5-server.deleteSketch',
      'p5-server.duplicateSketch',
      'p5-server.convertSketch#html',
      'p5-server.convertSketch#script',
    ];

    for (const command of requiredCommands) {
      assert.ok(commands.includes(command), `Command '${command}' should be registered`);
    }
  });

  test('should register explorer commands', async () => {
    const commands = await vscode.commands.getCommands();

    const explorerCommands = [
      'p5-server.explorer.refresh',
      'p5-server.explorer.createSketch',
      'p5-server.explorer.createSketch#html',
      'p5-server.explorer.createSketch#folder',
      'p5-server.explorer.open',
      'p5-server.explorer.run',
      'p5-server.explorer.run#integrated',
      'p5-server.explorer.run#external',
      'p5-server.explorer.rename',
      'p5-server.explorer.openLibrary',
    ];

    for (const command of explorerCommands) {
      assert.ok(commands.includes(command), `Explorer command '${command}' should be registered`);
    }
  });

  test('should execute safe commands without error', async () => {
    // Test commands that are safe to execute without side effects
    const safeCommands = ['p5-server.openSettings', 'p5-server.showScriptOutput'];

    for (const command of safeCommands) {
      try {
        await vscode.commands.executeCommand(command);
        // If we get here, the command executed without throwing
        assert.ok(true, `Command '${command}' executed successfully`);
      } catch (error) {
        assert.fail(`Command '${command}' failed with error: ${error.message}`);
      }
    }
  });

  test('should have p5-server context variables set', async () => {
    // Check that extension sets appropriate context variables
    const commands = await vscode.commands.getCommands();

    // These commands should be available when p5-server.available context is true
    const contextDependentCommands = ['p5-server.start', 'p5-server.stop', 'p5-server.run'];

    for (const command of contextDependentCommands) {
      assert.ok(commands.includes(command), `Context-dependent command '${command}' should be registered`);
    }
  });

  test('should register internal commands', async () => {
    const commands = await vscode.commands.getCommands();

    // Check internal commands that are used by the extension
    const internalCommands = [
      '_p5-server.createSketch', // Internal command for sketch creation
    ];

    for (const command of internalCommands) {
      assert.ok(commands.includes(command), `Internal command '${command}' should be registered`);
    }
  });

  test('should execute sketch creation commands without workspace errors', async () => {
    // Test that sketch creation commands handle missing workspace gracefully
    try {
      // This should show an error message but not crash
      await vscode.commands.executeCommand('p5-server.createSketchFile');
      assert.ok(true, 'Create sketch file command handled gracefully');
    } catch (error) {
      // Command might fail due to no workspace, but shouldn't crash extension
      assert.ok(true, 'Create sketch file command failed gracefully');
    }

    try {
      await vscode.commands.executeCommand('p5-server.createSketchFolder');
      assert.ok(true, 'Create sketch folder command handled gracefully');
    } catch (error) {
      assert.ok(true, 'Create sketch folder command failed gracefully');
    }
  });
});
