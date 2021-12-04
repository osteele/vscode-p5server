import * as fs from 'fs';
import { Library, Sketch } from 'p5-server';
import * as path from 'path';
import * as vscode from 'vscode';
import { commands, workspace } from 'vscode';
import { exclusions } from '../configuration';
import { Element, SketchItem, LibraryItem, FileItem, DirectoryItem } from './elements';

export class SketchTreeProvider implements vscode.TreeDataProvider<Element> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<Element | undefined | null>();
  public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private watchers: vscode.FileSystemWatcher[] = [];
  private _fileElementMap: Map<string, Element> = new Map();

  constructor(context: vscode.ExtensionContext) {
    SketchItem.resourceBaseUri = vscode.Uri.joinPath(context.extensionUri, 'resources');
}

  public refresh(element?: Element | undefined | null): void {
    this._onDidChangeTreeData.fire(element);
  }

  private register(element: Element, key?: string): Element {
    key ??= element instanceof FileItem || element instanceof DirectoryItem ? element.file : undefined;
    if (key) {
      this._fileElementMap.set(key, element);
    }
    return element;
  }

  public getElementForFile(file: string): Element | undefined {
    // TODO: If it's not in the map, analyze its directory.
    // If it's the main file for a sketch in that directory, return the sketch.
    // Otherwise create a FileItem and return that.
    return this._fileElementMap.get(file);
  }

  public getTreeItem(element: Element): vscode.TreeItem {
    if (element instanceof Sketch) {
      const sketch = element;
      const item = new SketchItem(
        sketch,
        null,
        sketch.files.length + sketch.libraries.length > 1
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.None
      );
      this.register(element, sketch.mainFilePath);
      return item;
    } else if (element instanceof Library) {
      return new LibraryItem(element, null);
    } else {
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
      const children = [
        ...sketch.files
          .filter(file => !file.startsWith('..' + path.sep))
          .sort((a, b) => b.localeCompare(a))
          .map(file => new FileItem(path.join(sketch.dir, file), element)),
        ...sketch.libraries.map(lib => new LibraryItem(lib, element))
      ];
      children.forEach(child => this.register(child));
      return children;
    } else if (element instanceof DirectoryItem) {
      return this.getDirectoryChildren(element.resourceUri!.fsPath, element);
    }
  }

  public getParent(element: Element): vscode.ProviderResult<Element> {
    return element instanceof Sketch ? this.getElementForFile(element.dir) : element.parent;
  }

  private async getRootChildren(): Promise<Element[]> {
    const wsFolders = workspace.workspaceFolders
      ? workspace.workspaceFolders.filter(folder => folder.uri.scheme === 'file')
      : [];
    this.watchers.forEach(w => w.dispose());
    this.watchers = wsFolders.map(folder => {
      const w = workspace.createFileSystemWatcher(new vscode.RelativePattern(folder, '**/*.{htm,html,js}'));
      w.onDidCreate(() => this.refresh());
      w.onDidChange(uri => {
        const element = this.getElementForFile(uri.path);
        const parent = element instanceof Sketch ? this.getElementForFile(path.dirname(uri.path)) : element?.parent;
        this.refresh(parent || element);
      });
      w.onDidDelete(() => this.refresh());
      return w;
    });
    this._fileElementMap.clear();
    try {
      switch (wsFolders.length) {
        case 0:
          return [];
        case 1:
          return this.getDirectoryChildren(wsFolders[0].uri.fsPath, null);
        default:
          return wsFolders
            .filter(folder => folder.uri.scheme === 'file')
            .map(folder => new DirectoryItem(folder.uri.fsPath, null, folder.name));
      }
    } finally {
      setTimeout(() => commands.executeCommand('setContext', 'p5-server.explorer.loaded', true), 1000);
    }
  }

  private async getDirectoryChildren(dir: string, parent: DirectoryItem | null): Promise<Element[]> {
    const { sketches, unassociatedFiles } = await Sketch.analyzeDirectory(dir, { exclusions });
    const files = unassociatedFiles.map(fileName => path.join(dir, fileName));
    const children = [
      // sketches
      ...sketches.sort((a, b) => a.name.localeCompare(b.name)),
      // directories
      ...files
        .filter(filePath => fs.statSync(filePath).isDirectory())
        .map(dirPath => new DirectoryItem(dirPath, parent)),
      // files
      ...files.filter(filePath => !fs.statSync(filePath).isDirectory()).map(filePath => new FileItem(filePath, parent))
    ];
    children.forEach(child => this.register(child));
    return children;
  }
}
