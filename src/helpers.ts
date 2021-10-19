import { Uri, window, workspace } from 'vscode';
import path = require('path');

export async function createFolder({ dir }: { dir?: string } = {}): Promise<void> {
  const wsFolders = getWorkspaceFolderPaths();
  dir =
    dir ||
    (wsFolders.length > 1
      ? await window.showQuickPick(wsFolders, { placeHolder: 'Select a workspace folder' })
      : wsFolders[0]);
  if (!dir) return; // the user cancelled
  const name = await window.showInputBox();
  if (!name) return;
  await workspace.fs.createDirectory(Uri.file(path.join(dir, name)));
}

export async function fileExists(filepath: string): Promise<boolean> {
  try {
    await workspace.fs.stat(Uri.file(filepath));
    return true;
  } catch (e) {
    if (e.code === 'FileNotFound') return false;
    throw e;
  }
}

export async function fsExists(uri: Uri): Promise<boolean> {
  return workspace.fs.stat(uri).then(
    () => true,
    () => false
  );
}

/** Return a list of the file paths for workspace folder with scheme 'file'.
 * If no workspace folders are found, return an empty list.
 * If the workspace folders have no scheme 'file', return an empty list.
 */
export function getWorkspaceFolderPaths(): string[] {
  return workspace.workspaceFolders
    ? workspace.workspaceFolders
        .map(folder => folder.uri)
        .filter(uri => uri.scheme === 'file')
        .map(uri => uri.fsPath)
    : [];
}
