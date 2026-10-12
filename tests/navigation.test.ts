import test from 'node:test';
import assert from 'node:assert/strict';
import { navigationVisibility } from '../src/lib/navigation';

test('navigation hides login until authentication is known', () => {
  assert.deepEqual(navigationVisibility(undefined), { showLogin: false, showAdmin: false });
  assert.deepEqual(navigationVisibility(null), { showLogin: true, showAdmin: false });
  assert.deepEqual(navigationVisibility({ role: 'CUSTOMER' }), { showLogin: false, showAdmin: false });
});

test('navigation exposes admin only to staff and administrators', () => {
  assert.equal(navigationVisibility({ role: 'STAFF' }).showAdmin, true);
  assert.equal(navigationVisibility({ role: 'ADMIN' }).showAdmin, true);
  assert.equal(navigationVisibility({ role: 'CUSTOMER' }).showAdmin, false);
});
