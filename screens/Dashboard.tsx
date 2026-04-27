import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  IconCurrencyDollar,
  IconCalendar,
  IconAlertTriangle,
} from '@tabler/icons-react';
import { InventoryFilterPreset, License } from '../types';
import {
  formatCurrency,
  formatCurrencyCompact,
  getDaysUntilRenewal,
  getDepartmentSpendData,
  getLicenseBillingCadence,
  getPendingRenewalsCount,
  getTotalAnnualCost,
  getTotalMonthlyCost,
} from '../utils/licenseMetrics';

interface DashboardProps {
  licenses: License[];
  allLicenses?: License[];
  onNavigateInventory?: (preset: InventoryFilterPreset) => void;
  onSelectLicense?: (license: License) => void;
  onOpenDepartmentAnalytics?: (departmentName: string) => void;
}

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay, ease: [0.25, 0.46, 0.45, 0.94] as const },
});

interface StatCardProps {
  label: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, subtitle, icon, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={!onClick}
    className="text-left rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:border-muted-foreground/40 disabled:cursor-default"
  >
    <div className="flex items-center justify-between mb-1.5">
      <span className="text-[11px] text-muted-foreground font-medium">{label}</span>
      <div className="size-5 text-muted-foreground [&_svg]:w-4 [&_svg]:h-4">{icon}</div>
    </div>
    <div className="text-2xl font-semibold text-foreground tabular-nums tracking-tight">{value}</div>
    <div className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</div>
  </button>
);

