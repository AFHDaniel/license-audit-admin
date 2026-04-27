import test from 'node:test';
import assert from 'node:assert/strict';

import { License } from '../types';
import {
  getLicenseReminderRecipients,
  hasCoOwnerAccess,
} from './licenseOwnership';

const baseLicense: License = {
  id: '1',
  application: 'Canva',
  vendor: 'Canva',
  amount: 1200,
  length: '12 months',
  renewalMethod: 'Credit Card',
  renewalDate: '2026-08-31',
  seats: '15',
  useCase: 'Design',
  progress: 90,
  department: 'Marketing',
  sourceBoardId: 'b1',
  sourceBoardName: 'Marketing Board',
  riskLevel: 'Low Risk',
  status: 'Healthy',
  coOwners: [
    { name: 'Alex Carter', email: 'alex@example.com' },
    { name: 'Jordan Lee', email: 'jordan@example.com' },
  ],
};

test('hasCoOwnerAccess matches a listed co-owner email', () => {
  assert.equal(hasCoOwnerAccess(baseLicense, 'alex@example.com'), true);
});

test('hasCoOwnerAccess ignores casing and whitespace in emails', () => {
  assert.equal(hasCoOwnerAccess(baseLicense, '  ALEX@EXAMPLE.COM  '), true);
});

test('hasCoOwnerAccess returns false when the user is not listed', () => {
  assert.equal(hasCoOwnerAccess(baseLicense, 'nobody@example.com'), false);
});

test('hasCoOwnerAccess matches text-column co-owners by first name', () => {
  const textLicense: License = {
    ...baseLicense,
    coOwners: [
      { name: 'Beth', email: '' },
      { name: 'Casey', email: '' },
    ],
  };
  assert.equal(hasCoOwnerAccess(textLicense, 'beth@example.com'), true);
  assert.equal(hasCoOwnerAccess(textLicense, 'casey@example.com'), true);
  assert.equal(hasCoOwnerAccess(textLicense, 'someone@example.com'), false);
});

test('hasCoOwnerAccess matches text-column co-owners written as full names', () => {
  const textLicense: License = {
    ...baseLicense,
    coOwners: [{ name: 'Beth Smith', email: '' }],
  };
  assert.equal(hasCoOwnerAccess(textLicense, 'beth@example.com'), true);
  assert.equal(hasCoOwnerAccess(textLicense, 'smith@example.com'), false);
});

test('hasCoOwnerAccess does not fall back to name match when an explicit email is set', () => {
  // When the co-owner came from a people column with a real email, trust it.
  // Don't grant access just because a first name happens to match.
  const mixed: License = {
    ...baseLicense,
    coOwners: [{ name: 'Beth', email: 'someone-else@example.com' }],
  };
  assert.equal(hasCoOwnerAccess(mixed, 'beth@example.com'), false);
});

test('getLicenseReminderRecipients returns normalized unique co-owner emails', () => {
  const recipients = getLicenseReminderRecipients({
    ...baseLicense,
    coOwners: [
      { name: 'Alex Carter', email: 'alex@example.com' },
      { name: 'Alex Duplicate', email: ' ALEX@EXAMPLE.COM ' },
      { name: 'Jordan Lee', email: 'jordan@example.com' },
      { name: 'No Email', email: '' },
    ],
  });

  assert.deepEqual(recipients, [
    'alex@example.com',
    'jordan@example.com',
  ]);
});
