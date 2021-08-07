import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Sketch } from 'p5-server';

export class SketchTreeProvider implements vscode.TreeDataProvider<SketchItem | DirectoryItem | FileItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private workspaceRoot?: string) {
    vscode.commands.registerCommand('p5-explorer.openSketch', (sketch: Sketch) => {
      const filePath = path.join(sketch.dirPath, sketch.scriptPath || sketch.mainFile);
      vscode.window.showTextDocument(vscode.Uri.file(filePath));
    });
    vscode.commands.registerCommand('p5-explorer.runSelectedFile', (item: FilePathItem) => {
      vscode.commands.executeCommand('p5-server.openBrowser', vscode.Uri.file(item.filePath));
    });
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: SketchItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: SketchItem) {
    if (!this.workspaceRoot) {
      return Promise.resolve([]);
    }

    if (element instanceof DirectoryItem) {
      return Promise.resolve(this.getDirectoryChildren(element.filePath));
    } else if (element instanceof SketchItem) {
      return Promise.resolve(
        element.sketch.files.map(
          f => new FileItem(path.join(element.sketch.dirPath, f), vscode.TreeItemCollapsibleState.None)
        )
      );
    } else {
      return Promise.resolve(this.getDirectoryChildren(this.workspaceRoot));
    }
  }

  private getDirectoryChildren(dir: string) {
    const exclusions = ['.*', 'node_modules', 'package.json'];
    const { sketches, unaffiliatedFiles } = Sketch.analyzeDirectory(dir, {
      exclusions
    });
    const files = unaffiliatedFiles.map(s => path.join(dir, s));
    return [
      ...sketches.map(
        sketch =>
          new SketchItem(
            sketch,
            sketch.files.length > 1 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
          )
      ),
      ...files
        .filter(s => fs.statSync(s).isDirectory())
        .map(s => new DirectoryItem(s, vscode.TreeItemCollapsibleState.Collapsed)),
      ...files
        .filter(s => !fs.statSync(s).isDirectory())
        .map(s => new FileItem(s, vscode.TreeItemCollapsibleState.None))
    ];
  }
}

interface FilePathItem {
  filePath: string;
}

class SketchItem extends vscode.TreeItem implements FilePathItem {
  constructor(public readonly sketch: Sketch, public readonly collapsibleState: vscode.TreeItemCollapsibleState) {
    super(sketch.name.replace(/\/$/, ''), collapsibleState);
    this.tooltip = `p5.js sketch at ${this.filePath}`;
    this.description = sketch.description;
    this.command = {
      command: 'p5-explorer.openSketch',
      title: 'Edit P5.js Sketch',
      arguments: [sketch]
    };
  }

  get filePath() {
    const sketch = this.sketch;
    return path.join(sketch.dirPath, sketch.scriptPath || sketch.mainFile);
  }

  iconPath = {
    dark: path.join(__filename, '..', '..', 'resources', 'dark', 'sketch.svg'),
    light: path.join(__filename, '..', '..', 'resources', 'light', 'sketch.svg')
  };
  contextValue = 'sketch';
}

class DirectoryItem extends vscode.TreeItem implements FilePathItem {
  constructor(public readonly filePath: string, public readonly collapsibleState: vscode.TreeItemCollapsibleState) {
    super(path.basename(filePath), collapsibleState);
    this.tooltip = `${this.label}`;
  }

  iconPath = new vscode.ThemeIcon('file-directory');
  contextValue = 'directory';
}

class FileItem extends vscode.TreeItem implements FilePathItem {
  constructor(public readonly filePath: string, public readonly collapsibleState: vscode.TreeItemCollapsibleState) {
    super(path.basename(filePath), collapsibleState);
    this.tooltip = filePath;
    this.command = {
      command: 'vscode.open',
      title: 'Edit File',
      arguments: [vscode.Uri.file(filePath)]
    };
    this.iconPath = new vscode.ThemeIcon(
      /\.(gif|jpe?g|png|svg|wav|mp3|mov|mp4)/i.test(filePath)
        ? 'file-media'
        : /\.css|html|js?$/i.test(filePath)
        ? 'file-code'
        : /\.text$/i.test(filePath)
        ? 'file-text'
        : 'file'
    );
  }
  contextValue = 'file';
}
