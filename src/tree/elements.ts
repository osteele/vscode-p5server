import { Library, Sketch } from 'p5-server';
import * as path from 'path';
import * as vscode from 'vscode';
import { Uri } from 'vscode';
import { RESOURCE_DIR_PATH } from './index';
import { fileDisplay } from './helpers';

export type Element = LibraryItem | Sketch | FilePathItem;
export type FilePathItem = FileItem | DirectoryItem;

export class DirectoryItem extends vscode.TreeItem {
  constructor(public readonly file: string, public readonly parent: DirectoryItem | null, name?: string) {
    super(name || path.basename(file), vscode.TreeItemCollapsibleState.Collapsed);
    this.resourceUri = Uri.file(file);
    this.tooltip = fileDisplay(file);
  }

  contextValue = 'directory';
  iconPath = new vscode.ThemeIcon('file-directory');
}

export class FileItem extends vscode.TreeItem {
  constructor(public readonly file: string, public readonly parent: DirectoryItem | Sketch | null) {
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

export class SketchItem extends vscode.TreeItem {
  constructor(
    public readonly sketch: Sketch,
    public readonly parent: DirectoryItem | null,
    collapsibleState: vscode.TreeItemCollapsibleState
  ) {
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
    dark: path.join(RESOURCE_DIR_PATH, 'dark', 'sketch.svg'),
    light: path.join(RESOURCE_DIR_PATH, 'light', 'sketch.svg')
  };
}

export class LibraryItem extends vscode.TreeItem {
  constructor(readonly library: Library, public readonly parent: Sketch | null) {
    super(path.basename(library.name), vscode.TreeItemCollapsibleState.None);
    const description = library.description.replace(/\.?$/, '.');
    this.tooltip = `This sketch includes the ${library.name} library.\nLibrary description: ${description}`;
  }

  contextValue = 'library';
  iconPath = new vscode.ThemeIcon('library');
}
