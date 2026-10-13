import {test} from 'node:test';
import assert from 'node:assert/strict';
import {safeNextPath} from './auth-navigation.ts';

test('sign-in returns to an internal route with its query and fragment', () => {
  assert.equal(safeNextPath('/binder?collection=Missing#cards'), '/binder?collection=Missing#cards');
  assert.equal(safeNextPath('/account/update-password'), '/account/update-password');
});
test('external and browser-normalized redirect attempts stay on the app', () => {
  for (const value of ['https://example.com', '//example.com', '/\\example.com', '/\n/example.com', 'javascript:alert(1)', null, undefined]) {
    assert.equal(safeNextPath(value), '/');
  }
});
