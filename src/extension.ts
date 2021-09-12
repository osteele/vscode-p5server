import path = require('path');
import * as vscode from 'vscode';
import { commands, Uri, window, workspace } from 'vscode';
import { createSketch, duplicateSketch } from './commands';
import { ServerManager } from './serverManager';
import { SketchExplorer } from './sketchExplorer';
import { getWorkspaceFolderPaths } from './utils';

export function activate(context: vscode.ExtensionContext) {
  // create sketch explorer
  new SketchExplorer(context);

  // register commands
  context.subscriptions.push(commands.registerCommand('p5-server.createSketchFile', createSketch.bind(null, false)));
  context.subscriptions.push(commands.registerCommand('p5-server.createSketchFolder', createSketch.bind(null, true)));
  context.subscriptions.push(commands.registerCommand('p5-server.duplicateSketch', duplicateSketch));

  // create server manager and set context variable
  if (getWorkspaceFolderPaths().length >= 1) {
    ServerManager.activate(context);
    commands.executeCommand('setContext', 'p5-server.available', true);
  }

  ReleaseNotes.showIfNewVersion(context);
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
export function deactivate() {}

class ReleaseNotes {
  constructor(private readonly context: vscode.ExtensionContext) {}

  static showIfNewVersion(context: vscode.ExtensionContext) {
    new ReleaseNotes(context).showIfNewVersion();
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
    if (this.previousVersion === this.currentVersion) return false;
    return true;
  }

  public async showIfNewVersion() {
    if (this.shouldShow()) {
      this.show();
    }
  }

  public async show() {
    const title = "What's New in P5 Server";
    const uri = Uri.file(path.join(this.context.extensionPath, 'resources/changelog.html'));
    const html = (await workspace.fs.readFile(uri)).toString();
    const panel = window.createWebviewPanel('p5-server.whatsNew', title, vscode.ViewColumn.One);
    panel.webview.html = html;
    this.previousVersion = this.currentVersion;
  }
}
