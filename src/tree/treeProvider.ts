import * as fs from 'fs';
import { Library, Sketch } from 'p5-server';
import * as path from 'path';
import * as vscode from 'vscode';
import { commands, workspace } from 'vscode';
import { exclusions } from '../configuration';
import { Element, SketchItem, LibraryItem, FileItem, DirectoryItem } from './elements';

export class SketchTreeProvider implements vscode.TreeDataProvider<Element> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>();
  public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private watchers: vscode.FileSystemWatcher[] = [];
  private elementMap: Map<string, Element> = new Map();

  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  public getElementForFile(file: string): Element | undefined {
    // TODO: If it's not in the map, analyze its directory.
    // If it's the main file for a sketch in that directory, return the sketch.
    // Otherwise create a FileItem and return that.
    return this.elementMap.get(file);
  }

  public getTreeItem(element: Element): vscode.TreeItem {
    if (element instanceof Sketch) {
      const sketch = element;
      const item = new SketchItem(
        sketch,
        sketch.files.length + sketch.libraries.length > 1
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.None
      );
      this.elementMap.set(sketch.mainFilePath, element);
      return item;
    } else if (element instanceof Library) {
      return new LibraryItem(element);
    } else {
      if (element instanceof FileItem) {
        this.elementMap.set(element.file, element);
      }
      return element;
    }
  }

  public getChildren(element?: Element): vscode.ProviderResult<Element[]> {
    if (!element) {
      return this.getRootChildren();
    } else if (element instanceof Library) {
      return [];
    } else if (element instanceof Sketch) {
      const sketch = element;
      return [
        ...sketch.files
          .filter(file => !file.startsWith('..' + path.sep))
          .sort((a, b) => b.localeCompare(a))
          .map(file => new FileItem(path.join(sketch.dir, file))),
        ...sketch.libraries
      ];
    } else if (element instanceof DirectoryItem) {
      return this.getDirectoryChildren(element.resourceUri!.fsPath);
    }
  }

  public getParent(_element: Element): vscode.ProviderResult<Element> {
    // TODO:
    // If it's a directory, return the parent.
    // If it's a file, analyze the directory that it's in. If it's an unaffiliated file, return that directory.
    // Otherwise return the sketch that contains it.
    return null;
  }

  private async getRootChildren(): Promise<Element[]> {
    const wsFolders = workspace.workspaceFolders
      ? workspace.workspaceFolders.filter(folder => folder.uri.scheme === 'file')
      : [];
    this.watchers.forEach(w => w.dispose());
    this.watchers = wsFolders.map(folder => {
      const w = workspace.createFileSystemWatcher(new vscode.RelativePattern(folder, '**/*.{htm,html,js}'));
      w.onDidCreate(() => this.refresh());
      w.onDidChange(() => this.refresh());
      w.onDidDelete(() => this.refresh());
      return w;
    });
    this.elementMap.clear();
    try {
      switch (wsFolders.length) {
        case 0:
          return [];
        case 1:
          return this.getDirectoryChildren(wsFolders[0].uri.fsPath);
        default:
          return wsFolders
            .filter(folder => folder.uri.scheme === 'file')
            .map(folder => new DirectoryItem(folder.uri.fsPath, folder.name));
      }
    } finally {
      setTimeout(() => commands.executeCommand('setContext', 'p5-server.explorer.loaded', true), 1000);
    }
  }

  private async getDirectoryChildren(dir: string): Promise<Element[]> {
    const { sketches, unassociatedFiles } = await Sketch.analyzeDirectory(dir, { exclusions });
    const files = unassociatedFiles.map(name => path.join(dir, name));
    return [
      // sketches
      ...sketches.sort((a, b) => a.name.localeCompare(b.name)),
      // directories
      ...files.filter(filepath => fs.statSync(filepath).isDirectory()).map(dirpath => new DirectoryItem(dirpath)),
      // files
      ...files.filter(filepath => !fs.statSync(filepath).isDirectory()).map(filepath => new FileItem(filepath))
    ];
  }
}