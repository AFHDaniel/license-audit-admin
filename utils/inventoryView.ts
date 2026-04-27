import {
  InventoryBillingCadenceFilter,
  InventoryPaymentFilter,
  InventoryQuickFilter,
  InventoryRenewalWindowFilter,
  License,
} from '../types';
import {
  getAnnualCost,
  getDaysUntilRenewal,
  getLicenseBillingCadence,
  getMonthlyCost,
  isAutoRenewalMethod,
} from './licenseMetrics';

export type InventorySortField =
  | 'RENEWAL_DATE'
  | 'APPLICATION'
  | 'AMOUNT'
  | 'MONTHLY'
  | 'ANNUAL';

export type InventorySortDirection = 'ASC' | 'DESC';

export interface InventoryViewState {
  search: string;
  quickFilter: InventoryQuickFilter;
  selectedDepartments: string[];
  selectedBoards: string[];
  selectedCoOwnerEmails: string[];
  selectedRisk: 'ALL' | License['riskLevel'];
  selectedStatus: 'ALL' | License['status'];
  selectedPayment: InventoryPaymentFilter;
  selectedRenewalWindow: InventoryRenewalWindowFilter;
  selectedBillingCadence: InventoryBillingCadenceFilter;
  sortField: InventorySortField;
  sortDirection: InventorySortDirection;
}

export const DEFAULT_INVENTORY_VIEW_STATE: InventoryViewState = {
  search: '',
  quickFilter: 'ALL',
  selectedDepartments: [],
  selectedBoards: [],
  selectedCoOwnerEmails: [],
  selectedRisk: 'ALL',
  selectedStatus: 'ALL',
  selectedPayment: 'ALL',
  selectedRenewalWindow: 'ALL',
  selectedBillingCadence: 'ALL',
  sortField: 'RENEWAL_DATE',
  sortDirection: 'ASC',
};

function normalize(value: string): string {
  return String(value || '').trim().toLowerCase();
}

function billingCadenceToFilterValue(license: License): InventoryBillingCadenceFilter {
  const cadence = getLicenseBillingCadence(license);
  if (cadence === 'Annual') return 'ANNUAL';
  if (cadence === 'Quarterly') return 'QUARTERLY';
  if (cadence === 'Monthly') return 'MONTHLY';
  if (cadence === 'Multi-Year') return 'MULTI_YEAR';
  if (cadence === 'Unknown') return 'UNKNOWN';
  return 'OTHER';
}

function compareValues<T extends string | number>(left: T, right: T, direction: InventorySortDirection): number {
  if (left < right) return direction === 'ASC' ? -1 : 1;
  if (left > right) return direction === 'ASC' ? 1 : -1;
  return 0;
}

