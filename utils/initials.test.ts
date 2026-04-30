import test from 'node:test';
import assert from 'node:assert/strict';

import { getInitials } from './initials';

test('two-word name returns first letters of each word uppercased', () => {
  assert.equal(getInitials('Daniel Inyang'), 'DI');
});

test('three-word name caps at two letters', () => {
  assert.equal(getInitials('Sarah Boehmig Mumaw'), 'SB');
});

test('single-word name returns one letter', () => {
  assert.equal(getInitials('Daniel'), 'D');
});

test('parenthesised qualifier is skipped', () => {
  // "Daniel (Local Admin)" used to return "D(" — the bug we shipped this for.
  assert.equal(getInitials('Daniel (Local Admin)'), 'DL');
});

test('numbers and punctuation in words are stripped', () => {
  assert.equal(getInitials('1234 alice'), 'A');
});

test('falls back to the supplied default for empty input', () => {
  assert.equal(getInitials(''), 'U');
  assert.equal(getInitials(null), 'U');
  assert.equal(getInitials(undefined), 'U');
});

test('falls back when name has no alphabetic characters at all', () => {
  assert.equal(getInitials('123 456'), 'U');
  assert.equal(getInitials('!@# $%^'), 'U');
});

test('respects a custom fallback', () => {
  assert.equal(getInitials('', '?'), '?');
});

test('handles extra whitespace', () => {
  assert.equal(getInitials('  Aaron   Bowie  '), 'AB');
});

test('handles lowercase input', () => {
  assert.equal(getInitials('jp hiro'), 'JH');
});
