import { workspace } from 'vscode';

// Return a list of the file paths for workspace folder with scheme 'file'
export function getWorkspaceFolderPaths(): string[] {
  return workspace.workspaceFolders
    ? workspace.workspaceFolders
        .map(folder => folder.uri)
        .filter(uri => uri.scheme === 'file')
        .map(uri => uri.fsPath)
    : [];
}
