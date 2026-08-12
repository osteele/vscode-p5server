import type { ChildProcess } from 'node:child_process';
import type { Options } from 'open';

/**
 * A wrapper for the open.open function that waits until the process status code
 * has been set before returning.
 *
 * @internal
 */
export async function openInBrowser(target: string, options?: Options): Promise<ChildProcess> {
  const { default: open } = await import('open');
  const process = await open(target, options);
  if (process.exitCode === null) {
    await new Promise<void>(resolve => {
      const finish = () => {
        clearTimeout(timeoutTimer);
        process.removeListener('exit', finish);
        process.removeListener('error', finish);
        resolve();
      };
      process.once('exit', finish);
      process.once('error', finish);
      const timeoutTimer = setTimeout(finish, 5000);
    });
  }
  return process;
}
