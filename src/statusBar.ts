import { Server } from 'p5-server';
import * as vscode from 'vscode';
import { window, workspace } from 'vscode';

export class StatusBarManager {
  private readonly statusBarOpenItem: vscode.StatusBarItem;
  private readonly statusBarServerItem: vscode.StatusBarItem;

  constructor() {
    const statusBarOpenItem = window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.statusBarOpenItem = statusBarOpenItem;
    statusBarOpenItem.text = `$(ports-open-browser-icon)P5 Browser`;
    statusBarOpenItem.command = 'p5-server.openBrowser';

    this.statusBarServerItem = window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  }

  update(server: Server | null, state: string) {
    const { statusBarServerItem, statusBarOpenItem } = this;

    switch (state) {
      case 'running':
        {
          const browserName = workspace.getConfiguration('p5-server').get('browser', 'integrated');
          statusBarServerItem.text = '$(extensions-star-full)P5 Server';
          statusBarServerItem.tooltip = 'Stop the P5 server';
          statusBarServerItem.command = 'p5-server.stop';
          statusBarOpenItem.tooltip = `Open ${server!.url} in the ${browserName} browser`;
        }
        break;
      case 'stopped':
        statusBarServerItem.text = '$(extensions-star-empty)P5 Server';
        statusBarServerItem.tooltip = 'Click to start the P5 server';
        statusBarServerItem.command = 'p5-server.start';
        break;
      case 'starting':
        statusBarServerItem.text = '$(extensions-star-full~spin)P5 Server';
        statusBarServerItem.tooltip = 'The P5 server is starting…';
        break;
      case 'stopping':
        statusBarServerItem.text = '$(extensions-star-empty~spin)P5 Server';
        statusBarServerItem.tooltip = 'The P5 server is stopping';
        break;
    }
    const config = workspace.getConfiguration('p5-server');
    if (config.get<boolean>('statusBar.browserItem.enabled', true) && state === 'running') {
      statusBarOpenItem.show();
    } else {
      statusBarOpenItem.hide();
    }
    if (config.get<boolean>('statusBar.serverItem.enabled', true)) {
      statusBarServerItem.show();
    } else {
      statusBarServerItem.hide();
    }
  }

  dispose() {
    this.statusBarOpenItem.dispose();
    this.statusBarServerItem.dispose();
  }
}
