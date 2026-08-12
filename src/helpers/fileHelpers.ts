import path from 'node:path';
import { Uri, WorkspaceFolder, workspace } from 'vscode';

export async function fileExists(filepath: string): Promise<boolean> {
  try {
    await workspace.fs.stat(workspaceUriForPath(filepath));
    return true;
  } catch (e) {
    if (e instanceof Error && 'code' in e && e.code === 'FileNotFound') {
      return false;
    }
    throw e;
  }
}

export async function fsExists(uri: Uri): Promise<boolean> {
  return workspace.fs.stat(uri).then(
    () => true,
    () => false,
  );
}

/** Return paths as seen by the extension host, including a remote extension host. */
export function getWorkspaceFolderPaths(): string[] {
  return workspace.workspaceFolders?.map(folder => folder.uri.fsPath).filter(Boolean) ?? [];
}

/** Find the workspace folder whose extension-host path contains a resource. */
export function getWorkspaceFolderForPath(filePath: string): WorkspaceFolder | undefined {
  return workspace.workspaceFolders?.find(folder => isPathInside(folder.uri.fsPath, filePath));
}

/** Convert an extension-host path back to a URI with its workspace's scheme and authority. */
export function workspaceUriForPath(filePath: string): Uri {
  const folder = getWorkspaceFolderForPath(filePath);
  if (!folder) return Uri.file(filePath);
  const relative = path.relative(folder.uri.fsPath, filePath);
  return relative ? Uri.joinPath(folder.uri, ...relative.split(path.sep)) : folder.uri;
}

function isPathInside(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}