const Dashboard: React.FC<DashboardProps> = ({
  licenses,
  allLicenses,
  onNavigateInventory,
  onSelectLicense,
  onOpenDepartmentAnalytics,
}) => {
  const totalMonthly = useMemo(() => getTotalMonthlyCost(licenses), [licenses]);
  const totalAnnual = useMemo(() => getTotalAnnualCost(licenses), [licenses]);
  const pending30 = useMemo(() => getPendingRenewalsCount(licenses, 30), [licenses]);
  const departmentData = useMemo(
    () => getDepartmentSpendData(allLicenses || licenses),
    [allLicenses, licenses],
  );
  const renewingSoon = useMemo(
    () =>
      [...licenses]
        .filter((l) => {
          const d = getDaysUntilRenewal(l);
          return d != null && d <= 90;
        })
        .sort((a, b) => {
          const da = getDaysUntilRenewal(a) ?? 9999;
          const db = getDaysUntilRenewal(b) ?? 9999;
          return da - db;
        })
        .slice(0, 8),
    [licenses],
  );

  const overdueCount = useMemo(
    () => licenses.filter((l) => {
      const d = getDaysUntilRenewal(l);
      return d != null && d < 0;
    }).length,
    [licenses],
  );
  const noDateCount = useMemo(
    () => licenses.filter((l) => getDaysUntilRenewal(l) == null).length,
    [licenses],
  );

  const maxDeptSpend = departmentData[0]?.annualSpend || 1;

  return (
    <div className="p-6 space-y-5 max-w-[1280px] mx-auto">
      {/* Greeting */}
      <motion.div {...fadeUp(0)}>
        <h2 className="font-display text-2xl text-foreground">Welcome back</h2>
        <p className="text-[13px] text-muted-foreground mt-0.5 tabular-nums">
          {licenses.length} licenses across {departmentData.length} departments
        </p>
      </motion.div>

      {/* Attention strip — only renders if there's something actionable */}
      {(overdueCount > 0 || pending30 > 0 || noDateCount > 0) && (
        <motion.div
          {...fadeUp(0.05)}
          className="flex items-center gap-2 flex-wrap rounded-md border border-border bg-secondary/40 px-3 py-2"
        >
          <IconAlertTriangle className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-[12px] text-muted-foreground">Needs attention:</span>
          {overdueCount > 0 && (
            <button
              type="button"
              onClick={() =>
                onNavigateInventory?.({
                  renewalWindow: 'OVERDUE',
                  contextLabel: 'Dashboard: overdue renewals',
                })
              }
              className="inline-flex items-center gap-1 rounded-full bg-destructive/10 text-destructive px-2 py-0.5 text-[11px] font-medium hover:bg-destructive/15 transition-colors"
            >
              <span className="tabular-nums">{overdueCount}</span> overdue
            </button>
          )}
          {pending30 > 0 && (
            <button
              type="button"
              onClick={() =>
                onNavigateInventory?.({
                  quickFilter: 'UPCOMING_30',
                  renewalWindow: 'UPCOMING_30',
                  contextLabel: 'Dashboard: renewals due in 30 days',
                })
              }
              className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 text-[11px] font-medium hover:bg-amber-500/15 transition-colors"
            >
              <span className="tabular-nums">{pending30}</span> due in 30 days
            </button>
          )}
          {noDateCount > 0 && (
            <button
              type="button"
              onClick={() =>
                onNavigateInventory?.({
                  renewalWindow: 'NO_DATE',
                  contextLabel: 'Dashboard: missing renewal date',
                })
              }
              className="inline-flex items-center gap-1 rounded-full bg-secondary text-muted-foreground px-2 py-0.5 text-[11px] font-medium hover:text-foreground transition-colors"
            >
              <span className="tabular-nums">{noDateCount}</span> missing date
            </button>
          )}
        </motion.div>
      )}

      {/* Stats — 3 numbers, not 4 */}
      <motion.div {...fadeUp(0.1)} className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard
          label="Monthly spend"
          value={formatCurrencyCompact(totalMonthly)}
          subtitle="Normalized monthly equivalent"
          icon={<IconCurrencyDollar />}
          onClick={() => onNavigateInventory?.({ contextLabel: 'Dashboard: all licenses' })}
        />
        <StatCard
          label="Annual spend"
          value={formatCurrencyCompact(totalAnnual)}
          subtitle="Normalized annual equivalent"
          icon={<IconCalendar />}
          onClick={() => onNavigateInventory?.({ contextLabel: 'Dashboard: all licenses' })}
        />
        <StatCard
          label="Renewing in 30 days"
          value={String(pending30)}
          subtitle={pending30 > 0 ? 'Click to review' : 'Nothing due'}
          icon={<IconAlertTriangle />}
          onClick={() =>
            onNavigateInventory?.({
              quickFilter: 'UPCOMING_30',
              renewalWindow: 'UPCOMING_30',
              contextLabel: 'Dashboard: renewals due in 30 days',
            })
          }
        />
      </motion.div>

      {/* Spend by department */}
      <motion.div {...fadeUp(0.15)}>
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">Spend by department</h3>
            <button
              type="button"
              onClick={() => onOpenDepartmentAnalytics?.('ALL')}
              className="text-[11px] text-accent font-medium hover:underline"
            >
              View all
            </button>
          </div>
          {departmentData.length === 0 ? (
            <p className="text-[12px] text-muted-foreground italic py-3">No department spend data yet.</p>
          ) : (
            <div className="space-y-2.5">
              {departmentData.slice(0, 6).map((dept) => {
                const width =
                  maxDeptSpend > 0 ? Math.max(4, (dept.annualSpend / maxDeptSpend) * 100) : 4;
                return (
                  <button
                    key={dept.fullName}
                    type="button"
                    onClick={() => onOpenDepartmentAnalytics?.(dept.fullName || dept.name)}
                    className="w-full group text-left"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[12px] text-foreground font-medium">
                        {dept.fullName || dept.name}
                      </span>
                      <span className="text-[12px] text-muted-foreground tabular-nums">
                        {formatCurrencyCompact(dept.annualSpend)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-accent/60 group-hover:bg-accent transition-colors"
                        initial={{ width: 0 }}
                        animate={{ width: `${width}%` }}
                        transition={{ duration: 0.6, delay: 0.15 }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>

      {/* Renewing soon */}
      <motion.div {...fadeUp(0.2)}>
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Renewing soon</h3>
            <button
              type="button"
              onClick={() =>
                onNavigateInventory?.({
                  renewalWindow: 'UPCOMING_90',
                  contextLabel: 'Dashboard: renewals in 90 days',
                })
              }
              className="text-[11px] text-accent font-medium hover:underline"
            >
              View all
            </button>
          </div>
          {renewingSoon.length === 0 ? (
            <p className="text-[12px] text-muted-foreground italic px-5 py-8 text-center">
              Nothing renewing in the next 90 days.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    {['Application', 'Department', 'Amount', 'Billing', 'Renewal', 'Status'].map((h) => (
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
                  {renewingSoon.map((license) => {
                    const days = getDaysUntilRenewal(license);
                    const urgent = days != null && days <= 30 && days >= 0;
                    const overdue = days != null && days < 0;
                    return (
                      <tr
                        key={license.id}
                        onClick={() => onSelectLicense?.(license)}
                        className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors cursor-pointer"
                      >
                        <td className="px-5 py-2.5">
                          <div className="text-[12px] font-medium text-foreground">{license.application}</div>
                        </td>
                        <td className="px-5 py-2.5 text-[12px] text-muted-foreground">{license.department}</td>
                        <td className="px-5 py-2.5 text-[12px] font-medium text-foreground tabular-nums">
                          {formatCurrency(license.amount)}
                        </td>
                        <td className="px-5 py-2.5 text-[12px] text-muted-foreground">
                          {getLicenseBillingCadence(license)}
                        </td>
                        <td className="px-5 py-2.5 text-[12px] text-muted-foreground">
                          {license.renewalDate || 'No date'}
                        </td>
                        <td className="px-5 py-2.5">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              overdue
                                ? 'bg-destructive/10 text-destructive'
                                : urgent
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {overdue ? 'Overdue' : urgent ? 'Due soon' : 'On track'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default Dashboard;
