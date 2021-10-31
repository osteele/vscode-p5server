import path = require('path');
import * as vscode from 'vscode';
import { commands, Uri, window, workspace } from 'vscode';
import { compareVersions, VersionChange } from './helpers/compareVersions';

export class ReleaseNotes {
  private readonly _previousVersion: string | undefined;
  private readonly versionChangeKind: VersionChange;

  constructor(private readonly context: vscode.ExtensionContext) {
    context.subscriptions.push(commands.registerCommand('p5-server.showReleaseNotes', this.showPanel.bind(this)));
    this._previousVersion = this.context.globalState.get(this.versionKey);
    this.versionChangeKind = this.getVersionChangeKind();
    this.previousVersion = this.currentVersion;
  }

  static showIfNewVersion(context: vscode.ExtensionContext) {
    new ReleaseNotes(context).showStartupMessageIfNewVersion();
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
    return this._previousVersion;
  }

  private set previousVersion(version: string | undefined) {
    this.context.globalState.update(this.versionKey, version);
  }

  private modifySavedVersionForTesting() {
    // uncomment one of these for testing:
    // {
    // console.info('VersionChange.noPreviousVersion: -> Fresh install: no message');
    // this._previousVersion = undefined;
    // }
    // {
    // console.info('VersionChange.minor: -> Patch release: show info message');
    // this._previousVersion = this.currentVersion + '1';
    // }
    // {
    // console.info('VersionChange.major: -> Minor or major release: show release notes');
    // this._previousVersion = '1.0.0';
    // }
    // {
    // console.info('VersionChange.noChange: -> Same version as before: no message');
    // this._previousVersion = this.currentVersion;
    // }
  }

  private getVersionChangeKind() {
    const { currentVersion, previousVersion } = this;
    return compareVersions(currentVersion, previousVersion);
  }

  public async showStartupMessageIfNewVersion() {
    if (vscode.env.remoteName?.toLocaleLowerCase() === 'codespaces') return false;
    this.modifySavedVersionForTesting();
    switch (this.versionChangeKind) {
      case VersionChange.major:
      case VersionChange.minor:
      case VersionChange.patch:
        await this.showInformationMessage();
        break;
    }
  }

  private async showPanel() {
    const title = `What's New in ${this.extensionName}`;
    const uri = Uri.file(path.join(this.context.extensionPath, 'resources/changelog.html'));
    const html = (await workspace.fs.readFile(uri)).toString();
    const panel = window.createWebviewPanel('p5-server.whatsNew', title, vscode.ViewColumn.One);
    panel.webview.html = html;
  }

  private async showInformationMessage() {
    const item = await window.showInformationMessage(
      `${this.extensionName} has been updated to version ${this.currentVersion}.`,
      {},
      { title: 'Show Release Notes', command: 'p5-server.showReleaseNotes' }
    );
    if (item) {
      await commands.executeCommand(item.command);
    }
  }
}
