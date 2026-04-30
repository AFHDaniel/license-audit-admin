import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  IconArrowDown,
  IconArrowUp,
  IconArrowsUpDown,
  IconCalendarEvent,
  IconCreditCard,
  IconEditCircle,
  IconFilter,
  IconFilterOff,
  IconLayoutGrid,
  IconPackage,
  IconSearch,
  IconTrash,
  IconAlertTriangle,
  IconX,
} from '@tabler/icons-react';
import {
  InventoryBillingCadenceFilter,
  InventoryFilterPreset,
  InventoryPaymentFilter,
  InventoryQuickFilter,
  InventoryRenewalWindowFilter,
  License,
} from '../types';
import {
  formatCurrency,
  getAnnualCost,
  getDaysUntilRenewal,
  getDepartmentTheme,
  getLicenseBillingCadence,
  getMonthlyCost,
} from '../utils/licenseMetrics';
import {
  DEFAULT_INVENTORY_VIEW_STATE,
  filterAndSortLicenses,
  InventorySortDirection,
  InventorySortField,
} from '../utils/inventoryView';

interface InventoryProps {
  licenses: License[];
  onRemove: (id: string) => void;
  onSelectLicense?: (license: License) => void;
  externalPreset?: InventoryFilterPreset | null;
  externalPresetKey?: number;
  allowedDepartments?: string[];
}

const PAGE_SIZE = 25;

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.25, 0.46, 0.45, 0.94] as const },
});

interface InventoryColumn {
  label: string;
  sortField?: InventorySortField;
  align?: 'left' | 'right';
}

const INVENTORY_COLUMNS: InventoryColumn[] = [
  { label: 'Application', sortField: 'APPLICATION' },
  { label: 'Amount', sortField: 'AMOUNT' },
  { label: 'Monthly', sortField: 'MONTHLY' },
  { label: 'Annual', sortField: 'ANNUAL' },
  { label: 'Billing' },
  { label: 'Renewal', sortField: 'RENEWAL_DATE' },
  { label: 'Status' },
  { label: '', align: 'right' },
];

