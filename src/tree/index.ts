import { Library, Sketch } from 'p5-server';
import * as path from 'path';
import * as vscode from 'vscode';
import { commands, Uri, window, workspace } from 'vscode';
import * as sketchCommands from '../commands';
import { getWorkspaceFolderPaths } from '../helpers';
import { Element, FilePathItem, FileItem, DirectoryItem, LibraryItem } from './elements';
import { sketchIsEntireDirectory } from './helpers';
import { SketchTreeProvider } from './treeProvider';

export const RESOURCE_DIR_PATH = path.join(__dirname, '../../resources');

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
      commands.registerCommand('p5-server.explorer.openLibrary', (item: LibraryItem) =>
        sketchCommands.openLibraryPane(item.library)
      )
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
