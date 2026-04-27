import { License } from '../types';

const REPORT_HEADERS = [
  'Application',
  'Vendor',
  'Department',
  'Source Board',
  'Source Board ID',
  'Amount',
  'Length',
  'Renewal Method',
  'Renewal Date',
  'Seats',
  'Use Case',
  'Risk Level',
  'Status',
  'Record ID',
];

function csvEscape(value: unknown): string {
  const stringValue = String(value ?? '');
  if (/["\n,]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

export function buildLicenseReportCsv(licenses: License[]): string {
  const rows = licenses.map((license) => [
    license.application,
    license.vendor,
    license.department,
    license.sourceBoardName || '',
    license.sourceBoardId || '',
    Number.isFinite(license.amount) ? license.amount.toFixed(2) : '0.00',
    license.length || '',
    license.renewalMethod || '',
    license.renewalDate || '',
    license.seats || '',
    license.useCase || '',
    license.riskLevel,
    license.status,
    license.id,
  ]);

  return [REPORT_HEADERS, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
}

export function buildReportFileName(date: Date = new Date()): string {
  const dateStamp = date.toISOString().slice(0, 10);
  return `auditadmin-report-${dateStamp}.csv`;
}

export function downloadCsvReport(csvContent: string, fileName: string): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;

  const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);

  return true;
}
