import test from 'node:test';
import assert from 'node:assert/strict';

import { License } from '../types';
import {
  DEFAULT_INVENTORY_VIEW_STATE,
  filterAndSortLicenses,
} from './inventoryView';

const licenses: License[] = [
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
    sourceBoardId: 'marketing-board',
    sourceBoardName: 'Marketing Board',
    recordBoardId: 'marketing-board',
    recordBoardName: 'Marketing Board',
    recordKind: 'item',
    coOwners: [{ name: 'Alex Carter', email: 'alex@example.com' }],
    riskLevel: 'Low Risk',
    status: 'Healthy',
  },
  {
    id: '2',
    application: 'Meraki',
    vendor: 'Cisco',
    amount: 400,
    length: 'Monthly',
    renewalMethod: 'ACH',
    renewalDate: '2026-06-15',
    seats: '5',
    useCase: 'Infrastructure',
    progress: 70,
    department: 'Operations',
    sourceBoardId: 'ops-board',
    sourceBoardName: 'Operations Board',
    recordBoardId: 'ops-board',
    recordBoardName: 'Operations Board',
    recordKind: 'item',
    coOwners: [{ name: 'Jordan Lee', email: 'jordan@example.com' }],
    riskLevel: 'Medium Risk',
    status: 'Warning',
  },
  {
    id: '3',
    application: 'Adobe',
    vendor: 'Adobe',
    amount: 800,
    length: 'Annual',
    renewalMethod: 'Manual',
    renewalDate: '2026-07-10',
    seats: '8',
    useCase: 'Creative',
    progress: 50,
    department: 'Marketing',
    sourceBoardId: 'marketing-board',
    sourceBoardName: 'Marketing Board',
    recordBoardId: 'marketing-board',
    recordBoardName: 'Marketing Board',
    recordKind: 'item',
    coOwners: [{ name: 'Alex Carter', email: 'alex@example.com' }],
    riskLevel: 'Low Risk',
    status: 'Healthy',
  },
];

test('filterAndSortLicenses supports multi-select department and board filters', () => {
  const result = filterAndSortLicenses(licenses, {
    ...DEFAULT_INVENTORY_VIEW_STATE,
    selectedDepartments: ['Marketing', 'Operations'],
    selectedBoards: ['Marketing Board'],
  });

  assert.deepEqual(result.map((license) => license.id), ['3', '1']);
});

test('filterAndSortLicenses supports multi-select co-owner email filtering', () => {
  const result = filterAndSortLicenses(licenses, {
    ...DEFAULT_INVENTORY_VIEW_STATE,
    selectedCoOwnerEmails: ['alex@example.com'],
  });

  assert.deepEqual(result.map((license) => license.id), ['3', '1']);
});

test('filterAndSortLicenses applies ascending and descending amount sorting', () => {
  const ascResult = filterAndSortLicenses(licenses, {
    ...DEFAULT_INVENTORY_VIEW_STATE,
    sortField: 'AMOUNT',
    sortDirection: 'ASC',
  });

  const descResult = filterAndSortLicenses(licenses, {
    ...DEFAULT_INVENTORY_VIEW_STATE,
    sortField: 'AMOUNT',
    sortDirection: 'DESC',
  });

  assert.deepEqual(ascResult.map((license) => license.id), ['2', '3', '1']);
  assert.deepEqual(descResult.map((license) => license.id), ['1', '3', '2']);
});
