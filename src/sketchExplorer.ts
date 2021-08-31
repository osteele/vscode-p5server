import * as fs from 'fs';
import { Library, Sketch } from 'p5-server';
import * as path from 'path';
import * as vscode from 'vscode';
import { commands, Uri, window, workspace } from 'vscode';
import { getWorkspaceFolderPaths } from './utils';

const enableIntegratedLibraryBrowser = false;
const resourceDir = path.join(__filename, '..', '..', 'resources');
export const exclusions = ['.*', '*.lock', '*.log', 'node_modules', 'package.json'];

export class SketchExplorer {
  private readonly provider: SketchTreeProvider;
  private selection: FilePathItem | Library | Sketch | null = null;

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
  }

  public registerCommands(context: vscode.ExtensionContext) {
    context.subscriptions.push(commands.registerCommand('p5-explorer.refresh', () => this.provider.refresh()));
    context.subscriptions.push(commands.registerCommand('p5-explorer.createFolder', () => this.createFolder()));
    context.subscriptions.push(commands.registerCommand('p5-explorer.createSketch', () => this.createSketch()));
    context.subscriptions.push(
      commands.registerCommand('p5-explorer.openSketch', (item: FilePathItem | Sketch) => {
        const file = item instanceof Sketch ? path.join(item.dir, item.scriptFile || item.mainFile) : item.file;
        return window.showTextDocument(Uri.file(file));
      })
    );
    context.subscriptions.push(commands.registerCommand('p5-explorer.rename', this.rename.bind(this)));
    context.subscriptions.push(
      commands.registerCommand('p5-explorer.openSelectedItem', (item: FilePathItem | Sketch) => {
        const file = item instanceof Sketch ? path.join(item.dir, item.scriptFile || item.mainFile) : item.file;
        return commands.executeCommand('vscode.open', Uri.file(file));
      })
    );
    context.subscriptions.push(
      commands.registerCommand('p5-explorer.runSelectedFile', (item: FilePathItem | Sketch) => {
        const file = item instanceof Sketch ? path.join(item.dir, item.mainFile) : item.file;
        return Promise.all([
          workspace.getConfiguration('p5-server').get<boolean>('run.openEditor')
            ? commands.executeCommand('vscode.open', Uri.file(file), { preview: true, viewColumn: 1 })
            : null,
          commands.executeCommand('p5-server.openBrowser', Uri.file(file), {})
        ]);
      })
    );
    context.subscriptions.push(
      commands.registerCommand('p5-explorer.openLibrary', (library: Library) => {
        if (!enableIntegratedLibraryBrowser) {
          return commands.executeCommand('vscode.open', Uri.parse(library.homepage));
          // return commands.executeCommand('simpleBrowser.api.open', Uri.parse(library.homepage));
        }
        const panel = vscode.window.createWebviewPanel('p5LibraryHomepage', library.name, vscode.ViewColumn.One, {
          enableScripts: true
        });
        panel.webview.html = `
          <!DOCTYPE html>
          <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <meta http-equiv="X-UA-Compatible" content="ie=edge">
              <title>${library.name}</title>
              <style type="text/css">
                body,html {
                  height: 100%;
                  min-height: 100%;
                  padding: 0;
                  margin: 0;
                }
                iframe {
                  width: 100%;
                  height: 100%;
                  border: none;
                  background: white;
                }
              </style>
            </head>
            <body>
                <iframe src="${library.homepage}"></iframe>
            </body>
          </html>
        `;
      })
    );
  }

  // commands

  private async createFolder(): Promise<void> {
    const wsFolders = getWorkspaceFolderPaths();
    const dir =
      (await this.getSelectionDirectory()) ||
      (wsFolders.length > 1
        ? await window.showQuickPick(wsFolders, { placeHolder: 'Select a workspace folder' })
        : wsFolders[0]);
    if (!dir) return; // the user cancelled
    const name = await window.showInputBox();
    if (!name) return;
    await workspace.fs.createDirectory(Uri.file(path.join(dir, name)));
  }

  private async createSketch(): Promise<void> {
    const dir = await this.getSelectionDirectory();
    return commands.executeCommand('p5-server.createSketchFile', dir);
  }

  private async getSelectionDirectory() {
    const selection = this.selection;
    return selection instanceof DirectoryItem
      ? selection.file
      : selection instanceof Sketch
      ? (await sketchIsEntireDirectory(selection))
        ? path.dirname(selection.dir)
        : selection.dir
      : selection instanceof Library
      ? undefined
      : selection
      ? path.dirname(selection.file)
      : undefined;
  }

  private async rename(item: FilePathItem | Sketch): Promise<void> {
    const name = await window.showInputBox();
    if (!name) return;
    // TODO: rename single-sketch folders
    if (item instanceof Sketch) {
      switch (item.sketchType) {
        case 'html':
          return workspace.fs.rename(
            Uri.file(path.join(item.dir, item.mainFile)),
            Uri.file(path.join(item.dir, /\.html?$/i.test(name) ? name : name + '.html'))
          );
        case 'javascript':
          return workspace.fs.rename(
            Uri.file(path.join(item.dir, item.scriptFile)),
            Uri.file(path.join(item.dir, /\.js$/i.test(name) ? name : name + '.js'))
          );
      }
    } else {
      return workspace.fs.rename(Uri.file(item.file), Uri.file(path.join(path.dirname(item.file), name)));
    }
  }
}

