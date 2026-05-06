import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveAuthUserFromClaims } from './authUser';

test('resolveAuthUserFromClaims normalizes the primary email claim', () => {
  const user = resolveAuthUserFromClaims({
    name: 'Alex Smith',
    email: ' Alex@Example.com ',
    preferred_username: 'ignored@example.com',
  });

  assert.deepEqual(user, {
    name: 'Alex Smith',
    email: 'alex@example.com',
  });
});

test('resolveAuthUserFromClaims falls back to preferred_username when email is missing', () => {
  const user = resolveAuthUserFromClaims({
    name: 'Alex Smith',
    preferred_username: 'alex@example.com',
  });

  assert.deepEqual(user, {
    name: 'Alex Smith',
    email: 'alex@example.com',
  });
});

test('resolveAuthUserFromClaims falls back to Okta login-style custom claims', () => {
  const user = resolveAuthUserFromClaims({
    given_name: 'Jordan',
    family_name: 'Jones',
    login: 'jordan@example.com',
  });

  assert.deepEqual(user, {
    name: 'Jordan Jones',
    email: 'jordan@example.com',
  });
});
