import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSuperAdmin, getSuperAdminEmail } from './superAdmin';

test('getSuperAdminEmail defaults to daniel@atlantafinehomes.com', () => {
  assert.equal(getSuperAdminEmail(), 'daniel@atlantafinehomes.com');
});

test('isSuperAdmin matches case-insensitively and trims whitespace', () => {
  assert.equal(isSuperAdmin('daniel@atlantafinehomes.com'), true);
  assert.equal(isSuperAdmin(' DANIEL@atlantafinehomes.COM '), true);
});

test('isSuperAdmin rejects other authorized users', () => {
  assert.equal(isSuperAdmin('sarah@atlantafinehomes.com'), false);
  assert.equal(isSuperAdmin('jp@atlantafinehomes.com'), false);
  assert.equal(isSuperAdmin(null), false);
  assert.equal(isSuperAdmin(undefined), false);
  assert.equal(isSuperAdmin(''), false);
});