export class SketchTreeProvider implements vscode.TreeDataProvider<FilePathItem | Library | Sketch> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>();
  public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private watchers: vscode.FileSystemWatcher[] = [];

  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  public getTreeItem(element: FileItem | DirectoryItem | Library | Sketch): vscode.TreeItem {
    if (element instanceof Sketch) {
      const sketch = element;
      return new SketchItem(
        sketch,
        sketch.files.length + sketch.libraries.length > 1
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.None
      );
    } else if (element instanceof Library) {
      return new LibraryItem(element);
    } else return element;
  }

  public getChildren(element?: FilePathItem | Sketch): vscode.ProviderResult<(FilePathItem | Library | Sketch)[]> {
    if (!element) {
      return this.getRootChildren();
    } else if (element instanceof DirectoryItem) {
      return this.getDirectoryChildren(element.file);
    } else if (element instanceof Sketch) {
      const sketch = element;
      return [
        ...sketch.files
          .filter(file => !file.startsWith('..' + path.sep))
          .sort((a, b) => b.localeCompare(a))
          .map(file => new FileItem(path.join(sketch.dir, file), vscode.TreeItemCollapsibleState.None)),
        ...sketch.libraries
      ];
    }
  }

  private async getRootChildren(): Promise<(FilePathItem | Sketch)[]> {
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
    try {
      switch (wsFolders.length) {
        case 0:
          return [];
        case 1:
          return this.getDirectoryChildren(wsFolders[0].uri.fsPath);
        default:
          return Promise.all(
            wsFolders.map(
              folder => new DirectoryItem(folder.uri.fsPath, vscode.TreeItemCollapsibleState.Collapsed, folder.name)
            )
          );
      }
    } finally {
      setTimeout(() => commands.executeCommand('setContext', 'p5-explorer.loaded', true), 1000);
    }
  }

  private async getDirectoryChildren(dir: string): Promise<(FilePathItem | Sketch)[]> {
    const { sketches, unassociatedFiles } = await Sketch.analyzeDirectory(dir, { exclusions });
    const files = unassociatedFiles.map(s => path.join(dir, s));
    return [
      // sketches
      ...sketches.sort((a, b) => a.name.localeCompare(b.name)),
      // directories
      ...files
        .filter(file => fs.statSync(file).isDirectory())
        .map(dir => new DirectoryItem(dir, vscode.TreeItemCollapsibleState.Collapsed)),
      // files
      ...files
        .filter(file => !fs.statSync(file).isDirectory())
        .map(file => new FileItem(file, vscode.TreeItemCollapsibleState.None))
    ];
  }
}

interface FilePathItem {
  file: string;
}

class DirectoryItem extends vscode.TreeItem implements FilePathItem {
  constructor(
    public readonly file: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    name?: string
  ) {
    super(name || path.basename(file), collapsibleState);
    this.resourceUri = Uri.file(file);
    this.tooltip = fileDisplay(this.file);
  }

  contextValue = 'directory';
  iconPath = new vscode.ThemeIcon('file-directory');
}

class FileItem extends vscode.TreeItem implements FilePathItem {
  constructor(public readonly file: string, public readonly collapsibleState: vscode.TreeItemCollapsibleState) {
    super(path.basename(file), collapsibleState);
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
  constructor(public readonly sketch: Sketch, public readonly collapsibleState: vscode.TreeItemCollapsibleState) {
    super(sketch.name.replace(/\/$/, ''), collapsibleState);
    this.tooltip = fileDisplay(this.file);
    this.description = sketch.description;
    this.command = {
      command: 'p5-explorer.openSketch',
      title: 'Edit P5.js Sketch',
      arguments: [sketch]
    };
  }

  get file() {
    const sketch = this.sketch;
    return path.join(sketch.dir, sketch.mainFile);
  }

  iconPath = {
    dark: path.join(resourceDir, 'dark', 'sketch.svg'),
    light: path.join(resourceDir, 'light', 'sketch.svg')
  };
  contextValue = 'sketch';
}

class LibraryItem extends vscode.TreeItem {
  constructor(readonly library: Library) {
    super(path.basename(library.name), vscode.TreeItemCollapsibleState.None);
    this.tooltip = `This sketch includes the ${library.name} library.\nLibrary description: ${library.description}.\nClick on item to view the library home page.`;
    this.command = {
      command: 'p5-explorer.openLibrary',
      title: 'Homepage',
      arguments: [library]
    };
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
    sketches.length === 1 && sketches[0].sketchType === sketch.sketchType && sketches[0].mainFile === sketch.mainFile
  );
}
