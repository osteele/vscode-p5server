import * as assert from 'node:assert';
import type { Library } from 'p5-server';
import { LibraryItem } from '../../tree/elements';

function fakeLibrary(overrides: Partial<Library>): Library {
  return {
    name: 'p5.sound',
    description: 'A library',
    homepage: 'https://example.com',
    categoryKey: 'core',
    ...overrides,
  } as Library;
}

suite('Library explorer rows', () => {
  test('an ordinary library reads as a dependency', () => {
    const item = new LibraryItem(fakeLibrary({}), null);

    assert.strictEqual(item.contextValue, 'library');
    assert.match(String(item.tooltip), /includes the p5\.sound library/);
    assert.strictEqual(item.description, undefined);
  });

  test('a compatibility add-on reads as work outstanding', () => {
    const item = new LibraryItem(
      fakeLibrary({ name: 'p5.js compatibility: preload', categoryKey: 'compat' }),
      null,
    );

    // The contextValue is what puts the conversion on this row's menu.
    assert.strictEqual(item.contextValue, 'compat-library');
    assert.strictEqual(item.description, 'p5.js 1.x');
    assert.match(String(item.tooltip), /targets p5\.js 1\.x/);
    assert.match(String(item.tooltip), /Convert it to p5\.js 2/);
  });
});
