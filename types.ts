
export enum View {
  DASHBOARD = 'DASHBOARD',
  INVENTORY = 'INVENTORY',
  ANALYTICS = 'ANALYTICS',
  EXPORT = 'EXPORT',
  LICENSE_DETAIL = 'LICENSE_DETAIL',
}

export interface LicenseCoOwner {
  name: string;
  email: string;
}

export interface License {
  id: string;
  application: string;
  vendor: string;
  amount: number;
  length: string;
  renewalMethod: 'Manual' | 'ACH' | 'Credit Card' | string;
  renewalDate: string;
  seats: string;
  useCase: string;
  progress: number;
  department: string;
  sourceBoardId?: string;
  sourceBoardName?: string;
  recordBoardId?: string;
  recordBoardName?: string;
  recordKind?: 'item' | 'subitem';
  parentItemId?: string;
  coOwners?: LicenseCoOwner[];
  riskLevel: 'Low Risk' | 'Medium Risk' | 'High Risk';
  status: 'Healthy' | 'Over-provisioned' | 'Warning';
}

export type BillingCadence = 'Annual' | 'Quarterly' | 'Monthly' | 'Multi-Year' | 'Other' | 'Unknown';

export type InventoryQuickFilter = 'ALL' | 'UPCOMING_30' | 'OVERDUE' | 'AUTO_METHODS' | 'MANUAL';
export type InventoryRenewalWindowFilter = 'ALL' | 'OVERDUE' | 'UPCOMING_30' | 'UPCOMING_90' | 'FUTURE_90_PLUS' | 'NO_DATE';
export type InventoryPaymentFilter = 'ALL' | 'AUTO_ANY' | 'ACH' | 'CREDIT_CARD' | 'MANUAL' | 'OTHER';
export type InventoryBillingCadenceFilter = 'ALL' | 'ANNUAL' | 'QUARTERLY' | 'MONTHLY' | 'MULTI_YEAR' | 'OTHER' | 'UNKNOWN';

export interface InventoryFilterPreset {
  search?: string;
  quickFilter?: InventoryQuickFilter;
  department?: string;
  sourceBoardName?: string;
  risk?: 'ALL' | License['riskLevel'];
  status?: 'ALL' | License['status'];
  payment?: InventoryPaymentFilter;
  renewalWindow?: InventoryRenewalWindowFilter;
  billingCadence?: InventoryBillingCadenceFilter;
  contextLabel?: string;
  origin?: 'TOP_NAV_SEARCH';
}

export type UserRole = 'admin' | 'manager';

export interface DepartmentGrant {
  email: string;
  role: UserRole;
  departments: string[] | 'ALL';
}

export interface DepartmentSpend {
  name: string;
  fullName?: string;
  spend: number;
  monthlySpend: number;
  annualSpend: number;
  utilization: number;
  color?: string;
}
