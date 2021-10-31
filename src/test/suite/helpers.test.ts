import * as assert from 'assert';
import { compareVersions, VersionChange } from '../../helpers/compareVersions';

suite('Helpers', () => {
  test('compareVersions', () => {
    assert.strictEqual(compareVersions('1.0.0', null), VersionChange.noPreviousVersion);
    assert.strictEqual(compareVersions('1.0.0', '1.0.0'), VersionChange.noChange);
    assert.strictEqual(compareVersions('1.0.1', '1.0.0'), VersionChange.patch);
    assert.strictEqual(compareVersions('1.1.0', '1.0.0'), VersionChange.minor);
    assert.strictEqual(compareVersions('2.0.0', '1.0.0'), VersionChange.major);
  });
});
