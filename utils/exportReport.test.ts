import test from 'node:test';
import assert from 'node:assert/strict';

import { buildLicenseReportCsv, buildReportFileName } from './exportReport';

test('buildLicenseReportCsv includes headers and escapes values', () => {
  const csv = buildLicenseReportCsv([
    {
      id: '42',
      application: 'Canva, Pro',
      vendor: 'Canva "Inc"',
      amount: 1299.5,
      length: '12 months',
      renewalMethod: 'Credit Card',
      renewalDate: '2026-08-31',
      seats: '15',
      useCase: 'Design\nMarketing',
      progress: 80,
      department: 'Marketing',
      sourceBoardId: '1000000003',
      sourceBoardName: 'Marketing Board',
      riskLevel: 'Low Risk',
      status: 'Healthy',
    },
  ]);

  assert.ok(csv.startsWith('Application,Vendor,Department'));
  assert.ok(csv.includes('"Canva, Pro"'));
  assert.ok(csv.includes('"Canva ""Inc"""'));
  assert.ok(csv.includes('"Design\nMarketing"'));
  assert.ok(csv.includes('1299.50'));
});

test('buildReportFileName uses date stamp', () => {
  const fileName = buildReportFileName(new Date('2026-03-09T15:04:05.000Z'));
  assert.equal(fileName, 'auditadmin-report-2026-03-09.csv');
});
