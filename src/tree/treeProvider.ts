import { Library, Sketch } from 'p5-server';
import * as path from 'path';
import * as vscode from 'vscode';
import { commands, workspace } from 'vscode';
import { exclusions } from '../configuration';
import { workspaceUriForPath } from '../helpers/fileHelpers';
import { Element, SketchItem, LibraryItem, FileItem, DirectoryItem } from './elements';

export class SketchTreeProvider implements vscode.TreeDataProvider<Element>, vscode.Disposable {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<Element | undefined | null>();
  public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private watchers: vscode.FileSystemWatcher[] = [];
  private _fileElementMap: Map<string, Element> = new Map();
  private directoryAnalysis = new Map<string, ReturnType<typeof Sketch.analyzeDirectory>>();
  private refreshTimer?: NodeJS.Timeout;
  private pendingRefresh: Element | undefined | null;

  constructor(context: vscode.ExtensionContext) {
    SketchItem.resourceBaseUri = vscode.Uri.joinPath(context.extensionUri, 'resources');
    this.updateWatchers();
  }

  public refresh(element?: Element | undefined | null): void {
    if (!element) {
      void commands.executeCommand('setContext', 'p5-server.explorer.loaded', false);
    }
    this._onDidChangeTreeData.fire(element);
  }

  public workspaceFoldersChanged(): void {
    this.directoryAnalysis.clear();
    this.updateWatchers();
    this.refresh();
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
          : vscode.TreeItemCollapsibleState.None,
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
        ...sketch.libraries.map(lib => new LibraryItem(lib, element)),
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
    const wsFolders = workspace.workspaceFolders ?? [];
    this._fileElementMap.clear();
    try {
      switch (wsFolders.length) {
        case 0:
          return [];
        case 1:
          return this.getDirectoryChildren(wsFolders[0].uri.fsPath, null);
        default:
          return wsFolders.map(folder => this.register(new DirectoryItem(folder.uri.fsPath, null, folder.name)));
      }
    } finally {
      void commands.executeCommand('setContext', 'p5-server.explorer.loaded', true);
    }
  }

  private updateWatchers() {
    const wsFolders = workspace.workspaceFolders ?? [];
    this.watchers.forEach(watcher => watcher.dispose());
    this.watchers = wsFolders.map(folder => {
      const w = workspace.createFileSystemWatcher(new vscode.RelativePattern(folder, '**/*.{htm,html,js}'));
      w.onDidCreate(uri => this.handleFileChange(uri, true));
      w.onDidChange(uri => this.handleFileChange(uri, false));
      w.onDidDelete(uri => this.handleFileChange(uri, true));
      return w;
    });
  }

  private handleFileChange(uri: vscode.Uri, structural: boolean) {
    const dir = path.dirname(uri.fsPath);
    this.directoryAnalysis.delete(dir);
    if (structural) {
      const workspaceRoot = workspace.getWorkspaceFolder(uri)?.uri.fsPath;
      for (let ancestor = path.dirname(dir); workspaceRoot && ancestor.startsWith(workspaceRoot);) {
        this.directoryAnalysis.delete(ancestor);
        if (ancestor === workspaceRoot) break;
        ancestor = path.dirname(ancestor);
      }
    }
    const element = this.getElementForFile(uri.fsPath);
    const parent =
      element instanceof Sketch ? this.getElementForFile(dir) : element?.parent || this.getElementForFile(dir);
    this.scheduleRefresh(parent || element || null);
  }

  private scheduleRefresh(element: Element | undefined | null) {
    if (!element || (this.pendingRefresh && this.pendingRefresh !== element)) {
      this.pendingRefresh = null;
    } else if (this.pendingRefresh === undefined) {
      this.pendingRefresh = element;
    }
    if (this.refreshTimer) return;
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = undefined;
      const pendingRefresh = this.pendingRefresh;
      this.pendingRefresh = undefined;
      this.refresh(pendingRefresh);
    }, 100);
  }

  private async getDirectoryChildren(dir: string, parent: DirectoryItem | null): Promise<Element[]> {
    let analysis = this.directoryAnalysis.get(dir);
    if (!analysis) {
      analysis = Sketch.analyzeDirectory(dir, { exclusions });
      this.directoryAnalysis.set(dir, analysis);
      void analysis.catch(() => this.directoryAnalysis.delete(dir));
    }
    const { sketches, unassociatedFiles } = await analysis;
    const files = unassociatedFiles.map(fileName => path.join(dir, fileName));
    const classifiedFiles = await Promise.all(
      files.map(async filePath => ({
        filePath,
        isDirectory: (await workspace.fs.stat(workspaceUriForPath(filePath))).type === vscode.FileType.Directory,
      })),
    );
    const children = [
      // sketches
      ...sketches.sort((a, b) => a.name.localeCompare(b.name)),
      // directories
      ...classifiedFiles
        .filter(({ isDirectory }) => isDirectory)
        .map(({ filePath }) => new DirectoryItem(filePath, parent)),
      // files
      ...classifiedFiles
        .filter(({ isDirectory }) => !isDirectory)
        .map(({ filePath }) => new FileItem(filePath, parent)),
    ];
    children.forEach(child => this.register(child));
    return children;
  }

  public dispose() {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.watchers.forEach(watcher => watcher.dispose());
    this.watchers = [];
    this._onDidChangeTreeData.dispose();
    this._fileElementMap.clear();
    this.directoryAnalysis.clear();
  }
}
