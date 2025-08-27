import { Sketch } from 'p5-server';
import * as vscode from 'vscode';
import { commands } from 'vscode';
import { createSketch, deleteSketch } from './commands/sketchCommands';
import { convertSketch, duplicateSketch } from './commands/conversionCommands';
import { runSketch, runSketchInBrowser, runSketchInSidebar, openSettings } from './commands/runCommands';

export function registerCommands(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    commands.registerCommand(
      '_p5-server.createSketch',
      (options: { dir?: string; type: 'script' | 'html' | 'folder' }) => createSketch(options),
    ),
    commands.registerCommand('p5-server.convertSketch#html', (sketch: Sketch) => convertSketch(sketch, 'html')),
    commands.registerCommand('p5-server.convertSketch#script', (sketch: Sketch) => convertSketch(sketch, 'script')),
    commands.registerCommand('p5-server.createSketchFile', () => createSketch({ type: 'script' })),
    commands.registerCommand('p5-server.createSketchFolder', () => createSketch({ type: 'folder' })),
    commands.registerCommand('p5-server.deleteSketch', deleteSketch),
    commands.registerCommand('p5-server.duplicateSketch', duplicateSketch),
    commands.registerCommand('p5-server.run', runSketch),
    commands.registerCommand('p5-server.run#browser', runSketchInBrowser),
    commands.registerCommand('p5-server.run#sidebar', runSketchInSidebar),
    commands.registerCommand('p5-server.openSettings', openSettings),
  );
}
