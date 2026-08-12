import fs from 'node:fs';
import path from 'node:path';
import { Disposable, RelativePattern, Uri, workspace } from 'vscode';

type FileWatchProvider = (filePaths: readonly string[], onDidChange: (filePath: string) => void) => Disposable;

/** Use VS Code's out-of-process file watcher for p5-server live reload. */
export const createVSCodeFileWatchProvider: FileWatchProvider = (filePaths, onDidChange) => {
  const subscriptions: Disposable[] = [];

  for (const filePath of filePaths) {
    const isDirectory = fs.statSync(filePath).isDirectory();
    const basePath = isDirectory ? filePath : path.dirname(filePath);
    const pattern = isDirectory ? '**/*' : path.basename(filePath);
    const watcher = workspace.createFileSystemWatcher(new RelativePattern(Uri.file(basePath), pattern));
    subscriptions.push(
      watcher,
      watcher.onDidCreate(uri => onDidChange(uri.fsPath)),
      watcher.onDidChange(uri => onDidChange(uri.fsPath)),
      watcher.onDidDelete(uri => onDidChange(uri.fsPath)),
    );
  }

  return Disposable.from(...subscriptions);
};
