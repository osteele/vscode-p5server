import { Library, Sketch } from 'p5-server';
import * as path from 'path';
import * as vscode from 'vscode';
import { Uri } from 'vscode';
import { RESOURCE_DIR_PATH } from '../configuration';
import { workspaceUriForPath } from '../helpers/fileHelpers';
import { fileDisplay } from './treeHelpers';

export type Element = LibraryItem | Sketch | FilePathItem;
export type FilePathItem = FileItem | DirectoryItem;

export class DirectoryItem extends vscode.TreeItem {
  constructor(
    public readonly file: string,
    public readonly parent: DirectoryItem | null,
    name?: string,
  ) {
    super(name || path.basename(file), vscode.TreeItemCollapsibleState.Collapsed);
    this.resourceUri = workspaceUriForPath(file);
    this.tooltip = fileDisplay(file);
  }

  contextValue = 'directory';
  iconPath = new vscode.ThemeIcon('file-directory');
}

export class FileItem extends vscode.TreeItem {
  constructor(
    public readonly file: string,
    public readonly parent: DirectoryItem | Sketch | null,
  ) {
    super(path.basename(file), vscode.TreeItemCollapsibleState.None);
    this.resourceUri = workspaceUriForPath(file);
    this.tooltip = fileDisplay(file);
    this.command = {
      command: 'vscode.open',
      title: 'Edit File',
      arguments: [workspaceUriForPath(file)],
    };
  }

  contextValue = 'file';
  iconPath = new vscode.ThemeIcon('file');
}

export class SketchItem extends vscode.TreeItem {
  static resourceBaseUri: Uri = Uri.file(RESOURCE_DIR_PATH);

  constructor(
    public readonly sketch: Sketch,
    public readonly parent: DirectoryItem | null,
    collapsibleState: vscode.TreeItemCollapsibleState,
  ) {
    super(sketch.name.replace(/\/$/, ''), collapsibleState);
    this.tooltip = fileDisplay(this.file);
    this.description = sketch.description;
    this.command = {
      command: 'p5-server.explorer.openSketch',
      title: 'Edit P5.js Sketch',
      arguments: [sketch],
    };
    this.contextValue = `sketch:${sketch.structureType}`;
  }

  get file() {
    return this.sketch.mainFilePath;
  }

  iconPath = {
    dark: vscode.Uri.joinPath(SketchItem.resourceBaseUri, 'dark/sketch.svg'),
    light: vscode.Uri.joinPath(SketchItem.resourceBaseUri, 'light/sketch.svg'),
  };
}

export class LibraryItem extends vscode.TreeItem {
  constructor(
    readonly library: Library,
    public readonly parent: Sketch | null,
  ) {
    super(path.basename(library.name), vscode.TreeItemCollapsibleState.None);
    const description = library.description.replace(/\.?$/, '.');
    if (isCompatibilityAddon(library)) {
      // A compatibility add-on is not a library the author chose. Its presence
      // records that the sketch still targets p5.js 1.x, so it reads as work
      // outstanding rather than as a dependency.
      this.description = 'p5.js 1.x';
      this.tooltip =
        `This sketch targets p5.js 1.x and is running through a compatibility add-on.\n` +
        `Convert it to p5.js 2 to drop the add-on.\n\nAdd-on description: ${description}`;
      this.contextValue = 'compat-library';
      this.iconPath = new vscode.ThemeIcon(
        'warning',
        new vscode.ThemeColor('problemsWarningIcon.foreground'),
      );
    } else {
      this.tooltip = `This sketch includes the ${library.name} library.\nLibrary description: ${description}`;
    }
  }

  contextValue = 'library';
  iconPath = new vscode.ThemeIcon('library');
}

/** Whether a library is one of the p5.js 1.x compatibility add-ons, which the
 * catalog groups in its own collection. */
export function isCompatibilityAddon(library: Library): boolean {
  return library.categoryKey === 'compat';
}
