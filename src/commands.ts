import type { Sketch } from 'p5-server';
import * as vscode from 'vscode';
import { commands } from 'vscode';

export function registerCommands(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    commands.registerCommand(
      '_p5-server.createSketch',
      async (options: { dir?: string; type: 'script' | 'html' | 'folder' }) =>
        (await import('./commands/sketchCommands')).createSketch(options),
    ),
    commands.registerCommand('p5-server.convertSketch#html', async (sketch: Sketch) =>
      (await import('./commands/conversionCommands')).convertSketch(sketch, 'html'),
    ),
    commands.registerCommand('p5-server.convertSketch#script', async (sketch: Sketch) =>
      (await import('./commands/conversionCommands')).convertSketch(sketch, 'script'),
    ),
    commands.registerCommand('p5-server.createSketchFile', async () =>
      (await import('./commands/sketchCommands')).createSketch({ type: 'script' }),
    ),
    commands.registerCommand('p5-server.createSketchFolder', async () =>
      (await import('./commands/sketchCommands')).createSketch({ type: 'folder' }),
    ),
    commands.registerCommand('p5-server.deleteSketch', async (sketch: Sketch) =>
      (await import('./commands/sketchCommands')).deleteSketch(sketch),
    ),
    commands.registerCommand('p5-server.duplicateSketch', async (sketch: Sketch) =>
      (await import('./commands/conversionCommands')).duplicateSketch(sketch),
    ),
    commands.registerCommand('p5-server.run', async () => (await import('./commands/runCommands')).runSketch()),
    commands.registerCommand('p5-server.run#browser', async () =>
      (await import('./commands/runCommands')).runSketchInBrowser(),
    ),
    commands.registerCommand('p5-server.run#sidebar', async () =>
      (await import('./commands/runCommands')).runSketchInSidebar(),
    ),
    commands.registerCommand('p5-server.openSettings', async () =>
      (await import('./commands/runCommands')).openSettings(),
    ),
  );
}
