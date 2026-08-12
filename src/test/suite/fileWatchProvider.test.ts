import * as assert from 'assert';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { createVSCodeFileWatchProvider } from '../../fileWatchProvider';

suite('File Watch Provider', () => {
  test('reports changes through the VS Code watcher', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'vscode-p5-watch-'));
    const changedFile = path.join(tempDir, 'sketch.js');
    let subscription: ReturnType<typeof createVSCodeFileWatchProvider> | undefined;
    try {
      const changed = new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timed out waiting for a file event')), 5000);
        subscription = createVSCodeFileWatchProvider([tempDir], filePath => {
          if (filePath !== changedFile) {
            return;
          }
          clearTimeout(timeout);
          resolve(filePath);
        });
      });

      await delay(100);
      await writeFile(changedFile, 'function setup() {}\n');
      assert.strictEqual(await changed, changedFile);
    } finally {
      subscription?.dispose();
      await rm(tempDir, { force: true, recursive: true });
    }
  });

  test('reports changes to a watched file', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'vscode-p5-watch-'));
    const changedFile = path.join(tempDir, 'sketch.js');
    let subscription: ReturnType<typeof createVSCodeFileWatchProvider> | undefined;
    try {
      await writeFile(changedFile, 'function setup() {}\n');
      const changed = new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timed out waiting for a file event')), 5000);
        subscription = createVSCodeFileWatchProvider([changedFile], filePath => {
          if (filePath !== changedFile) {
            return;
          }
          clearTimeout(timeout);
          resolve(filePath);
        });
      });

      await delay(100);
      await writeFile(changedFile, 'function setup() { createCanvas(400, 400); }\n');
      assert.strictEqual(await changed, changedFile);
    } finally {
      subscription?.dispose();
      await rm(tempDir, { force: true, recursive: true });
    }
  });

  test('ignores changes to unwatched sibling files', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'vscode-p5-watch-'));
    const watchedFile = path.join(tempDir, 'sketch.js');
    const siblingFile = path.join(tempDir, 'notes.js');
    let calls = 0;
    let subscription: ReturnType<typeof createVSCodeFileWatchProvider> | undefined;
    try {
      await writeFile(watchedFile, 'function setup() {}\n');
      subscription = createVSCodeFileWatchProvider([watchedFile, watchedFile], () => calls++);

      await delay(200);
      calls = 0;
      await writeFile(siblingFile, 'const note = true;\n');
      await delay(300);
      assert.strictEqual(calls, 0);
    } finally {
      subscription?.dispose();
      await rm(tempDir, { force: true, recursive: true });
    }
  });

  test('does not duplicate events for overlapping watched paths', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'vscode-p5-watch-'));
    const changedFile = path.join(tempDir, 'sketch.js');
    let subscription: ReturnType<typeof createVSCodeFileWatchProvider> | undefined;
    try {
      await writeFile(changedFile, 'function setup() {}\n');
      await delay(200);
      let calls = 0;
      const changed = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timed out waiting for a file event')), 5000);
        subscription = createVSCodeFileWatchProvider([tempDir, changedFile, changedFile], filePath => {
          if (filePath !== changedFile) return;
          calls++;
          setTimeout(() => {
            clearTimeout(timeout);
            try {
              assert.strictEqual(calls, 1);
              resolve();
            } catch (error) {
              reject(error);
            }
          }, 200);
        });
      });

      await delay(100);
      await writeFile(changedFile, 'function setup() { createCanvas(400, 400); }\n');
      await changed;
    } finally {
      subscription?.dispose();
      await rm(tempDir, { force: true, recursive: true });
    }
  });
});
