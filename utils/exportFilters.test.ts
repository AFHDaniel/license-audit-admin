import test from 'node:test';
import assert from 'node:assert/strict';

import { filterLicensesForExport } from './exportFilters';
import { License } from '../types';

const baseLicenses: License[] = [
  {
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
  },
  {
    id: '2',
    application: 'DocuSign',
    vendor: 'DocuSign',
    amount: 900,
    length: '12 months',
    renewalMethod: 'Manual',
    renewalDate: '2026-06-01',
    seats: '10',
    useCase: 'Contracts',
    progress: 60,
    department: 'Operations',
    sourceBoardId: 'b2',
    sourceBoardName: 'Operations Board',
    riskLevel: 'Medium Risk',
    status: 'Warning',
  },
];

test('filterLicensesForExport matches search + payment + department filters together', () => {
  const filtered = filterLicensesForExport(baseLicenses, {
    search: 'can',
    selectedDepartments: ['Marketing'],
    payment: 'CREDIT_CARD',
    risk: 'ALL',
    status: 'ALL',
    renewalWindow: 'ALL',
  });

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, '1');
});

test('filterLicensesForExport can isolate manual renewals with warning status', () => {
  const filtered = filterLicensesForExport(baseLicenses, {
    search: '',
    selectedDepartments: ['Marketing', 'Operations'],
    payment: 'MANUAL',
    risk: 'ALL',
    status: 'Warning',
    renewalWindow: 'ALL',
  });

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, '2');
});

test('filterLicensesForExport supports renewal window filters', () => {
  const licensesWithNoDate: License[] = baseLicenses.map((license) =>
    license.id === '2'
      ? { ...license, renewalDate: '' }
      : license,
  );

  const filtered = filterLicensesForExport(licensesWithNoDate, {
    search: '',
    selectedDepartments: ['Marketing', 'Operations'],
    payment: 'ALL',
    risk: 'ALL',
    status: 'ALL',
    renewalWindow: 'NO_DATE',
  });

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, '2');
});
