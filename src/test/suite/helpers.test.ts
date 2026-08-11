import * as assert from 'assert';
import { compareVersions, VersionChange } from '../../helpers/compareVersions';
import { toZeroBasedPosition, withConsoleRelayQuery } from '../../helpers';

suite('Helpers', () => {
  test('compareVersions', () => {
    assert.strictEqual(compareVersions('1.0.0', null), VersionChange.noPreviousVersion);
    assert.strictEqual(compareVersions('1.0.0', '1.0.0'), VersionChange.noChange);
    assert.strictEqual(compareVersions('1.0.1', '1.0.0'), VersionChange.patch);
    assert.strictEqual(compareVersions('1.1.0', '1.0.0'), VersionChange.minor);
    assert.strictEqual(compareVersions('2.0.0', '1.0.0'), VersionChange.major);
  });

  test('withConsoleRelayQuery', () => {
    assert.strictEqual(
      withConsoleRelayQuery('http://localhost:3000/sketch.js'),
      'http://localhost:3000/sketch.js?send-console-messages=1',
    );
    assert.strictEqual(
      withConsoleRelayQuery('http://localhost:3000/sketch.js?foo=bar'),
      'http://localhost:3000/sketch.js?foo=bar&send-console-messages=1',
    );
  });

  test('toZeroBasedPosition', () => {
    assert.deepStrictEqual(toZeroBasedPosition(1, 1), { line: 0, col: 0 });
    assert.deepStrictEqual(toZeroBasedPosition(12, 4), { line: 11, col: 3 });
    assert.deepStrictEqual(toZeroBasedPosition(0, 0), { line: 0, col: 0 });
  });
});
