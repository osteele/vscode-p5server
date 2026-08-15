import fs from 'node:fs';
import path from 'node:path';
import { Disposable, RelativePattern, Uri, workspace } from 'vscode';
import { workspaceUriForPath } from './helpers/fileHelpers';

export type FileWatchProvider = (filePaths: readonly string[], onDidChange: (filePath: string) => void) => Disposable;

/** Use VS Code's out-of-process file watcher for p5-server live reload. */
export const createVSCodeFileWatchProvider: FileWatchProvider = (filePaths, onDidChange) => {
  const subscriptions: Disposable[] = [];
  const directoryPaths = new Set<string>();
  const filesByDirectory = new Map<string, Set<string>>();
  const lastReportedAt = new Map<string, number>();
  const reportChange = (filePath: string) => {
    const now = Date.now();
    if (now - (lastReportedAt.get(filePath) ?? 0) < 200) return;
    lastReportedAt.set(filePath, now);
    if (lastReportedAt.size > 1000) {
      for (const [reportedPath, reportedAt] of lastReportedAt) {
        if (now - reportedAt > 1000) lastReportedAt.delete(reportedPath);
      }
    }
    onDidChange(filePath);
  };

  for (const filePath of new Set(filePaths.map(filePath => path.resolve(filePath)))) {
    const isDirectory = fs.statSync(filePath).isDirectory();
    if (isDirectory) {
      directoryPaths.add(filePath);
    } else {
      const dir = path.dirname(filePath);
      const files = filesByDirectory.get(dir) ?? new Set<string>();
      files.add(filePath);
      filesByDirectory.set(dir, files);
    }
  }

  const watchedDirectories = [...directoryPaths].filter(
    candidate => ![...directoryPaths].some(other => other !== candidate && isInside(other, candidate)),
  );

  for (const directoryPath of watchedDirectories) {
    const watcher = workspace.createFileSystemWatcher(new RelativePattern(workspaceUriForPath(directoryPath), '**/*'));
    subscriptions.push(
      watcher,
      watcher.onDidCreate(uri => reportChange(uri.fsPath)),
      watcher.onDidChange(uri => reportChange(uri.fsPath)),
      watcher.onDidDelete(uri => reportChange(uri.fsPath)),
    );
  }

  for (const [dir, files] of filesByDirectory) {
    if (watchedDirectories.some(directoryPath => isInside(directoryPath, dir))) continue;
    const watcher = workspace.createFileSystemWatcher(new RelativePattern(workspaceUriForPath(dir), '*'));
    const reportIfWatched = (uri: Uri) => {
      if (files.has(path.resolve(uri.fsPath))) reportChange(uri.fsPath);
    };
    subscriptions.push(
      watcher,
      watcher.onDidCreate(reportIfWatched),
      watcher.onDidChange(reportIfWatched),
      watcher.onDidDelete(reportIfWatched),
    );
  }

  return Disposable.from(...subscriptions);
};

function isInside(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}
