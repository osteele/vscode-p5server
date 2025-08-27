import open = require('open');
import path = require('path');
import { commands, workspace } from 'vscode';

export const RESOURCE_DIR_PATH = path.join(__dirname, '../resources');

export const exclusions = ['.*', '*.lock', '*.log', 'node_modules', 'package.json'];

export class Configuration {
  public static get browser(): open.AppName | 'integrated' | 'safari' | 'system' {
    const browserSetting = workspace
      .getConfiguration('p5-server')
      .get<string>('browser', 'integrated')
      .replace('default', 'system');

    return browserSetting as open.AppName | 'integrated' | 'safari' | 'system';
  }

  public static get enableProxyCache(): boolean {
    return workspace.getConfiguration('p5-server').get('enableProxyCache', true);
  }

  static update() {
    const config = workspace.getConfiguration('p5-server');
    const runIconEnabled = config.get('editorTitle.RunIcon.enabled', true);
    commands.executeCommand('setContext', 'p5-server.runIconEnabled', runIconEnabled);
    commands.executeCommand('setContext', 'p5-server.browser', Configuration.browser);
  }
}
