import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  IconCurrencyDollar,
  IconCalendar,
  IconAlertTriangle,
  IconExternalLink,
} from '@tabler/icons-react';
import { InventoryFilterPreset, License } from '../types';
import {
  formatCurrency,
  formatCurrencyCompact,
  getAnnualCost,
  getDaysUntilRenewal,
  getDepartmentTheme,
  getLicenseBillingCadence,
  getMonthlyCost,
  getPendingRenewalsCount,
  getTotalAnnualCost,
  getTotalMonthlyCost,
} from '../utils/licenseMetrics';

interface AnalyticsProps {
  licenses: License[];
  onSelectLicense?: (license: License) => void;
  onNavigateInventory?: (preset: InventoryFilterPreset) => void;
  metricsDepartmentOverride?: string | null;
  metricsDepartmentOverrideKey?: number;
  allowedDepartments?: string[];
}

type Tab = 'overview' | 'departments' | 'quality';

type RunwayBucketId = 'OVERDUE' | 'DUE_30' | 'DUE_31_90' | 'DUE_91_180' | 'DUE_181_PLUS' | 'NO_DATE';

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] as const },
};

function isBlank(value: string | undefined | null): boolean {
  return !value || !String(value).trim();
}

function normalizePaymentBucket(method: string): 'ACH' | 'CREDIT_CARD' | 'MANUAL' | 'UNKNOWN' {
  const normalized = String(method || '').trim().toLowerCase();
  if (normalized === 'ach') return 'ACH';
  if (normalized === 'credit card') return 'CREDIT_CARD';
  if (normalized === 'manual') return 'MANUAL';
  return 'UNKNOWN';
}

interface KPICardProps {
  label: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  tone?: 'default' | 'warning';
  onClick?: () => void;
}

