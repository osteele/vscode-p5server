import { Library, Sketch } from 'p5-server';
import * as path from 'path';
import * as vscode from 'vscode';
import { commands, window, workspace } from 'vscode';
import { getWorkspaceFolderPaths, workspaceUriForPath } from '../helpers/fileHelpers';
import { sketchIsEntireDirectory } from '../helpers/sketchHelpers';
import { validateChildName } from '../helpers/fileNames';
import { DirectoryItem, Element, FileItem, FilePathItem, LibraryItem } from './elements';
import { SketchTreeProvider } from './treeProvider';

export class SketchExplorer {
  private readonly provider: SketchTreeProvider;
  private selection: Element | null = null;

  constructor(context: vscode.ExtensionContext) {
    this.provider = new SketchTreeProvider(context);
    const treeView = vscode.window.createTreeView('p5sketchExplorer', {
      showCollapseAll: true,
      treeDataProvider: this.provider,
    });
    context.subscriptions.push(
      this.provider,
      treeView,
      treeView.onDidChangeSelection(e => {
        this.selection = e.selection[0];
      }),
    );
    context.subscriptions.push(workspace.onDidChangeWorkspaceFolders(() => this.provider.workspaceFoldersChanged()));
    this.registerCommands(context);

    context.subscriptions.push(
      window.onDidChangeActiveTextEditor(editor => {
        if (editor && workspace.getConfiguration('p5-server').get<boolean>('explorer.autoReveal', true)) {
          const file = editor.document.uri.fsPath;
          const element = this.provider.getElementForFile(file);
          if (element) treeView.reveal(element);
        }
      }),
    );
  }

  public registerCommands(context: vscode.ExtensionContext) {
    context.subscriptions.push(
      commands.registerCommand('p5-server.explorer.refresh', () => this.provider.refresh()),
      commands.registerCommand('p5-server.explorer.createFolder', async (item?: FilePathItem) =>
        this.createFolderInSelectedLocation(item),
      ),
      commands.registerCommand('p5-server.explorer.createSketch', async () =>
        this.createSketchInSelectedFolder('script'),
      ),
      commands.registerCommand('p5-server.explorer.createSketch#html', async () =>
        this.createSketchInSelectedFolder('html'),
      ),
      commands.registerCommand('p5-server.explorer.createSketch#folder', async () =>
        this.createSketchInSelectedFolder('folder'),
      ),
      commands.registerCommand('p5-server.explorer.rename', async (item: Sketch | FilePathItem) =>
        (await import('../commands/conversionCommands')).renameSketch(
          item instanceof Sketch ? item : item.resourceUri!,
        ),
      ),
      commands.registerCommand('p5-server.explorer.open', (item: Sketch | FileItem) => {
        const uri =
          item instanceof Sketch ? workspaceUriForPath(item.scriptFilePath || item.mainFilePath) : item.resourceUri;
        return commands.executeCommand('vscode.open', uri);
      }),
      commands.registerCommand('p5-server.explorer.openSketch', (sketch: Sketch) => {
        const uri = workspaceUriForPath(sketch.scriptFilePath);
        return workspace.getConfiguration('p5-server.explorer').get<boolean>('autoRunSketchOnSide')
          ? Promise.all([
              commands.executeCommand('vscode.open', uri, { preview: true, viewColumn: 1 }),
              commands.executeCommand('p5-server.openBrowser', uri, { browser: 'integrated' }),
            ])
          : commands.executeCommand('vscode.open', uri);
      }),

      // Run sketch commands. The view/item/context[].when clause narrow the argument types to sketch | file
      commands.registerCommand('p5-server.explorer.run', (item: Sketch | FilePathItem) => this.runSelectedSketch(item)),
      commands.registerCommand('p5-server.explorer.run#integrated', (item: Sketch | FilePathItem) =>
        this.runSelectedSketch(item, 'integrated'),
      ),
      commands.registerCommand('p5-server.explorer.run#external', (item: Sketch | FilePathItem) =>
        this.runSelectedSketch(item, 'external'),
      ),
      commands.registerCommand('p5-server.explorer.debug', (item: Sketch | FilePathItem) => {
        const uri = item instanceof Sketch ? workspaceUriForPath(item.mainFilePath) : item.resourceUri;
        return commands.executeCommand('p5-server.debug', uri);
      }),
      commands.registerCommand('p5-server.explorer.openLibrary', async (item: LibraryItem) =>
        (await import('../commands/runCommands')).openLibraryPane(item.library),
      ),
    );
  }

  async createFolderInSelectedLocation(item?: FilePathItem): Promise<void> {
    const wsFolders = getWorkspaceFolderPaths();
    const selectedItem = item || this.selection;
    const selectedDir =
      selectedItem instanceof DirectoryItem
        ? selectedItem.file
        : selectedItem instanceof FileItem
          ? path.dirname(selectedItem.file)
          : undefined;
    const dir =
      selectedDir ||
      (wsFolders.length > 1
        ? await window.showQuickPick(wsFolders, { placeHolder: 'Select a workspace folder' })
        : wsFolders[0]);
    if (!dir) return; // the user cancelled

    const name = await window.showInputBox({ validateInput: validateChildName });
    if (!name) return;

    await workspace.fs.createDirectory(workspaceUriForPath(path.join(dir, name.trim())));
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
    const uri = item instanceof Sketch ? workspaceUriForPath(item.mainFilePath) : item.resourceUri;
    return commands.executeCommand('p5-server.openBrowser', uri, { browser: where });
  }
}
