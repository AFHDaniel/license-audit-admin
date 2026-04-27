import { License } from '../types';
import { getDaysUntilRenewal } from './licenseMetrics';
import { InventoryRenewalWindowFilter } from '../types';

export type ExportPaymentFilter = 'ALL' | 'ACH' | 'CREDIT_CARD' | 'MANUAL' | 'OTHER';

export interface ExportFilterState {
  search: string;
  selectedDepartments: string[];
  payment: ExportPaymentFilter;
  risk: 'ALL' | License['riskLevel'];
  status: 'ALL' | License['status'];
  renewalWindow: InventoryRenewalWindowFilter;
}

function normalizeMethod(method: string): string {
  return String(method || '').trim().toLowerCase();
}

function matchesPayment(method: string, payment: ExportPaymentFilter): boolean {
  if (payment === 'ALL') return true;

  const normalized = normalizeMethod(method);
  if (payment === 'ACH') return normalized === 'ach';
  if (payment === 'CREDIT_CARD') return normalized === 'credit card';
  if (payment === 'MANUAL') return normalized === 'manual';

  return normalized !== 'ach' && normalized !== 'credit card' && normalized !== 'manual';
}

export function filterLicensesForExport(
  licenses: License[],
  filters: ExportFilterState,
): License[] {
  const query = filters.search.trim().toLowerCase();

  return licenses.filter((license) => {
    if (query) {
      const haystack = [
        license.application,
        license.vendor,
        license.department,
        license.sourceBoardName || '',
        license.renewalMethod || '',
        license.useCase || '',
        license.id,
      ]
        .join(' ')
        .toLowerCase();

      if (!haystack.includes(query)) return false;
    }

    if (!filters.selectedDepartments.includes(license.department)) {
      return false;
    }

    if (!matchesPayment(license.renewalMethod, filters.payment)) {
      return false;
    }

    if (filters.risk !== 'ALL' && license.riskLevel !== filters.risk) {
      return false;
    }

    if (filters.status !== 'ALL' && license.status !== filters.status) {
      return false;
    }

    const daysUntilRenewal = getDaysUntilRenewal(license);
    if (filters.renewalWindow !== 'ALL') {
      if (filters.renewalWindow === 'NO_DATE' && daysUntilRenewal !== null) return false;
      if (filters.renewalWindow === 'OVERDUE' && !(daysUntilRenewal != null && daysUntilRenewal < 0)) return false;
      if (filters.renewalWindow === 'UPCOMING_30' && !(daysUntilRenewal != null && daysUntilRenewal >= 0 && daysUntilRenewal <= 30)) return false;
      if (filters.renewalWindow === 'UPCOMING_90' && !(daysUntilRenewal != null && daysUntilRenewal >= 0 && daysUntilRenewal <= 90)) return false;
      if (filters.renewalWindow === 'FUTURE_90_PLUS' && !(daysUntilRenewal != null && daysUntilRenewal > 90)) return false;
    }

    return true;
  });
}
