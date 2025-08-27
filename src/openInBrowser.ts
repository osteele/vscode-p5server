import { ChildProcess } from 'child_process';
const open = require('open');

/**
 * A wrapper for the open.open function that waits until the process status code
 * has been set before returning.
 *
 * @internal
 */
export async function openInBrowser(target: string, options?: typeof open.Options): Promise<ChildProcess> {
  const process = await open.default(target, options);
  if (process.exitCode === null) {
    await new Promise<void>(resolve => {
      const intervalTimer = setInterval(() => {
        if (process.exitCode !== null) {
          clearInterval(intervalTimer);
          clearTimeout(timeoutTimer);
          resolve();
        }
      }, 50);
      const timeoutTimer = setTimeout(() => {
        clearInterval(intervalTimer);
        resolve();
      }, 5000);
    });
  }
  return process;
}
