import * as fs from 'fs';
import { Library, Sketch } from 'p5-server';
import * as path from 'path';
import * as vscode from 'vscode';
import { commands, Uri, window, workspace } from 'vscode';
import * as sketchCommands from './sketchCommands';
import { getWorkspaceFolderPaths } from './utils';

const resourceDir = path.join(__filename, '..', '..', 'resources');
export const exclusions = ['.*', '*.lock', '*.log', 'node_modules', 'package.json'];

export class SketchExplorer {
  private readonly provider: SketchTreeProvider;
  private selection: Element | null = null;

  constructor(context: vscode.ExtensionContext) {
    this.provider = new SketchTreeProvider();
    const treeView = vscode.window.createTreeView('p5sketchExplorer', {
      showCollapseAll: true,
      treeDataProvider: this.provider
    });
    treeView.onDidChangeSelection(e => {
      this.selection = e.selection[0];
    });
    context.subscriptions.push(workspace.onDidChangeWorkspaceFolders(() => this.provider.refresh()));
    this.registerCommands(context);

    context.subscriptions.push(
      window.onDidChangeActiveTextEditor(editor => {
        if (editor && workspace.getConfiguration('p5-server').get<boolean>('p5-server.explorer.autoReveal')) {
          const file = editor.document.uri.fsPath;
          const element = this.provider.getElementForFile(file);
          if (element) treeView.reveal(element);
        }
      })
    );
  }

  public registerCommands(context: vscode.ExtensionContext) {
    context.subscriptions.push(
      commands.registerCommand('p5-server.explorer.refresh', () => this.provider.refresh()),
      commands.registerCommand('p5-server.explorer.createFolder', async () => this.createFolderInSelectedLocation()),
      commands.registerCommand('p5-server.explorer.createSketch', async () =>
        this.createSketchInSelectedFolder('script')
      ),
      commands.registerCommand('p5-server.explorer.createSketch#html', async () =>
        this.createSketchInSelectedFolder('html')
      ),
      commands.registerCommand('p5-server.explorer.createSketch#folder', async () =>
        this.createSketchInSelectedFolder('folder')
      ),
      commands.registerCommand('p5-server.explorer.rename', (item: Sketch | FilePathItem) =>
        sketchCommands.renameSketch(item instanceof Sketch ? item : item.resourceUri!)
      ),
      commands.registerCommand('p5-server.explorer.open', (item: Sketch | FileItem) => {
        const uri = item instanceof Sketch ? Uri.file(item.scriptFilePath || item.mainFilePath) : item.resourceUri;
        return commands.executeCommand('vscode.open', uri);
      }),
      commands.registerCommand('p5-server.explorer.openSketch', (sketch: Sketch) => {
        const uri = Uri.file(sketch.scriptFilePath);
        return workspace.getConfiguration('p5-server.explorer').get<boolean>('autoRunSketchOnSide')
          ? Promise.all([
              commands.executeCommand('vscode.open', uri, { preview: true, viewColumn: 1 }),
              commands.executeCommand('p5-server.openBrowser', uri, { browser: 'integrated' })
            ])
          : commands.executeCommand('vscode.open', uri);
      }),

      // Run sketch commands. The view/item/context[].when clause narrow the argument types to sketch | file
      commands.registerCommand('p5-server.explorer.run', (item: Sketch | FilePathItem) => this.runSelectedSketch(item)),
      commands.registerCommand('p5-server.explorer.run#integrated', (item: Sketch | FilePathItem) =>
        this.runSelectedSketch(item, 'integrated')
      ),
      commands.registerCommand('p5-server.explorer.run#external', (item: Sketch | FilePathItem) =>
        this.runSelectedSketch(item, 'external')
      ),

      commands.registerCommand('p5-server.explorer.openLibrary', sketchCommands.openLibraryPane)
    );
  }