export function filterAndSortLicenses(licenses: License[], state: InventoryViewState): License[] {
  const query = state.search.trim().toLowerCase();
  const selectedDepartmentKeys = new Set(state.selectedDepartments.map(normalize).filter(Boolean));
  const selectedBoardKeys = new Set(state.selectedBoards.map(normalize).filter(Boolean));
  const selectedCoOwnerKeys = new Set(state.selectedCoOwnerEmails.map(normalize).filter(Boolean));

  return licenses
    .filter((license) => {
      if (query) {
        const haystack = [
          license.application,
          license.vendor,
          license.id,
          license.useCase,
          license.department,
          license.sourceBoardName || '',
          license.renewalMethod,
          license.length,
          ...(license.coOwners || []).flatMap((coOwner) => [coOwner.name, coOwner.email]),
        ]
          .join(' ')
          .toLowerCase();

        if (!haystack.includes(query)) {
          return false;
        }
      }

      if (selectedDepartmentKeys.size > 0 && !selectedDepartmentKeys.has(normalize(license.department))) {
        return false;
      }

      if (selectedBoardKeys.size > 0 && !selectedBoardKeys.has(normalize(license.sourceBoardName || ''))) {
        return false;
      }

      if (selectedCoOwnerKeys.size > 0) {
        const licenseCoOwnerEmails = new Set((license.coOwners || []).map((coOwner) => normalize(coOwner.email)).filter(Boolean));
        const matchesCoOwner = Array.from(selectedCoOwnerKeys).some((email) => licenseCoOwnerEmails.has(email));
        if (!matchesCoOwner) {
          return false;
        }
      }

      if (state.selectedRisk !== 'ALL' && license.riskLevel !== state.selectedRisk) {
        return false;
      }

      if (state.selectedStatus !== 'ALL' && license.status !== state.selectedStatus) {
        return false;
      }

      const methodNormalized = normalize(license.renewalMethod);
      if (state.selectedPayment !== 'ALL') {
        if (state.selectedPayment === 'AUTO_ANY' && !isAutoRenewalMethod(license.renewalMethod)) return false;
        if (state.selectedPayment === 'ACH' && methodNormalized !== 'ach') return false;
        if (state.selectedPayment === 'CREDIT_CARD' && methodNormalized !== 'credit card') return false;
        if (state.selectedPayment === 'MANUAL' && methodNormalized !== 'manual') return false;
        if (state.selectedPayment === 'OTHER' && (isAutoRenewalMethod(license.renewalMethod) || methodNormalized === 'manual')) {
          return false;
        }
      }

      if (state.selectedBillingCadence !== 'ALL' && billingCadenceToFilterValue(license) !== state.selectedBillingCadence) {
        return false;
      }

      const days = getDaysUntilRenewal(license);
      if (state.quickFilter === 'UPCOMING_30' && !(days != null && days >= 0 && days <= 30)) return false;
      if (state.quickFilter === 'OVERDUE' && !(days != null && days < 0)) return false;
      if (state.quickFilter === 'AUTO_METHODS' && !isAutoRenewalMethod(license.renewalMethod)) return false;
      if (state.quickFilter === 'MANUAL' && methodNormalized !== 'manual') return false;

      if (state.selectedRenewalWindow !== 'ALL') {
        if (state.selectedRenewalWindow === 'NO_DATE' && days !== null) return false;
        if (state.selectedRenewalWindow === 'OVERDUE' && !(days != null && days < 0)) return false;
        if (state.selectedRenewalWindow === 'UPCOMING_30' && !(days != null && days >= 0 && days <= 30)) return false;
        if (state.selectedRenewalWindow === 'UPCOMING_90' && !(days != null && days >= 0 && days <= 90)) return false;
        if (state.selectedRenewalWindow === 'FUTURE_90_PLUS' && !(days != null && days > 90)) return false;
      }

      return true;
    })
    .sort((left, right) => {
      if (state.sortField === 'APPLICATION') {
        const byApplication = compareValues(left.application.toLowerCase(), right.application.toLowerCase(), state.sortDirection);
        return byApplication || compareValues(left.id, right.id, 'ASC');
      }

      if (state.sortField === 'AMOUNT') {
        const byAmount = compareValues(left.amount, right.amount, state.sortDirection);
        return byAmount || compareValues(left.application.toLowerCase(), right.application.toLowerCase(), 'ASC');
      }

      if (state.sortField === 'MONTHLY') {
        const byMonthly = compareValues(getMonthlyCost(left), getMonthlyCost(right), state.sortDirection);
        return byMonthly || compareValues(left.application.toLowerCase(), right.application.toLowerCase(), 'ASC');
      }

      if (state.sortField === 'ANNUAL') {
        const byAnnual = compareValues(getAnnualCost(left), getAnnualCost(right), state.sortDirection);
        return byAnnual || compareValues(left.application.toLowerCase(), right.application.toLowerCase(), 'ASC');
      }

      const leftDays = getDaysUntilRenewal(left);
      const rightDays = getDaysUntilRenewal(right);
      const leftScore = leftDays == null ? Number.MAX_SAFE_INTEGER : leftDays;
      const rightScore = rightDays == null ? Number.MAX_SAFE_INTEGER : rightDays;
      const byRenewal = compareValues(leftScore, rightScore, state.sortDirection);
      return byRenewal || compareValues(left.application.toLowerCase(), right.application.toLowerCase(), 'ASC');
    });
}
