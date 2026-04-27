import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  IconDownload,
  IconChecks,
  IconSquareOff,
  IconFilterOff,
  IconAlertCircle,
} from '@tabler/icons-react';
import { InventoryRenewalWindowFilter, License } from '../types';
import { buildLicenseReportCsv, buildReportFileName, downloadCsvReport } from '../utils/exportReport';
import { ExportFilterState, ExportPaymentFilter, filterLicensesForExport } from '../utils/exportFilters';
import { formatCurrency } from '../utils/licenseMetrics';

interface ExportReportsProps {
  licenses: License[];
  allowedDepartments?: string[];
}

const BASE_FILTERS: Omit<ExportFilterState, 'selectedDepartments'> = {
  search: '',
  payment: 'ALL',
  risk: 'ALL',
  status: 'ALL',
  renewalWindow: 'ALL',
};

const ExportReports: React.FC<ExportReportsProps> = ({ licenses, allowedDepartments }) => {
  const [filters, setFilters] = useState<ExportFilterState>({
    ...BASE_FILTERS,
    selectedDepartments: [],
  });
  const initializedDepartmentsRef = useRef(false);

  const departmentOptions = useMemo(() => {
    const fromLicenses = Array.from(new Set(licenses.map((license) => license.department).filter(Boolean))).sort();
    return allowedDepartments ? fromLicenses.filter((d) => allowedDepartments.includes(d)) : fromLicenses;
  }, [licenses, allowedDepartments]);

  useEffect(() => {
    if (initializedDepartmentsRef.current) return;
    if (departmentOptions.length === 0) return;

    setFilters((current) => ({
      ...current,
      selectedDepartments: [...departmentOptions],
    }));
    initializedDepartmentsRef.current = true;
  }, [departmentOptions]);

  const filteredLicenses = useMemo(
    () => filterLicensesForExport(licenses, filters),
    [licenses, filters],
  );

  const totalFilteredSpend = useMemo(
    () => filteredLicenses.reduce((sum, license) => sum + (Number.isFinite(license.amount) ? license.amount : 0), 0),
    [filteredLicenses],
  );

  const previewRows = useMemo(() => filteredLicenses.slice(0, 12), [filteredLicenses]);

  const selectedDepartmentCount = filters.selectedDepartments.length;
  const hasSelectedDepartments = selectedDepartmentCount > 0;

  const boardsCoveredBySelection = useMemo(() => {
    if (!hasSelectedDepartments) return [];
    return Array.from(
      new Set(
        licenses
          .filter((license) => filters.selectedDepartments.includes(license.department))
          .map((license) => license.sourceBoardName)
          .filter(Boolean),
      ),
    ).sort();
  }, [hasSelectedDepartments, filters.selectedDepartments, licenses]);

  const hasActiveFilters = useMemo(() => {
    const hasDepartmentSubset = selectedDepartmentCount !== departmentOptions.length;

    return (
      filters.search.trim().length > 0 ||
      hasDepartmentSubset ||
      filters.payment !== 'ALL' ||
      filters.risk !== 'ALL' ||
      filters.status !== 'ALL' ||
      filters.renewalWindow !== 'ALL'
    );
  }, [filters, selectedDepartmentCount, departmentOptions.length]);

  const setFilter = <K extends keyof ExportFilterState>(key: K, value: ExportFilterState[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const toggleDepartment = (department: string) => {
    setFilters((current) => {
      const selected = new Set(current.selectedDepartments);
      if (selected.has(department)) selected.delete(department);
      else selected.add(department);

      return {
        ...current,
        selectedDepartments: departmentOptions.filter((option) => selected.has(option)),
      };
    });
  };

  const selectAllDepartments = () => {
    setFilters((current) => ({
      ...current,
      selectedDepartments: [...departmentOptions],
    }));
  };

  const unselectAllDepartments = () => {
    setFilters((current) => ({
      ...current,
      selectedDepartments: [],
    }));
  };

  const exportFilteredReport = () => {
    if (!hasSelectedDepartments) return;

    const csv = buildLicenseReportCsv(filteredLicenses);
    const fileName = buildReportFileName();
    downloadCsvReport(csv, fileName);
  };

  const clearFilters = () => {
    setFilters({
      ...BASE_FILTERS,
      selectedDepartments: [...departmentOptions],
    });
  };

  return (
    <div className="p-6 max-w-[1280px] mx-auto space-y-5">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-wrap items-end justify-between gap-3"
      >
        <div>
          <h2 className="font-display text-2xl text-foreground">Export</h2>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Build a filtered CSV export from live Monday records.
          </p>
        </div>
        <button
          type="button"
          onClick={exportFilteredReport}
          disabled={!hasSelectedDepartments}
          title={hasSelectedDepartments ? undefined : 'Select at least one department to enable export'}
          aria-label={hasSelectedDepartments ? 'Export filtered CSV' : 'Export disabled -- select at least one department first'}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <IconDownload className="w-3.5 h-3.5" />
          Export CSV ({filteredLicenses.length})
        </button>
      </motion.div>

      {!hasSelectedDepartments && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 flex items-start gap-2">
          <IconAlertCircle size={16} className="text-destructive shrink-0 mt-0.5" />
          <p className="text-sm text-destructive">Select at least one department to export.</p>
        </div>
      )}

      <section className="rounded-xl border border-border bg-card p-5 space-y-4" style={{ boxShadow: 'var(--shadow-card)' }}>
        <div className="rounded-md border border-border bg-secondary/30 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Departments</p>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                Department is tied to board. Choose one or more for the export scope.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={selectAllDepartments}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] font-medium text-foreground hover:bg-secondary transition-colors"
              >
                <IconChecks size={14} />
                Select all
              </button>
              <button
                type="button"
                onClick={unselectAllDepartments}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] font-medium text-foreground hover:bg-secondary transition-colors"
              >
                <IconSquareOff size={14} />
                Unselect all
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {departmentOptions.map((department) => {
              const checked = filters.selectedDepartments.includes(department);
              return (
                <label
                  key={`export-department-${department}`}
                  className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer transition-colors ${
                    checked
                      ? 'border-accent/40 bg-accent/10 text-foreground'
                      : 'border-border bg-background text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleDepartment(department)}
                    className="rounded border-border text-accent focus:ring-accent/50"
                  />
                  <span className="font-medium">{department}</span>
                </label>
              );
            })}
          </div>

          <div className="text-[11px] text-muted-foreground">
            {boardsCoveredBySelection.length > 0
              ? `Boards covered: ${boardsCoveredBySelection.join(', ')}`
              : 'No departments selected.'}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <label className="flex-1 min-w-[260px]">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Search</span>
            <input
              value={filters.search}
              onChange={(event) => setFilter('search', event.target.value)}
              placeholder="Search app, vendor, department, board, renewal method, or ID"
              className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent/50 transition-colors"
            />
          </label>

          <label className="min-w-[170px]">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Payment</span>
            <select
              value={filters.payment}
              onChange={(event) => setFilter('payment', event.target.value as ExportPaymentFilter)}
              className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:border-accent/50 transition-colors"
            >
              <option value="ALL">All methods</option>
              <option value="ACH">ACH</option>
              <option value="CREDIT_CARD">Credit Card</option>
              <option value="MANUAL">Manual</option>
              <option value="OTHER">Other</option>
            </select>
          </label>

          <label className="min-w-[170px]">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Renewal Window</span>
            <select
              value={filters.renewalWindow}
              onChange={(event) => setFilter('renewalWindow', event.target.value as InventoryRenewalWindowFilter)}
              className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:border-accent/50 transition-colors"
            >
              <option value="ALL">All dates</option>
              <option value="OVERDUE">Overdue</option>
              <option value="UPCOMING_30">0–30 days</option>
              <option value="UPCOMING_90">0–90 days</option>
              <option value="FUTURE_90_PLUS">90+ days</option>
              <option value="NO_DATE">No date</option>
            </select>
          </label>

          <label className="min-w-[170px]">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Risk</span>
            <select
              value={filters.risk}
              onChange={(event) => setFilter('risk', event.target.value as ExportFilterState['risk'])}
              className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:border-accent/50 transition-colors"
            >
              <option value="ALL">All risk levels</option>
              <option value="High Risk">High Risk</option>
              <option value="Medium Risk">Medium Risk</option>
              <option value="Low Risk">Low Risk</option>
            </select>
          </label>

          <label className="min-w-[170px]">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Status</span>
            <select
              value={filters.status}
              onChange={(event) => setFilter('status', event.target.value as ExportFilterState['status'])}
              className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:border-accent/50 transition-colors"
            >
              <option value="ALL">All statuses</option>
              <option value="Warning">Warning</option>
              <option value="Healthy">Healthy</option>
              <option value="Over-provisioned">Over-provisioned</option>
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <div className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground tabular-nums">{filteredLicenses.length}</span> records selected
            • <span className="font-semibold text-foreground tabular-nums">{formatCurrency(totalFilteredSpend)}</span> total spend
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <IconFilterOff size={14} />
              Clear filters
            </button>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-[11px] font-semibold text-foreground uppercase tracking-wider">Export preview</h2>
          <p className="text-[11px] text-muted-foreground tabular-nums">
            Showing {previewRows.length} of {filteredLicenses.length}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-secondary/40 border-b border-border">
                {['Application', 'Vendor', 'Department', 'Source Board', 'Amount', 'Renewal', 'Status'].map((header) => (
                  <th key={header} className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {previewRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-sm text-muted-foreground text-center">
                    No records match the current export filters.
                  </td>
                </tr>
              ) : (
                previewRows.map((license) => (
                  <tr key={`export-preview-${license.id}`} className="hover:bg-secondary/40 transition-colors">
                    <td className="px-4 py-2.5 text-sm font-medium text-foreground">{license.application}</td>
                    <td className="px-4 py-2.5 text-sm text-muted-foreground">{license.vendor}</td>
                    <td className="px-4 py-2.5 text-sm text-muted-foreground">{license.department}</td>
                    <td className="px-4 py-2.5 text-sm text-muted-foreground">{license.sourceBoardName || '--'}</td>
                    <td className="px-4 py-2.5 text-sm font-medium text-foreground tabular-nums">{formatCurrency(license.amount)}</td>
                    <td className="px-4 py-2.5 text-sm text-muted-foreground">{license.renewalMethod || '--'}</td>
                    <td className="px-4 py-2.5 text-sm text-muted-foreground">{license.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default ExportReports;
