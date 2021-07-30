import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Sketch } from 'p5-server';

export class SketchTreeProvider implements vscode.TreeDataProvider<SketchItem | DirectoryItem | FileItem> {
  constructor(private workspaceRoot: string) {
    vscode.commands.registerCommand('p5sketchExplorer.editSketch', (sketch: Sketch) => {
      const filePath = path.join(sketch.dirPath, sketch.jsSketchPath || sketch.indexFile);
      vscode.window.showTextDocument(vscode.Uri.file(filePath));
    });

    vscode.commands.registerCommand('p5sketchExplorer.editFile', (filePath: string) => {
      vscode.window.showTextDocument(vscode.Uri.file(filePath));
    });
  }

  getTreeItem(element: SketchItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: SketchItem) {
    if (!this.workspaceRoot) {
      vscode.window.showInformationMessage('No sketches in empty workspace');
      return Promise.resolve([]);
    }

    if (element instanceof DirectoryItem) {
      return Promise.resolve(this.getDirectoryChildren(element.dir));
    } else if (element instanceof SketchItem) {
      return Promise.resolve(element.sketch.files.map(f =>
        new FileItem(path.join(element.sketch.dirPath, f), vscode.TreeItemCollapsibleState.None)));
    } else {
      return Promise.resolve(this.getDirectoryChildren(this.workspaceRoot));
    }
  }

  private getDirectoryChildren(dir: string) {
    const exclusions = ['.*', 'node_modules', 'package.json'];
    const { sketches, unaffiliatedFiles } = Sketch.analyzeDirectory(dir, { exclusions });
    const files = unaffiliatedFiles.map(s => path.join(dir, s));
    return [
      ...sketches.map(sketch =>
        new SketchItem(sketch, sketch.files.length > 1 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None)),
      ...files
        .filter(s => fs.statSync(s).isDirectory())
        .map(s => new DirectoryItem(s, vscode.TreeItemCollapsibleState.Collapsed)),
      ...files
        .filter(s => !fs.statSync(s).isDirectory())
        .map(s => new FileItem(s, vscode.TreeItemCollapsibleState.None)),
    ];
  }
}

class SketchItem extends vscode.TreeItem {
  constructor(
    public readonly sketch: Sketch,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(sketch.name.replace(/\/$/, ''), collapsibleState);
    this.tooltip = `p5.js sketch at ${sketch.indexFile}`;
    this.description = sketch.description;
    this.command = { command: 'p5sketchExplorer.editSketch', title: "Edit P5.js Sketch", arguments: [sketch] };
  }

  iconPath = {
    light: path.join(__filename, '..', '..', 'resources', 'p5-sketch.svg'),
    dark: path.join(__filename, '..', '..', 'resources', 'p5-sketch.svg')
  };
}

class DirectoryItem extends vscode.TreeItem {
  constructor(
    public readonly dir: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(path.basename(dir), collapsibleState);
    this.tooltip = `${this.label}`;
  }

  iconPath = {
    light: path.join(__filename, '..', '..', 'resources', 'folder.svg'),
    dark: path.join(__filename, '..', '..', 'resources', 'folder.svg')
  };
}

class FileItem extends vscode.TreeItem {
  constructor(
    public readonly filePath: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(path.basename(filePath), collapsibleState);
    this.tooltip = filePath;
    this.command = { command: 'p5sketchExplorer.editFile', title: "Edit File", arguments: [filePath] };
  }

  iconPath = {
    light: path.join(__filename, '..', '..', 'resources', 'document.svg'),
    dark: path.join(__filename, '..', '..', 'resources', 'document.svg')
  };
}
