import open = require('open');
import path = require('path');
import { commands, workspace } from 'vscode';

export const RESOURCE_DIR_PATH = path.join(__dirname, '../resources');

export const exclusions = ['.*', '*.lock', '*.log', 'node_modules', 'package.json'];

export class Configuration {
  public static get browser(): open.AppName | 'integrated' | 'safari' | 'system' {
    return (
      workspace
        .getConfiguration('p5-server')
        .get('browser', 'integrated')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .replace('default', 'system') as any
    );
  }

  static update() {
    const config = workspace.getConfiguration('p5-server');
    const runIconEnabled = config.get('editorTitle.RunIcon.enabled', true);
    commands.executeCommand('setContext', 'p5-server.runIconEnabled', runIconEnabled);
    commands.executeCommand('setContext', 'p5-server.browser', Configuration.browser);
  }
}