const Inventory: React.FC<InventoryProps> = ({
  licenses,
  onRemove,
  onSelectLicense,
  externalPreset,
  externalPresetKey,
  allowedDepartments,
}) => {
  const [searchValue, setSearchValue] = useState('');
  const deferredSearch = useDeferredValue(searchValue);
  const [quickFilter, setQuickFilter] = useState<InventoryQuickFilter>('ALL');
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedBoards, setSelectedBoards] = useState<string[]>([]);
  const [selectedCoOwnerEmails, setSelectedCoOwnerEmails] = useState<string[]>([]);
  const [selectedRisk, setSelectedRisk] = useState<'ALL' | License['riskLevel']>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | License['status']>('ALL');
  const [selectedPayment, setSelectedPayment] = useState<InventoryPaymentFilter>('ALL');
  const [selectedRenewalWindow, setSelectedRenewalWindow] = useState<InventoryRenewalWindowFilter>('ALL');
  const [selectedBillingCadence, setSelectedBillingCadence] = useState<InventoryBillingCadenceFilter>('ALL');
  const [sortField, setSortField] = useState<InventorySortField>('RENEWAL_DATE');
  const [sortDirection, setSortDirection] = useState<InventorySortDirection>('ASC');
  const [drilldownContextLabel, setDrilldownContextLabel] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (!externalPreset) return;

    setSearchValue(typeof externalPreset.search === 'string' ? externalPreset.search : '');
    setQuickFilter(externalPreset.quickFilter || 'ALL');
    setSelectedDepartments(typeof externalPreset.department === 'string' ? [externalPreset.department] : []);
    setSelectedBoards(typeof externalPreset.sourceBoardName === 'string' ? [externalPreset.sourceBoardName] : []);
    setSelectedCoOwnerEmails([]);
    setSelectedRisk(externalPreset.risk || 'ALL');
    setSelectedStatus(externalPreset.status || 'ALL');
    setSelectedPayment(externalPreset.payment || 'ALL');
    setSelectedRenewalWindow(externalPreset.renewalWindow || 'ALL');
    setSelectedBillingCadence(externalPreset.billingCadence || 'ALL');
    setSortField('RENEWAL_DATE');
    setSortDirection('ASC');
    setDrilldownContextLabel(externalPreset.contextLabel || null);
    setShowAdvanced(Boolean(
      externalPreset.billingCadence || externalPreset.risk || externalPreset.status || externalPreset.payment
        || (Array.isArray(externalPreset.department) && externalPreset.department.length > 0)
    ));
  }, [externalPresetKey, externalPreset]);

  const departmentOptions = useMemo(() => {
    const fromLicenses = Array.from(new Set(licenses.map((l) => l.department).filter(Boolean))).sort();
    return allowedDepartments ? fromLicenses.filter((d) => allowedDepartments.includes(d)) : fromLicenses;
  }, [licenses, allowedDepartments]);

  const boardOptions = useMemo(() => {
    return Array.from(new Set(licenses.map((l) => l.sourceBoardName).filter(Boolean))).sort();
  }, [licenses]);

  const coOwnerOptions = useMemo(() => {
    const seen = new Set<string>();
    const result: Array<{ email: string; name: string }> = [];
    for (const license of licenses) {
      for (const coOwner of license.coOwners || []) {
        const email = String(coOwner.email || '').trim().toLowerCase();
        const name = String(coOwner.name || '').trim();
        const key = email || `name:${name.toLowerCase()}`;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        result.push({ email, name });
      }
    }
    return result.sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
  }, [licenses]);

  const filteredLicenses = useMemo(() => {
    return filterAndSortLicenses(licenses, {
      ...DEFAULT_INVENTORY_VIEW_STATE,
      search: deferredSearch,
      quickFilter,
      selectedDepartments,
      selectedBoards,
      selectedCoOwnerEmails,
      selectedRisk,
      selectedStatus,
      selectedPayment,
      selectedRenewalWindow,
      selectedBillingCadence,
      sortField,
      sortDirection,
    });
  }, [
    licenses, deferredSearch, quickFilter, selectedDepartments, selectedBoards,
    selectedCoOwnerEmails, selectedRisk, selectedStatus, selectedPayment,
    selectedRenewalWindow, selectedBillingCadence, sortField, sortDirection,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredLicenses.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [
    deferredSearch, quickFilter, selectedDepartments, selectedBoards,
    selectedCoOwnerEmails, selectedRisk, selectedStatus, selectedPayment,
    selectedRenewalWindow, selectedBillingCadence, sortField, sortDirection, licenses.length,
  ]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageStart = (page - 1) * PAGE_SIZE;
  const pageEnd = pageStart + PAGE_SIZE;
  const paginatedLicenses = filteredLicenses.slice(pageStart, pageEnd);

  const handleHeaderSort = (field: InventorySortField) => {
    if (sortField === field) {
      setSortDirection((current) => (current === 'ASC' ? 'DESC' : 'ASC'));
      return;
    }
    setSortField(field);
    setSortDirection('ASC');
  };

  const hasActiveFilters =
    deferredSearch.trim().length > 0 ||
    quickFilter !== 'ALL' ||
    selectedDepartments.length > 0 ||
    selectedBoards.length > 0 ||
    selectedCoOwnerEmails.length > 0 ||
    selectedRisk !== 'ALL' ||
    selectedStatus !== 'ALL' ||
    selectedPayment !== 'ALL' ||
    selectedRenewalWindow !== 'ALL' ||
    selectedBillingCadence !== 'ALL' ||
    sortField !== 'RENEWAL_DATE' ||
    sortDirection !== 'ASC';

  const visibleStart = filteredLicenses.length === 0 ? 0 : pageStart + 1;
  const visibleEnd = Math.min(pageEnd, filteredLicenses.length);

  const clearFilters = () => {
    setSearchValue('');
    setQuickFilter('ALL');
    setSelectedDepartments([]);
    setSelectedBoards([]);
    setSelectedCoOwnerEmails([]);
    setSelectedRisk('ALL');
    setSelectedStatus('ALL');
    setSelectedPayment('ALL');
    setSelectedRenewalWindow('ALL');
    setSelectedBillingCadence('ALL');
    setSortField('RENEWAL_DATE');
    setSortDirection('ASC');
    setDrilldownContextLabel(null);
  };

  const toggleSelection = (
    value: string,
    setter: React.Dispatch<React.SetStateAction<string[]>>,
  ) => {
    setter((current) => (
      current.includes(value)
        ? current.filter((entry) => entry !== value)
        : [...current, value]
    ));
  };

  const quickFilterButtons: Array<{ id: InventoryQuickFilter; label: string; Icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'ALL', label: 'All', Icon: IconLayoutGrid },
    { id: 'UPCOMING_30', label: 'Renewing 30d', Icon: IconCalendarEvent },
    { id: 'OVERDUE', label: 'Overdue', Icon: IconAlertTriangle },
    { id: 'AUTO_METHODS', label: 'ACH / CC', Icon: IconCreditCard },
    { id: 'MANUAL', label: 'Manual', Icon: IconEditCircle },
  ];

  return (
    <div className="p-6 space-y-4">
      {/* Greeting */}
      <motion.div {...fadeUp(0)} className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-2xl text-foreground">Inventory</h2>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {licenses.length} applications tracked • {filteredLicenses.length} match current filters
          </p>
        </div>
        {drilldownContextLabel && (
          <div className="flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[11px]">
            <IconFilter className="w-3 h-3 text-accent" />
            <span className="text-foreground font-medium">{drilldownContextLabel}</span>
            <button
              type="button"
              onClick={() => setDrilldownContextLabel(null)}
              className="text-accent hover:opacity-70 ml-1"
            >
              <IconX className="w-3 h-3" />
            </button>
          </div>
        )}
      </motion.div>

      {/* Quick filter pills */}
      <motion.div {...fadeUp(0.05)} className="flex items-center gap-2 flex-wrap">
        {quickFilterButtons.map((filter) => {
          const active = quickFilter === filter.id;
          return (
            <button
              key={filter.id}
              type="button"
              onClick={() => setQuickFilter(filter.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors ${
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              <filter.Icon className="w-3.5 h-3.5" />
              {filter.label}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-[11px] font-medium transition-colors ${
              showAdvanced
                ? 'border-accent/60 bg-accent/10 text-accent'
                : 'border-border bg-background text-muted-foreground hover:text-foreground'
            }`}
          >
            <IconFilter className="w-3.5 h-3.5" />
            {showAdvanced ? 'Hide' : 'Advanced'} filters
          </button>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-secondary text-[11px] font-medium transition-colors"
            >
              <IconFilterOff className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
        </div>
      </motion.div>

      {/* Advanced filter panel */}
      {showAdvanced && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25 }}
          className="overflow-hidden"
        >
          <div className="rounded-xl border border-border bg-card p-4 space-y-4" style={{ boxShadow: 'var(--shadow-card)' }}>
            {/* Search */}
            <div className="relative">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                className="w-full h-9 rounded-md border border-border bg-background pl-9 pr-3 text-[12px] text-foreground placeholder:text-muted-foreground focus:border-ring transition-colors"
                placeholder="Search app, vendor, department, board, renewal method, or ID"
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
              />
            </div>

            {/* Dropdowns */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2">
              {[
                {
                  label: 'Payment',
                  value: selectedPayment,
                  onChange: (v: string) => setSelectedPayment(v as InventoryPaymentFilter),
                  options: [
                    ['ALL', 'All payment methods'],
                    ['AUTO_ANY', 'ACH / Credit Card'],
                    ['ACH', 'ACH'],
                    ['CREDIT_CARD', 'Credit Card'],
                    ['MANUAL', 'Manual'],
                    ['OTHER', 'Other'],
                  ],
                },
                {
                  label: 'Billing cycle',
                  value: selectedBillingCadence,
                  onChange: (v: string) => setSelectedBillingCadence(v as InventoryBillingCadenceFilter),
                  options: [
                    ['ALL', 'All cadences'],
                    ['ANNUAL', 'Annual'],
                    ['QUARTERLY', 'Quarterly'],
                    ['MONTHLY', 'Monthly'],
                    ['MULTI_YEAR', 'Multi-Year'],
                    ['OTHER', 'Other / Custom'],
                    ['UNKNOWN', 'Unknown'],
                  ],
                },
                {
                  label: 'Renewal window',
                  value: selectedRenewalWindow,
                  onChange: (v: string) => setSelectedRenewalWindow(v as InventoryRenewalWindowFilter),
                  options: [
                    ['ALL', 'All dates'],
                    ['OVERDUE', 'Overdue'],
                    ['UPCOMING_30', '0–30 days'],
                    ['UPCOMING_90', '0–90 days'],
                    ['FUTURE_90_PLUS', '90+ days'],
                    ['NO_DATE', 'No date'],
                  ],
                },
                {
                  label: 'Risk',
                  value: selectedRisk,
                  onChange: (v: string) => setSelectedRisk(v as 'ALL' | License['riskLevel']),
                  options: [
                    ['ALL', 'All risk levels'],
                    ['High Risk', 'High Risk'],
                    ['Medium Risk', 'Medium Risk'],
                    ['Low Risk', 'Low Risk'],
                  ],
                },
                {
                  label: 'Status',
                  value: selectedStatus,
                  onChange: (v: string) => setSelectedStatus(v as 'ALL' | License['status']),
                  options: [
                    ['ALL', 'All statuses'],
                    ['Warning', 'Warning'],
                    ['Healthy', 'Healthy'],
                    ['Over-provisioned', 'Over-provisioned'],
                  ],
                },
              ].map((field) => (
                <label key={field.label} className="flex flex-col gap-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  {field.label}
                  <select
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                    className="h-8 rounded-md border border-border bg-background px-2.5 text-[12px] text-foreground font-normal normal-case tracking-normal focus:border-ring transition-colors"
                  >
                    {field.options.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>

            {/* Multi-select pill groups */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {[
                {
                  title: 'Departments',
                  options: departmentOptions,
                  selected: selectedDepartments,
                  setter: setSelectedDepartments,
                  getKey: (o: string) => o,
                  getLabel: (o: string) => o,
                  getValue: (o: string) => o,
                  disabled: () => false,
                },
                {
                  title: 'Source boards',
                  options: boardOptions,
                  selected: selectedBoards,
                  setter: setSelectedBoards,
                  getKey: (o: string) => o,
                  getLabel: (o: string) => o,
                  getValue: (o: string) => o,
                  disabled: () => false,
                },
              ].map((group) => (
                <div key={group.title} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group.title}</p>
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {group.selected.length === 0 ? 'All' : `${group.selected.length} selected`}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {group.options.map((option) => {
                      const value = group.getValue(option);
                      const selected = group.selected.includes(value);
                      return (
                        <button
                          key={group.getKey(option)}
                          type="button"
                          onClick={() => toggleSelection(value, group.setter)}
                          className={`inline-flex items-center h-7 rounded-full border px-3 text-[11px] font-medium leading-none transition-colors ${
                            selected
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-background text-muted-foreground hover:text-foreground hover:border-muted-foreground/40'
                          }`}
                        >
                          {group.getLabel(option)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {coOwnerOptions.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Co-Owners</p>
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {selectedCoOwnerEmails.length === 0 ? 'All' : `${selectedCoOwnerEmails.length} selected`}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {coOwnerOptions.map((option) => {
                      const key = option.email || option.name;
                      const selected = selectedCoOwnerEmails.includes(option.email);
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => toggleSelection(option.email, setSelectedCoOwnerEmails)}
                          disabled={!option.email}
                          className={`inline-flex items-center h-7 rounded-full border px-3 text-[11px] font-medium leading-none transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                            selected
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-background text-muted-foreground hover:text-foreground hover:border-muted-foreground/40'
                          }`}
                          title={option.email || 'Email not available from Monday yet'}
                        >
                          {option.name || option.email}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Table */}
      <motion.div {...fadeUp(0.1)}>
        <div className="rounded-xl border border-border bg-card overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {INVENTORY_COLUMNS.map((column, idx) => {
                    const isSortable = Boolean(column.sortField);
                    const isSorted = column.sortField && column.sortField === sortField;
                    const thClass = `px-5 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider ${
                      column.align === 'right' ? 'text-right' : 'text-left'
                    }`;

                    if (!isSortable) {
                      return <th key={`${column.label}-${idx}`} className={thClass}>{column.label}</th>;
                    }

                    const ArrowIcon = !isSorted
                      ? IconArrowsUpDown
                      : sortDirection === 'ASC'
                        ? IconArrowUp
                        : IconArrowDown;

                    return (
                      <th key={column.label} className={thClass}>
                        <button
                          type="button"
                          onClick={() => handleHeaderSort(column.sortField!)}
                          aria-sort={isSorted ? (sortDirection === 'ASC' ? 'ascending' : 'descending') : 'none'}
                          className={`inline-flex items-center gap-1 uppercase tracking-wider font-medium transition-colors ${
                            isSorted ? 'text-accent' : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {column.label}
                          <ArrowIcon className={`w-3 h-3 ${isSorted ? 'opacity-100' : 'opacity-50'}`} />
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {paginatedLicenses.length > 0 ? paginatedLicenses.map((license) => {
                  const days = getDaysUntilRenewal(license);
                  const urgent = days != null && days <= 30 && days >= 0;
                  const overdue = days != null && days < 0;
                  const deptTheme = getDepartmentTheme(license.department);

                  return (
                    <tr
                      key={license.id}
                      onClick={() => onSelectLicense?.(license)}
                      className={`border-b border-border last:border-0 hover:bg-secondary/30 transition-colors ${
                        onSelectLicense ? 'cursor-pointer' : ''
                      }`}
                    >
                      <td className="px-5 py-2.5">
                        <div className="text-[12px] font-medium text-foreground">{license.application}</div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                          <span>{license.vendor}</span>
                          <span
                            className="inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[10px]"
                            style={{ backgroundColor: deptTheme.softBg, borderColor: deptTheme.border, color: deptTheme.text }}
                          >
                            <span className="size-1 rounded-full" style={{ backgroundColor: deptTheme.dot }} />
                            {license.department}
                          </span>
                          {license.sourceBoardName && <span className="truncate">{license.sourceBoardName}</span>}
                        </div>
                      </td>
                      <td className="px-5 py-2.5 text-[12px] font-medium text-foreground tabular-nums">{formatCurrency(license.amount)}</td>
                      <td className="px-5 py-2.5 text-[12px] text-accent tabular-nums font-medium">{formatCurrency(getMonthlyCost(license))}</td>
                      <td className="px-5 py-2.5 text-[12px] text-foreground tabular-nums font-medium">{formatCurrency(getAnnualCost(license))}</td>
                      <td className="px-5 py-2.5 text-[12px] text-muted-foreground">
                        <span>{getLicenseBillingCadence(license)}</span>
                        <span className="text-muted-foreground/50 mx-1">/</span>
                        <span className="text-[11px]">{license.renewalMethod || 'Unknown'}</span>
                      </td>
                      <td className="px-5 py-2.5 text-[12px] text-muted-foreground">{license.renewalDate || 'No date'}</td>
                      <td className="px-5 py-2.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          overdue
                            ? 'bg-destructive/10 text-destructive'
                            : urgent
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        }`}>
                          {overdue ? 'Overdue' : urgent ? 'Due soon' : license.status}
                        </span>
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onRemove(license.id);
                          }}
                          aria-label={`Delete ${license.application} (requires delete in Monday)`}
                          className="text-muted-foreground/60 hover:text-destructive transition-colors p-1 hover:bg-destructive/10 rounded"
                        >
                          <IconTrash className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={INVENTORY_COLUMNS.length} className="px-5 py-16 text-center">
                      <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                          <IconPackage className="w-5 h-5" />
                        </div>
                        <p className="text-[13px]">
                          {licenses.length === 0 ? 'No Monday records have synced yet.' : 'No records match the current filters.'}
                        </p>
                        {hasActiveFilters && (
                          <button
                            type="button"
                            onClick={clearFilters}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-md border border-border text-foreground hover:bg-secondary transition-colors"
                          >
                            <IconFilterOff className="w-3.5 h-3.5" />
                            Clear filters
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-5 py-2.5 border-t border-border">
            <p className="text-[11px] text-muted-foreground tabular-nums">
              Showing {visibleStart}–{visibleEnd} of {filteredLicenses.length} records
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-background border border-border text-foreground hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="text-[11px] text-muted-foreground tabular-nums px-2">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-background border border-border text-foreground hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Inventory;
