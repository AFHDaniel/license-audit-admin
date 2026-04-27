import test from 'node:test';
import assert from 'node:assert/strict';

import { canAccessLicense, filterLicensesByGrant } from './departmentAccess';
import { DepartmentGrant, License } from '../types';

const marketingLicense: License = {
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
  sourceBoardId: 'marketing-board',
  sourceBoardName: 'Marketing Board',
  recordBoardId: 'marketing-board',
  recordBoardName: 'Marketing Board',
  recordKind: 'item',
  coOwners: [
    { name: 'Alex Carter', email: 'alex@example.com' },
  ],
  riskLevel: 'Low Risk',
  status: 'Healthy',
};

test('canAccessLicense allows department managers to access their own department records', () => {
  const grant: DepartmentGrant = {
    email: 'jordan@example.com',
    role: 'manager',
    departments: ['Marketing'],
  };

  assert.equal(canAccessLicense(marketingLicense, grant), true);
});

test('canAccessLicense allows co-owners to access records outside their department scope', () => {
  const grant: DepartmentGrant = {
    email: 'alex@example.com',
    role: 'manager',
    departments: ['Operations'],
  };

  assert.equal(canAccessLicense(marketingLicense, grant), true);
});

test('filterLicensesByGrant keeps co-owned records even when board department differs', () => {
  const grant: DepartmentGrant = {
    email: 'alex@example.com',
    role: 'manager',
    departments: ['Operations'],
  };

  const filtered = filterLicensesByGrant([marketingLicense], grant);

  assert.deepEqual(filtered.map((license) => license.id), ['1']);
});
