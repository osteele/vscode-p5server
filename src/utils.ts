import { workspace } from 'vscode';

export function getWorkspaceFolderPaths() {
  return workspace.workspaceFolders
    ? workspace.workspaceFolders
        .map(folder => folder.uri)
        .filter(uri => uri.scheme === 'file')
        .map(uri => uri.fsPath)
    : [];
}