  async createFolderInSelectedLocation(): Promise<void> {
    const wsFolders = getWorkspaceFolderPaths();
    const dir =
      wsFolders.length > 1
        ? await window.showQuickPick(wsFolders, { placeHolder: 'Select a workspace folder' })
        : wsFolders[0];
    if (!dir) return; // the user cancelled

    const name = await window.showInputBox();
    if (!name) return;

    await workspace.fs.createDirectory(Uri.file(path.join(dir, name)));
  }

  async createSketchInSelectedFolder(type: 'script' | 'html' | 'folder') {
    const dir = await this.getSelectionDirectory();
    await commands.executeCommand('_p5-server.createSketch', { dir, type });
  }

  async getSelectionDirectory(): Promise<string | null> {
    const selection = this.selection;
    return selection instanceof Sketch
      ? (await sketchIsEntireDirectory(selection))
        ? path.dirname(selection.dir)
        : selection.dir
      : selection instanceof Library
      ? null
      : selection instanceof DirectoryItem
      ? selection.file
      : selection instanceof FileItem
      ? path.dirname(selection.file)
      : null;
  }

  runSelectedSketch(item: Sketch | FilePathItem, where: 'integrated' | 'external' | undefined = undefined) {
    const uri = item instanceof Sketch ? Uri.file(item.mainFilePath) : item.resourceUri;
    commands.executeCommand('p5-server.openBrowser', uri, { browser: where });
  }
}

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

type Element = Library | Sketch | FilePathItem;

type FilePathItem = FileItem | DirectoryItem;

class DirectoryItem extends vscode.TreeItem {
  constructor(public readonly file: string, name?: string) {
    super(name || path.basename(file), vscode.TreeItemCollapsibleState.Collapsed);
    this.resourceUri = Uri.file(file);
    this.tooltip = fileDisplay(file);
  }

  contextValue = 'directory';
  iconPath = new vscode.ThemeIcon('file-directory');
}

class FileItem extends vscode.TreeItem {
  constructor(public readonly file: string) {
    super(path.basename(file), vscode.TreeItemCollapsibleState.None);
    this.resourceUri = Uri.file(file);
    this.tooltip = fileDisplay(file);
    this.command = {
      command: 'vscode.open',
      title: 'Edit File',
      arguments: [Uri.file(file)]
    };
  }

  contextValue = 'file';
  iconPath = new vscode.ThemeIcon('file');
}

class SketchItem extends vscode.TreeItem {
  constructor(public readonly sketch: Sketch, collapsibleState: vscode.TreeItemCollapsibleState) {
    super(sketch.name.replace(/\/$/, ''), collapsibleState);
    this.tooltip = fileDisplay(this.file);
    this.description = sketch.description;
    this.command = {
      command: 'p5-server.explorer.openSketch',
      title: 'Edit P5.js Sketch',
      arguments: [sketch]
    };
    this.contextValue = `sketch:${sketch.structureType}`;
  }

  get file() {
    return this.sketch.mainFilePath;
  }

  iconPath = {
    dark: path.join(resourceDir, 'dark', 'sketch.svg'),
    light: path.join(resourceDir, 'light', 'sketch.svg')
  };
}

class LibraryItem extends vscode.TreeItem {
  constructor(readonly library: Library) {
    super(path.basename(library.name), vscode.TreeItemCollapsibleState.None);
    this.tooltip = `This sketch includes the ${library.name} library.\nLibrary description: ${library.description}.`;
  }

  contextValue = 'library';
  iconPath = new vscode.ThemeIcon('library');
}

function fileDisplay(file: string) {
  if (!process.env.HOME) {
    return file;
  }
  const prefix = `${process.env.HOME}/`.replace(/\/\/$/, '/');
  return file.startsWith(prefix) ? `~${file.substr(process.env.HOME.length)}` : file;
}

async function sketchIsEntireDirectory(sketch: Sketch) {
  const { sketches } = await Sketch.analyzeDirectory(sketch.dir, { exclusions });
  return (
    sketches.length === 1 &&
    sketches[0].structureType === sketch.structureType &&
    sketches[0].mainFilePath === sketch.mainFilePath
  );
}
