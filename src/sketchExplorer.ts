import * as fs from 'fs';
import { Library, Sketch } from 'p5-server';
import * as path from 'path';
import * as vscode from 'vscode';
import { commands, Uri, window, workspace } from 'vscode';

const resourceDir = path.join(__filename, '..', '..', 'resources');
const exclusions = ['.*', 'node_modules', 'package.json'];

export class SketchTreeProvider implements vscode.TreeDataProvider<FilePathItem | Library | Sketch> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor() {
    this.registerCommands();
  }

  private registerCommands() {
    commands.registerCommand('p5-explorer.duplicateSketch', async (sketch: Sketch) => {
      if (!(sketch instanceof Sketch)) throw new Error(`${sketch} is not a Sketch`);
      let name = await window.showInputBox();
      if (!name) return;
      name = name.replace(/-?\s+-?/g, '-');
      // if the sketch is the only item in the directory, copy the directory
      const { sketches } = await Sketch.analyzeDirectory(sketch.dir, { exclusions });
      if (sketches.length === 1 && sketches[0].mainFile === sketch.mainFile) {
        await workspace.fs.copy(Uri.file(sketch.dir), Uri.file(path.join(path.dirname(sketch.dir), name)));
        this.refresh();
      } else {
        // copy the sketch files within the same directory
        const basename = name.replace(/\.(js|html?)$/i, '');
        const replacements = [sketch.mainFile, sketch.scriptFile]
          .filter(Boolean)
          .map(file => ({
            src: Uri.file(path.join(sketch.dir, file)),
            target: Uri.file(path.join(sketch.dir, basename + path.extname(file)))
          }))
          .map(rec => ({ ...rec, targetExists: fsExists(rec.target) }));
        const targetsExist = await Promise.all(replacements.map(({ target }) => fsExists(target)));
        if (targetsExist.some(Boolean)) {
          const target = replacements[targetsExist.indexOf(true)].target;
          window.showErrorMessage(`Can't create a duplicate named ${name}. ${target.fsPath} already exists`);
          return;
        }
        await Promise.all(replacements.map(({ src, target }) => workspace.fs.copy(src, target)));
        this.refresh();
      }
      async function fsExists(uri: Uri): Promise<boolean> {
        return workspace.fs.stat(uri).then(
          () => true,
          () => false
        );
      }
    });
    commands.registerCommand('p5-explorer.createFolder', async (item: DirectoryItem) => {
      if (!(item instanceof DirectoryItem)) throw new Error(`${item} is not a directory`);
      const name = await window.showInputBox();
      if (!name) return;
      await workspace.fs.createDirectory(Uri.file(path.join(item.file, name)));
      this.refresh();
    });
    commands.registerCommand('p5-explorer.openSketch', (item: FilePathItem | Sketch) => {
      const file = item instanceof Sketch ? path.join(item.dir, item.scriptFile || item.mainFile) : item.file;
      return window.showTextDocument(Uri.file(file));
    });
    commands.registerCommand('p5-explorer.openSelectedItem', (item: FilePathItem | Sketch) => {
      const file = item instanceof Sketch ? path.join(item.dir, item.scriptFile || item.mainFile) : item.file;
      return commands.executeCommand('vscode.open', Uri.file(file));
    });
    commands.registerCommand('p5-explorer.runSelectedFile', (item: FilePathItem | Sketch) => {
      const file = item instanceof Sketch ? path.join(item.dir, item.mainFile) : item.file;
      return commands.executeCommand('p5-server.openBrowser', Uri.file(file));
    });
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: FileItem | DirectoryItem | Library | Sketch): vscode.TreeItem {
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

  getChildren(element?: FilePathItem | Sketch): vscode.ProviderResult<(FilePathItem | Library | Sketch)[]> {
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
      ...sketches,
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
