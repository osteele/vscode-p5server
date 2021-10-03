import path = require('path');
import * as vscode from 'vscode';
import { commands, Uri, window, workspace } from 'vscode';

export class ReleaseNotes {
  constructor(private readonly context: vscode.ExtensionContext) {
    context.subscriptions.push(commands.registerCommand('p5-server.viewChangeLog', this.showChangeLog.bind(this)));
  }

  static showIfNewVersion(context: vscode.ExtensionContext) {
    new ReleaseNotes(context).showStartupMessage();
  }

  private get extensionName() {
    return this.context.extension.packageJSON.displayName;
  }

  private get currentVersion() {
    return this.context.extension.packageJSON.version;
  }

  private get versionKey() {
    return `${this.context.extension.id}.version`;
  }

  private get previousVersion() {
    return this.context.globalState.get(this.versionKey);
  }

  private set previousVersion(version: string | undefined) {
    this.context.globalState.update(this.versionKey, version);
  }

  private shouldShow() {
    if (vscode.env.remoteName?.toLocaleLowerCase() === 'codespaces') return false;
    if (!this.previousVersion) return false;
    if (this.previousVersion === this.currentVersion) return false;
    if (this.previousVersion.replace(/(\d+\.\d+).*/, '$1') === this.currentVersion.replace(/(\d+\.\d+).*/, '$1'))
      return 'patch';
    return 'upgrade';
  }

  public async showStartupMessage() {
    const context = this.context;
    switch (
      // Change this from 0 to test the release notes on startup
      0 as number // <- change this back to 0 before committing
    ) {
      case 1:
        // Fresh install: no message
        context.globalState.update(`${context.extension.id}.version`, undefined);
        break;
      case 2:
        // Patch release: show info message
        context.globalState.update(`${context.extension.id}.version`, context.extension.packageJSON.version + '1');
        break;
      case 3:
        // Minor or major release: show release notes
        context.globalState.update(`${context.extension.id}.version`, '1.0.0');
        break;
      case 4:
        // Same version as before: no message
        context.globalState.update(`${context.extension.id}.version`, context.extension.packageJSON.version);
        break;
    }

    const shouldShow = this.shouldShow();
    this.previousVersion = this.currentVersion;
    switch (shouldShow) {
      case 'patch':
        await this.showInformationMessage();
        break;
      case 'upgrade':
        await this.showChangeLog();
        break;
    }
  }

  private async showChangeLog() {
    const title = `What's New in ${this.extensionName}`;
    const uri = Uri.file(path.join(this.context.extensionPath, 'resources/changelog.html'));
    const html = (await workspace.fs.readFile(uri)).toString();
    const panel = window.createWebviewPanel('p5-server.whatsNew', title, vscode.ViewColumn.One);
    panel.webview.html = html;
  }

  private async showInformationMessage() {
    const item = await window.showInformationMessage(
      `${this.extensionName} has been updated from version ${this.previousVersion} → ${this.currentVersion}.`,
      {},
      { title: 'Show Change Log', command: 'p5-server.viewChangeLog' }
    );
    if (item) {
      await commands.executeCommand(item.command);
    }
  }
}
