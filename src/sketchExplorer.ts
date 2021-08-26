import * as fs from 'fs';
import { Library, Sketch } from 'p5-server';
import * as path from 'path';
import * as vscode from 'vscode';
import { commands, Uri, window, workspace } from 'vscode';

const resourceDir = path.join(__filename, '..', '..', 'resources');

export class SketchTreeProvider implements vscode.TreeDataProvider<SketchTreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor() {
    this.registerCommands();
  }

  private registerCommands() {
    commands.registerCommand('p5-explorer.openSketch', (sketch: Sketch) => {
      const filePath = path.join(sketch.dir, sketch.scriptFile || sketch.mainFile);
      return window.showTextDocument(Uri.file(filePath));
    });
    commands.registerCommand('p5-explorer.openSelectedItem', (item: Sketch | FilePathItem) => {
      const filePath = item instanceof Sketch ? path.join(item.dir, item.scriptFile || item.mainFile) : item.file;
      return commands.executeCommand('vscode.open', Uri.file(filePath));
    });
    commands.registerCommand('p5-explorer.runSelectedFile', (item: FilePathItem) => {
      return commands.executeCommand('p5-server.openBrowser', Uri.file(item.file));
    });
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: SketchTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: SketchTreeItem): vscode.ProviderResult<SketchTreeItem[]> {
    if (!element) {
      return this.getRootChildren();
    } else if (element instanceof DirectoryItem) {
      return this.getDirectoryChildren(element.file);
    } else if (element instanceof SketchItem) {
      return Promise.all([
        ...element.sketch.files
          .filter(file => !file.startsWith('..' + path.sep))
          .sort((a, b) => b.localeCompare(a))
          .map(file => new FileItem(path.join(element.sketch.dir, file), vscode.TreeItemCollapsibleState.None)),
        ...element.sketch.libraries.map(library => new LibraryItem(library))
      ]);
    }
  }

  private async getRootChildren(): Promise<SketchTreeItem[]> {
    const wsFolders = workspace.workspaceFolders
      ? workspace.workspaceFolders.filter(folder => folder.uri.scheme === 'file')
      : [];
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
      commands.executeCommand('setContext', 'p5-explorer.loaded', true);
    }
  }

  private async getDirectoryChildren(dir: string): Promise<SketchTreeItem[]> {
    const exclusions = ['.*', 'node_modules', 'package.json'];
    const { sketches, unassociatedFiles } = await Sketch.analyzeDirectory(dir, { exclusions });
    const files = unassociatedFiles.map(s => path.join(dir, s));
    return [
      ...sketches.map(
        sketch =>
          new SketchItem(
            sketch,
            sketch.files.length + sketch.libraries.length > 1
              ? vscode.TreeItemCollapsibleState.Collapsed
              : vscode.TreeItemCollapsibleState.None
          )
      ),
      ...files
        .filter(file => fs.statSync(file).isDirectory())
        .map(dir => new DirectoryItem(dir, vscode.TreeItemCollapsibleState.Collapsed)),
      ...files
        .filter(file => !fs.statSync(file).isDirectory())
        .map(file => new FileItem(file, vscode.TreeItemCollapsibleState.None))
    ];
  }
}

interface FilePathItem {
  file: string;
}

type SketchTreeItem = (FilePathItem | LibraryItem) & vscode.TreeItem;

class SketchItem extends vscode.TreeItem implements FilePathItem {
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
class DirectoryItem extends vscode.TreeItem implements FilePathItem {
  constructor(
    public readonly file: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    name?: string
  ) {
    super(name || path.basename(file), collapsibleState);
    this.tooltip = fileDisplay(this.file);
  }

  iconPath = new vscode.ThemeIcon('file-directory');
  contextValue = 'directory';
}

const fileTypeIconMap: Record<string, RegExp> = Object.fromEntries(
  // The `Object.entries().map` changes each /abc/ to /^abc$/i
  Object.entries({
    'file-media': /(gif|jpe?g|png|svg|wav|mp3|mov|mp4)/,
    'file-code': /(css|html|jsx?|tsx?)/,
    'file-text': /(te?xt|json|yaml|csv|tsv)/,
    file: null
  }).map(([k, v]) => [k, new RegExp(v ? `${v.source}$` : '', 'i')])
);

class FileItem extends vscode.TreeItem implements FilePathItem {
  constructor(public readonly file: string, public readonly collapsibleState: vscode.TreeItemCollapsibleState) {
    super(path.basename(file), collapsibleState);
    this.tooltip = fileDisplay(file);
    this.command = {
      command: 'vscode.open',
      title: 'Edit File',
      arguments: [Uri.file(file)]
    };

    const iconId = Object.entries(fileTypeIconMap).find(([, pattern]) => pattern.test(file))![0];
    this.iconPath = new vscode.ThemeIcon(iconId);
  }

  contextValue = 'file';
}

class LibraryItem extends vscode.TreeItem {
  constructor(readonly library: Library) {
    super(path.basename(library.name), vscode.TreeItemCollapsibleState.None);
    this.tooltip = library.description;
    this.command = {
      command: 'vscode.open',
      title: 'Homepage',
      arguments: [Uri.parse(library.homepage)]
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
