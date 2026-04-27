import { BillingCadence, DepartmentSpend, License } from '../types';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const currencyCompactFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
});

const DEPARTMENT_COLOR_PALETTE = [
  '#1D4ED8',
  '#0F766E',
  '#DC2626',
  '#7C3AED',
  '#EA580C',
  '#0891B2',
  '#4F46E5',
  '#16A34A',
  '#C2410C',
  '#BE185D',
];

const DEPARTMENT_COLOR_OVERRIDES: Record<string, string> = {
  it: '#1D4ED8',
  accounting: '#0F766E',
  marketing: '#7C3AED',
  operations: '#EA580C',
  listings: '#DC2626',
  relocations: '#0891B2',
  admin: '#4F46E5',
  'property management': '#16A34A',
  hr: '#BE185D',
  finance: '#0F766E',
  sales: '#C2410C',
};

function safeDateFromString(value: string): Date | null {
  if (!value || value === 'TBD') {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

export function getDaysUntilRenewal(license: License): number | null {
  const date = safeDateFromString(license.renewalDate);
  if (!date) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);

  const diffMs = date.getTime() - today.getTime();
  return Math.round(diffMs / (24 * 60 * 60 * 1000));
}

function normalizeDepartmentKey(value: string): string {
  return String(value || '').trim().toLowerCase();
}

function colorFromString(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return DEPARTMENT_COLOR_PALETTE[Math.abs(hash) % DEPARTMENT_COLOR_PALETTE.length];
}

function hexToRgb(hex: string): [number, number, number] {
  const cleaned = hex.replace('#', '');
  const normalized = cleaned.length === 3
    ? cleaned.split('').map((c) => `${c}${c}`).join('')
    : cleaned;
  const num = Number.parseInt(normalized, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export function getDepartmentColor(department: string): string {
  const key = normalizeDepartmentKey(department);
  if (!key) return '#6B7280';
  return DEPARTMENT_COLOR_OVERRIDES[key] || colorFromString(key);
}

export function getDepartmentTheme(department: string) {
  const fill = getDepartmentColor(department);
  const [r, g, b] = hexToRgb(fill);
  return {
    fill,
    text: fill,
    softBg: `rgba(${r}, ${g}, ${b}, 0.12)`,
    border: `rgba(${r}, ${g}, ${b}, 0.25)`,
    dot: `rgba(${r}, ${g}, ${b}, 0.9)`,
  };
}

export function getTotalSpend(licenses: License[]): number {
  return licenses.reduce((sum, license) => sum + (Number.isFinite(license.amount) ? license.amount : 0), 0);
}

export function getBillingCadenceFromLength(lengthValue: string): BillingCadence {
  const normalized = String(lengthValue || '').trim().toLowerCase();
  if (!normalized || normalized === 'unknown' || normalized === 'n/a') {
    return 'Unknown';
  }

  if (/(quarter|qtr|quarterly|3\s*months?|every\s*3\s*months?)/i.test(normalized)) {
    return 'Quarterly';
  }

  if (/(monthly|month|per month|\/mo|\bmo\b)/i.test(normalized)) {
    return 'Monthly';
  }

  if (/(3\s*year|multi[- ]?year|36\s*months?)/i.test(normalized)) {
    return 'Multi-Year';
  }
  if (/^(36|36\.0+)$/.test(normalized)) return 'Multi-Year';

  if (/(annual|annually|yearly|year|per year|\/yr|\byr\b|12\s*months?)/i.test(normalized)) {
    return 'Annual';
  }

  if (/^(12|12\.0+)$/.test(normalized)) return 'Annual';
  if (/^(3|3\.0+)$/.test(normalized)) return 'Quarterly';
  if (/^(1|1\.0+)$/.test(normalized)) return 'Monthly';

  if (/(one[- ]?time|lifetime|adhoc|ad hoc|as needed|usage|consumption)/i.test(normalized)) {
    return 'Other';
  }

  return 'Other';
}

export function getLicenseBillingCadence(license: License): BillingCadence {
  return getBillingCadenceFromLength(license.length);
}

export function getMonthlyCost(license: License): number {
  const amount = Number.isFinite(license.amount) ? license.amount : 0;
  const cadence = getLicenseBillingCadence(license);

  if (cadence === 'Monthly') return amount;
  if (cadence === 'Quarterly') return amount / 3;
  if (cadence === 'Annual') return amount / 12;
  if (cadence === 'Multi-Year') return amount / 36;
  return amount / 12;
}

export function getAnnualCost(license: License): number {
  const amount = Number.isFinite(license.amount) ? license.amount : 0;
  const cadence = getLicenseBillingCadence(license);

  if (cadence === 'Monthly') return amount * 12;
  if (cadence === 'Quarterly') return amount * 4;
  if (cadence === 'Annual') return amount;
  if (cadence === 'Multi-Year') return amount / 3;
  return amount;
}

export function getTotalMonthlyCost(licenses: License[]): number {
  return licenses.reduce((sum, license) => sum + getMonthlyCost(license), 0);
}

export function getTotalAnnualCost(licenses: License[]): number {
  return licenses.reduce((sum, license) => sum + getAnnualCost(license), 0);
}

export function getSpendByCadence(licenses: License[]) {
  const buckets = {
    annual: { total: 0, count: 0 },
    quarterly: { total: 0, count: 0 },
    monthly: { total: 0, count: 0 },
    multiYear: { total: 0, count: 0 },
    other: { total: 0, count: 0 },
    unknown: { total: 0, count: 0 },
  };

  for (const license of licenses) {
    const amount = Number.isFinite(license.amount) ? license.amount : 0;
    const cadence = getLicenseBillingCadence(license);

    if (cadence === 'Annual') {
      buckets.annual.total += amount;
      buckets.annual.count += 1;
    } else if (cadence === 'Quarterly') {
      buckets.quarterly.total += amount;
      buckets.quarterly.count += 1;
    } else if (cadence === 'Monthly') {
      buckets.monthly.total += amount;
      buckets.monthly.count += 1;
    } else if (cadence === 'Multi-Year') {
      buckets.multiYear.total += amount;
      buckets.multiYear.count += 1;
    } else if (cadence === 'Unknown') {
      buckets.unknown.total += amount;
      buckets.unknown.count += 1;
    } else {
      buckets.other.total += amount;
      buckets.other.count += 1;
    }
  }

  return buckets;
}

export function isAutoRenewalMethod(method: string): boolean {
  const normalized = String(method || '').trim().toLowerCase();
  if (!normalized) return false;

  return normalized === 'ach' || normalized === 'credit card';
}

export function getPendingRenewalsCount(licenses: License[], withinDays = 30): number {
  return licenses.filter((license) => {
    const days = getDaysUntilRenewal(license);
    return days != null && days >= 0 && days <= withinDays;
  }).length;
}

function shortDepartmentLabel(name: string): string {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return 'N/A';

  const known: Record<string, string> = {
    engineering: 'ENG',
    marketing: 'MKT',
    sales: 'SALES',
    operations: 'OPS',
    hr: 'HR',
    finance: 'FIN',
    accounting: 'ACCT',
    listings: 'LIST',
    relocations: 'RELO',
    admin: 'ADMIN',
    'property management': 'PM',
    legal: 'LEGAL',
    it: 'IT',
  };

  if (known[normalized]) {
    return known[normalized];
  }

  return (
    name
      .split(/\s+/)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('')
      .slice(0, 5) || name.slice(0, 5).toUpperCase()
  );
}

export function getDepartmentSpendData(licenses: License[]): DepartmentSpend[] {
  const grouped = new Map<string, { spend: number; monthlySpend: number; annualSpend: number; progressTotal: number; count: number }>();

  for (const license of licenses) {
    const key = license.department || 'Unassigned';
    const current = grouped.get(key) || { spend: 0, monthlySpend: 0, annualSpend: 0, progressTotal: 0, count: 0 };
    current.spend += Number.isFinite(license.amount) ? license.amount : 0;
    current.monthlySpend += getMonthlyCost(license);
    current.annualSpend += getAnnualCost(license);
    current.progressTotal += Number.isFinite(license.progress) ? license.progress : 0;
    current.count += 1;
    grouped.set(key, current);
  }

  return Array.from(grouped.entries())
    .map(([name, stats]) => ({
      name: shortDepartmentLabel(name),
      fullName: name,
      spend: Math.round(stats.annualSpend),
      monthlySpend: Math.round(stats.monthlySpend),
      annualSpend: Math.round(stats.annualSpend),
      utilization: stats.count > 0 ? Math.round(stats.progressTotal / stats.count) : 0,
      color: getDepartmentColor(name),
    }))
    .sort((a, b) => b.annualSpend - a.annualSpend);
}

export function getRenewalMethodDistribution(licenses: License[]) {
  const total = licenses.length;
  const counts = {
    ach: 0,
    creditCard: 0,
    manual: 0,
    unknown: 0,
  };

  for (const license of licenses) {
    const normalized = String(license.renewalMethod || '').trim().toLowerCase();

    if (normalized === 'ach') {
      counts.ach += 1;
    } else if (normalized === 'credit card' || normalized === 'cc') {
      counts.creditCard += 1;
    } else if (normalized === 'manual') {
      counts.manual += 1;
    } else {
      counts.unknown += 1;
    }
  }

  const toPercent = (count: number) => (total > 0 ? Math.round((count / total) * 100) : 0);

  return [
    { name: 'ACH', value: counts.ach, percent: toPercent(counts.ach), color: '#1D4ED8' },
    { name: 'Credit Card', value: counts.creditCard, percent: toPercent(counts.creditCard), color: '#10B981' },
    { name: 'Manual', value: counts.manual, percent: toPercent(counts.manual), color: '#0B2440' },
    { name: 'Unknown', value: counts.unknown, percent: toPercent(counts.unknown), color: '#E5E7EB' },
  ].filter((slice) => slice.value > 0 || total === 0);
}

export function getPendingRenewalLicenses(licenses: License[], withinDays = 30, limit = 6): License[] {
  return [...licenses]
    .filter((license) => {
      const days = getDaysUntilRenewal(license);
      return days != null && days >= 0 && days <= withinDays;
    })
    .sort((a, b) => {
      const aDays = getDaysUntilRenewal(a) ?? Number.MAX_SAFE_INTEGER;
      const bDays = getDaysUntilRenewal(b) ?? Number.MAX_SAFE_INTEGER;
      if (aDays !== bDays) return aDays - bDays;
      return a.application.localeCompare(b.application);
    })
    .slice(0, limit);
}

export function getUncategorizedCount(licenses: License[]): number {
  return licenses.filter((license) => {
    const useCase = (license.useCase || '').trim().toLowerCase();
    return !useCase || useCase === 'general' || useCase === 'general office use';
  }).length;
}

export function formatCurrency(value: number): string {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0);
}

export function formatCurrencyCompact(value: number): string {
  return currencyCompactFormatter.format(Number.isFinite(value) ? value : 0);
}
