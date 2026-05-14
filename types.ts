
export enum View {
  DASHBOARD = 'DASHBOARD',
  INVENTORY = 'INVENTORY',
  ANALYTICS = 'ANALYTICS',
  EXPORT = 'EXPORT',
  LICENSE_DETAIL = 'LICENSE_DETAIL',
  SETTINGS = 'SETTINGS',
}

export interface EmailLogEntry {
  id: string;
  timestamp: string;
  type: 'test' | 'reminder';
  to: string;
  subject: string;
  sender: string;
  status: string;
  messageId: string | null;
  errorMessage: string | null;
  requestedBy: string | null;
  licenseId: string | null;
  daysUntilRenewal: number | null;
}

export interface EmailLogSummary {
  totalSends: number;
  successCount: number;
  failureCount: number;
  byType: { test: number; reminder: number };
  lastSendAt: string | null;
  lastFailureAt: string | null;
}

export interface DomainVerificationCheck {
  record: 'Domain' | 'SPF' | 'DKIM' | 'DKIM2' | 'DMARC' | string;
  status: 'Verified' | 'VerificationFailed' | 'VerificationRequested' | 'Unknown' | string;
  errorCode: string | null;
  recordType: string | null;
  recordName: string | null;
  recordValue: string | null;
  ttl: number | null;
}

export interface ReminderRunSummary {
  startedAt: string;
  endedAt: string | null;
  reason: string;
  scanned: number;
  matched: number;
  attempted: number;
  sent: number;
  skipped: number;
  failed: number;
  failures: Array<{
    licenseId: string;
    to: string;
    daysUntilRenewal: number;
    message: string;
  }>;
}

export interface ReminderState {
  lastRunAt: string | null;
  lastRunResult: ReminderRunSummary | null;
}

export interface HygieneBucket {
  key: string;
  label: string;
  severity: 'good' | 'warn' | 'bad' | 'neutral' | string;
  count: number;
  sampleIds: string[];
}

export interface HygieneAttentionRow {
  id: string;
  application: string;
  department: string;
  renewalDate: string;
  dateBucket: string;
  dateBucketLabel: string;
  hasCoOwner: boolean;
  coOwnerCount: number;
  amount: number;
  missing: 'date' | 'co-owner' | 'date+co-owner';
}

export interface HygieneReport {
  total: number;
  readyToFire: number;
  withCoOwners: number;
  withRealDate: number;
  buckets: HygieneBucket[];
  needsAttention: HygieneAttentionRow[];
  generatedAt: string;
}

export interface DomainVerificationStatus {
  overall: 'Verified' | 'Pending' | 'Failed' | 'Unknown' | string;
  domainName: string;
  fromSenderDomain: string | null;
  mailFromSenderDomain: string | null;
  senderAddress: string;
  dataLocation: string | null;
  userEngagementTracking: string | null;
  checks: DomainVerificationCheck[];
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
