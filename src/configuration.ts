import type { AppName } from 'open';
import path = require('path');
import { workspace } from 'vscode';

export const RESOURCE_DIR_PATH = path.join(__dirname, '../resources');

export const exclusions = ['.*', '*.lock', '*.log', 'node_modules', 'package.json'];

export class Configuration {
  public static get browser(): AppName | 'integrated' | 'safari' | 'system' {
    const browserSetting = workspace
      .getConfiguration('p5-server')
      .get<string>('browser', 'integrated')
      .replace('default', 'system');

    return browserSetting as AppName | 'integrated' | 'safari' | 'system';
  }

  public static get enableProxyCache(): boolean {
    return workspace.getConfiguration('p5-server').get('enableProxyCache', true);
  }
}
