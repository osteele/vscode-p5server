import * as assert from 'assert';
import { exclusions } from '../../configuration';

suite('Configuration', () => {
  test('exclusions should contain expected patterns', () => {
    const expectedExclusions = ['.*', '*.lock', '*.log', 'node_modules', 'package.json'];

    assert.deepStrictEqual(exclusions, expectedExclusions);
  });

  test('exclusions should exclude common system files', () => {
    assert.ok(exclusions.includes('.*')); // Hidden files
    assert.ok(exclusions.includes('node_modules')); // Dependencies
    assert.ok(exclusions.includes('*.log')); // Log files
    assert.ok(exclusions.includes('*.lock')); // Lock files
    assert.ok(exclusions.includes('package.json')); // Package manifest
  });
});
