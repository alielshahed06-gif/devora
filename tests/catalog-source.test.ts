import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldUseDemoCatalog } from '../src/server/catalog';

test('catalog source uses demo only for local development and never permits it in production', () => {
  assert.equal(shouldUseDemoCatalog(undefined, 'development', undefined), true);
  assert.equal(shouldUseDemoCatalog('auto', 'development', 'postgresql://localhost/store'), false);
  assert.equal(shouldUseDemoCatalog('database', 'development', undefined), false);
  assert.equal(shouldUseDemoCatalog('demo', 'development', undefined), true);
  assert.equal(shouldUseDemoCatalog('auto', 'production', undefined), false);
  assert.throws(() => shouldUseDemoCatalog('demo', 'production', undefined), /disabled in production/);
  assert.throws(() => shouldUseDemoCatalog('invalid', 'development', undefined), /must be auto, database, or demo/);
});
