import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isAdminUser, adminPage } from '../src/lib/admin';
test('admin access is exact, server-configured and fails closed', () => {
  assert.equal(isAdminUser('user_owner', ' user_owner, user_second '), true);
  for (const id of [null, undefined, '', 'owner', 'user_owne', 'user_owner_extra', 'user_attacker']) assert.equal(isAdminUser(id, 'user_owner'), false);
  assert.equal(isAdminUser('user_owner', ''), false);
});
test('invalid pagination cannot create unbounded queries', () => {
  for (const v of ['-1', 'NaN', '1.1', 'Infinity', '100001', '0']) assert.equal(adminPage(v), 1);
  assert.equal(adminPage('2'), 2);
});