const KPICard: React.FC<KPICardProps> = ({ label, value, subtitle, icon, tone, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={!onClick}
    className="text-left rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:border-muted-foreground/40 disabled:cursor-default"
  >
    <div className="flex items-center justify-between mb-1.5">
      <span className="text-[11px] text-muted-foreground font-medium">{label}</span>
      <div
        className={`size-5 [&_svg]:w-4 [&_svg]:h-4 ${
          tone === 'warning' ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'
        }`}
      >
        {icon}
      </div>
    </div>
    <div className="text-2xl font-semibold text-foreground tabular-nums tracking-tight">{value}</div>
    <div className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</div>
  </button>
);

const Analytics: React.FC<AnalyticsProps> = ({
  licenses,
  onSelectLicense: _onSelectLicense,
  onNavigateInventory,
  metricsDepartmentOverride,
  metricsDepartmentOverrideKey: _metricsDepartmentOverrideKey,
  allowedDepartments: _allowedDepartments,
}) => {
  const [tab, setTab] = useState<Tab>('overview');

  // KPIs
  const totalMonthly = useMemo(() => getTotalMonthlyCost(licenses), [licenses]);
  const totalAnnual = useMemo(() => getTotalAnnualCost(licenses), [licenses]);
  const pending30 = useMemo(() => getPendingRenewalsCount(licenses, 30), [licenses]);
  const pending90 = useMemo(() => getPendingRenewalsCount(licenses, 90), [licenses]);

  // Renewal runway
  const runway = useMemo(() => {
    const buckets: Record<
      RunwayBucketId,
      { id: RunwayBucketId; label: string; count: number; spend: number; preset?: InventoryFilterPreset; tone: string }
    > = {
      OVERDUE: {
        id: 'OVERDUE',
        label: 'Overdue',
        count: 0,
        spend: 0,
        tone: 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400',
        preset: { renewalWindow: 'OVERDUE', contextLabel: 'Analytics: overdue' },
      },
      DUE_30: {
        id: 'DUE_30',
        label: '0–30 days',
        count: 0,
        spend: 0,
        tone: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
        preset: { renewalWindow: 'UPCOMING_30', contextLabel: 'Analytics: 30 days' },
      },
      DUE_31_90: {
        id: 'DUE_31_90',
        label: '31–90 days',
        count: 0,
        spend: 0,
        tone: 'border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400',
        preset: { renewalWindow: 'UPCOMING_90', contextLabel: 'Analytics: 90 days' },
      },
      DUE_91_180: {
        id: 'DUE_91_180',
        label: '91–180 days',
        count: 0,
        spend: 0,
        tone: 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400',
      },
      DUE_181_PLUS: {
        id: 'DUE_181_PLUS',
        label: '180+ days',
        count: 0,
        spend: 0,
        tone: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      },
      NO_DATE: {
        id: 'NO_DATE',
        label: 'No date',
        count: 0,
        spend: 0,
        tone: 'border-border bg-secondary/40 text-muted-foreground',
        preset: { renewalWindow: 'NO_DATE', contextLabel: 'Analytics: no renewal date' },
      },
    };

    for (const license of licenses) {
      const amount = Number.isFinite(license.amount) ? license.amount : 0;
      const days = getDaysUntilRenewal(license);
      let key: RunwayBucketId;
      if (days == null) key = 'NO_DATE';
      else if (days < 0) key = 'OVERDUE';
      else if (days <= 30) key = 'DUE_30';
      else if (days <= 90) key = 'DUE_31_90';
      else if (days <= 180) key = 'DUE_91_180';
      else key = 'DUE_181_PLUS';

      buckets[key].count += 1;
      buckets[key].spend += amount;
    }

    return Object.values(buckets);
  }, [licenses]);

  // Dept rows
  const departmentRows = useMemo(() => {
    const grouped = new Map<
      string,
      { total: number; monthly: number; annual: number; count: number; pending30: number; overdue: number; noDate: number; boards: Set<string> }
    >();

    for (const license of licenses) {
      const department = license.department || 'Unassigned';
      const days = getDaysUntilRenewal(license);
      const cur = grouped.get(department) || {
        total: 0,
        monthly: 0,
        annual: 0,
        count: 0,
        pending30: 0,
        overdue: 0,
        noDate: 0,
        boards: new Set<string>(),
      };
      cur.total += Number.isFinite(license.amount) ? license.amount : 0;
      cur.monthly += getMonthlyCost(license);
      cur.annual += getAnnualCost(license);
      cur.count += 1;
      if (license.sourceBoardName) cur.boards.add(license.sourceBoardName);
      if (days == null) cur.noDate += 1;
      else if (days < 0) cur.overdue += 1;
      else if (days <= 30) cur.pending30 += 1;
      grouped.set(department, cur);
    }

    return Array.from(grouped.entries())
      .map(([department, s]) => ({
        department,
        color: getDepartmentTheme(department).fill,
        total: s.total,
        monthly: s.monthly,
        annual: s.annual,
        count: s.count,
        pending30: s.pending30,
        overdue: s.overdue,
        noDate: s.noDate,
        boards: s.boards.size,
      }))
      .sort((a, b) => b.annual - a.annual);
  }, [licenses]);

  const maxDeptAnnual = departmentRows[0]?.annual || 1;

  // Data quality
  const qualityChecks = useMemo(() => {
    const checks = [
      { id: 'MISSING_AMOUNT', label: 'Missing or $0 amount', count: 0, spend: 0, preset: undefined as InventoryFilterPreset | undefined },
      {
        id: 'MISSING_DATE',
        label: 'Missing renewal date',
        count: 0,
        spend: 0,
        preset: { renewalWindow: 'NO_DATE', contextLabel: 'Analytics: missing renewal date' } as InventoryFilterPreset,
      },
      {
        id: 'UNKNOWN_CADENCE',
        label: 'Unknown billing cadence',
        count: 0,
        spend: 0,
        preset: { billingCadence: 'UNKNOWN', contextLabel: 'Analytics: unknown cadence' } as InventoryFilterPreset,
      },
      {
        id: 'UNKNOWN_METHOD',
        label: 'Unknown renewal method',
        count: 0,
        spend: 0,
        preset: { payment: 'OTHER', contextLabel: 'Analytics: unknown payment' } as InventoryFilterPreset,
      },
      { id: 'MISSING_SEATS', label: 'Missing seat count', count: 0, spend: 0, preset: undefined as InventoryFilterPreset | undefined },
    ];
    const byId = new Map(checks.map((c) => [c.id, c]));

    for (const license of licenses) {
      const amount = Number.isFinite(license.amount) ? license.amount : 0;
      const cadence = getLicenseBillingCadence(license);
      const payment = normalizePaymentBucket(license.renewalMethod);
      const days = getDaysUntilRenewal(license);

      if (!(license.amount > 0)) {
        const c = byId.get('MISSING_AMOUNT');
        if (c) { c.count += 1; c.spend += amount; }
      }
      if (days == null) {
        const c = byId.get('MISSING_DATE');
        if (c) { c.count += 1; c.spend += amount; }
      }
      if (cadence === 'Unknown') {
        const c = byId.get('UNKNOWN_CADENCE');
        if (c) { c.count += 1; c.spend += amount; }
      }
      if (payment === 'UNKNOWN') {
        const c = byId.get('UNKNOWN_METHOD');
        if (c) { c.count += 1; c.spend += amount; }
      }
      if (isBlank(license.seats)) {
        const c = byId.get('MISSING_SEATS');
        if (c) { c.count += 1; c.spend += amount; }
      }
    }

    return checks.filter((c) => c.count > 0);
  }, [licenses]);

  // Apply incoming dashboard "open with department X" by switching the tab.
  React.useEffect(() => {
    if (metricsDepartmentOverride) setTab('departments');
  }, [metricsDepartmentOverride]);

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'departments', label: 'Departments' },
    { id: 'quality', label: 'Data quality' },
  ];

  return (
    <div className="p-6 space-y-5 max-w-[1280px] mx-auto">
      {/* Header */}
      <motion.div {...fadeUp}>
        <h2 className="font-display text-2xl text-foreground">Analytics</h2>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          Spend, renewal pipeline, and data quality.
        </p>
      </motion.div>

      {/* KPIs */}
      <motion.div {...fadeUp} className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <KPICard
          label="Monthly spend"
          value={formatCurrencyCompact(totalMonthly)}
          subtitle="Normalized monthly"
          icon={<IconCurrencyDollar />}
          onClick={() => onNavigateInventory?.({ contextLabel: 'Analytics: all licenses' })}
        />
        <KPICard
          label="Annual spend"
          value={formatCurrencyCompact(totalAnnual)}
          subtitle="Normalized annual"
          icon={<IconCalendar />}
          onClick={() => onNavigateInventory?.({ contextLabel: 'Analytics: all licenses' })}
        />
        <KPICard
          label="Renewing in 30 days"
          value={String(pending30)}
          subtitle={pending30 > 0 ? 'Click to review' : 'Nothing due'}
          icon={<IconAlertTriangle />}
          tone={pending30 > 0 ? 'warning' : 'default'}
          onClick={() =>
            onNavigateInventory?.({
              renewalWindow: 'UPCOMING_30',
              contextLabel: 'Analytics: 30-day',
            })
          }
        />
        <KPICard
          label="Renewing in 90 days"
          value={String(pending90)}
          subtitle="Includes 30-day"
          icon={<IconCalendar />}
          onClick={() =>
            onNavigateInventory?.({
              renewalWindow: 'UPCOMING_90',
              contextLabel: 'Analytics: 90-day',
            })
          }
        />
      </motion.div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-5">
          {/* Renewal runway */}
          <motion.div {...fadeUp}>
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Renewal runway</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Counts and spend in each timing window
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                {runway.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    disabled={!b.preset}
                    onClick={() => b.preset && onNavigateInventory?.(b.preset)}
                    className={`rounded-md border p-3 text-left transition-all ${b.tone} ${
                      b.preset ? 'hover:opacity-90' : 'cursor-default'
                    }`}
                  >
                    <p className="text-[10px] uppercase tracking-wider font-medium opacity-80">
                      {b.label}
                    </p>
                    <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{b.count}</p>
                    <p className="text-[11px] tabular-nums opacity-80">
                      {formatCurrencyCompact(b.spend)}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Dept spend bars */}
          <motion.div {...fadeUp}>
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground">Spend by department</h3>
                <button
                  type="button"
                  onClick={() => setTab('departments')}
                  className="text-[11px] text-accent font-medium hover:underline"
                >
                  View table
                </button>
              </div>
              <div className="space-y-2.5">
                {departmentRows.slice(0, 8).map((row) => {
                  const width = maxDeptAnnual > 0 ? Math.max(4, (row.annual / maxDeptAnnual) * 100) : 4;
                  return (
                    <button
                      key={row.department}
                      type="button"
                      onClick={() =>
                        onNavigateInventory?.({
                          department: row.department,
                          contextLabel: `Analytics: ${row.department}`,
                        })
                      }
                      className="w-full group text-left"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[12px] text-foreground font-medium">{row.department}</span>
                        <span className="text-[12px] text-muted-foreground tabular-nums">
                          {formatCurrencyCompact(row.annual)}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-accent/60 group-hover:bg-accent transition-colors"
                          initial={{ width: 0 }}
                          animate={{ width: `${width}%` }}
                          transition={{ duration: 0.5 }}
                        />
                      </div>
                    </button>
                  );
                })}
                {departmentRows.length === 0 && (
                  <p className="text-[12px] text-muted-foreground italic">No department data yet.</p>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {tab === 'departments' && (
        <motion.div {...fadeUp}>
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="px-5 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Department breakdown</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Click a row to open that department in Inventory.
              </p>
            </div>
            {departmentRows.length === 0 ? (
              <p className="text-[12px] text-muted-foreground italic px-5 py-8 text-center">
                No department data yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      {['Department', 'Apps', 'Boards', 'Monthly', 'Annual', '30d', 'Overdue', 'No date'].map((h) => (
                        <th
                          key={h}
                          className="px-5 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {departmentRows.map((row) => (
                      <tr
                        key={row.department}
                        onClick={() =>
                          onNavigateInventory?.({
                            department: row.department,
                            contextLabel: `Analytics: ${row.department}`,
                          })
                        }
                        className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors cursor-pointer"
                      >
                        <td className="px-5 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="size-1.5 rounded-full" style={{ backgroundColor: row.color }} />
                            <span className="text-[12px] font-medium text-foreground">{row.department}</span>
                          </div>
                        </td>
                        <td className="px-5 py-2.5 text-[12px] text-muted-foreground tabular-nums">{row.count}</td>
                        <td className="px-5 py-2.5 text-[12px] text-muted-foreground tabular-nums">{row.boards}</td>
                        <td className="px-5 py-2.5 text-[12px] text-foreground tabular-nums">
                          {formatCurrency(row.monthly)}
                        </td>
                        <td className="px-5 py-2.5 text-[12px] font-medium text-foreground tabular-nums">
                          {formatCurrency(row.annual)}
                        </td>
                        <td className="px-5 py-2.5 text-[12px] tabular-nums">
                          {row.pending30 > 0 ? (
                            <span className="text-amber-600 dark:text-amber-400 font-medium">{row.pending30}</span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                        <td className="px-5 py-2.5 text-[12px] tabular-nums">
                          {row.overdue > 0 ? (
                            <span className="text-destructive font-medium">{row.overdue}</span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                        <td className="px-5 py-2.5 text-[12px] text-muted-foreground tabular-nums">
                          {row.noDate}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {tab === 'quality' && (
        <motion.div {...fadeUp}>
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="px-5 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Data quality</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Records that block accurate reporting or alerts.
              </p>
            </div>
            {qualityChecks.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-[13px] text-foreground">All records pass the data quality checks.</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Nothing missing amount, date, cadence, payment method, or seat count.
                </p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    {['Issue', 'Records', 'Spend impact', ''].map((h, i) => (
                      <th
                        key={i}
                        className="px-5 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {qualityChecks.map((check) => (
                    <tr key={check.id} className="border-b border-border last:border-0">
                      <td className="px-5 py-2.5 text-[12px] font-medium text-foreground">{check.label}</td>
                      <td className="px-5 py-2.5 text-[12px] text-foreground tabular-nums">{check.count}</td>
                      <td className="px-5 py-2.5 text-[12px] text-muted-foreground tabular-nums">
                        {formatCurrency(check.spend)}
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        {check.preset ? (
                          <button
                            type="button"
                            onClick={() => onNavigateInventory?.(check.preset!)}
                            className="inline-flex items-center gap-1 text-[11px] text-accent font-medium hover:underline"
                          >
                            Open in inventory
                            <IconExternalLink className="w-3 h-3" />
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default Analytics;
