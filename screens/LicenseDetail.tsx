import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  IconArrowLeft,
  IconSearch,
  IconFilter,
  IconCurrencyDollar,
  IconReceiptDollar,
  IconCalendar,
  IconCalendarEvent,
  IconUsers,
  IconShieldCheck,
  IconCheck,
  IconRefresh,
  IconAlertCircle,
  IconLoader2,
} from '@tabler/icons-react';
import { InventoryFilterPreset, License } from '../types';
import { updateLicenseRenewal } from '../services/licensesApi';
import {
  formatCurrency,
  getAnnualCost,
  getDaysUntilRenewal,
  getDepartmentTheme,
  getLicenseBillingCadence,
  getMonthlyCost,
} from '../utils/licenseMetrics';

interface LicenseDetailProps {
  license: License | null;
  accessDenied?: boolean;
  isSyncing?: boolean;
  onBack: () => void;
  onOpenInventory?: (preset: InventoryFilterPreset) => void;
  onLicenseUpdated?: () => void;
}

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.25, 0.46, 0.45, 0.94] as const },
});

// Hide the vendor row when it just echoes the first word of the app name.
function hasRealVendor(license: License): boolean {
  const vendor = (license.vendor || '').trim();
  if (!vendor || vendor === 'Unknown') return false;
  const firstWord = (license.application || '').trim().split(/\s+/)[0] || '';
  return vendor.toLowerCase() !== firstWord.toLowerCase();
}

function renewalUrgencyText(license: License | null): string {
  if (!license) return 'Record unavailable';
  const days = getDaysUntilRenewal(license);
  if (days == null) return 'No renewal date on record';
  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days === 0) return 'Renews today';
  return `${days} days until renewal`;
}

function toDateInputValue(value: string | null | undefined): string {
  const raw = String(value || '').trim();
  if (!raw || raw === 'TBD') return '';
  const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const LicenseDetail: React.FC<LicenseDetailProps> = ({
  license,
  accessDenied,
  isSyncing,
  onBack,
  onOpenInventory,
  onLicenseUpdated,
}) => {
  const [amountInput, setAmountInput] = useState('');
  const [lengthInput, setLengthInput] = useState('');
  const [renewalMethodInput, setRenewalMethodInput] = useState('');
  const [renewalDateInput, setRenewalDateInput] = useState('');
  const [seatsInput, setSeatsInput] = useState('');
  const [useCaseInput, setUseCaseInput] = useState('');
  const initialRef = React.useRef({
    amount: '', length: '', renewalMethod: '', renewalDate: '', seats: '', useCase: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!license) {
      setAmountInput('');
      setLengthInput('');
      setRenewalMethodInput('');
      setRenewalDateInput('');
      setSeatsInput('');
      setUseCaseInput('');
      return;
    }
    const initialAmount = Number.isFinite(license.amount) && license.amount > 0
      ? String(license.amount)
      : '';
    const initialLength = license.length || '';
    const initialMethod = license.renewalMethod || '';
    const initialDate = toDateInputValue(license.renewalDate);
    const initialSeats = license.seats || '';
    const initialUseCase = license.useCase || '';

    setAmountInput(initialAmount);
    setLengthInput(initialLength);
    setRenewalMethodInput(initialMethod);
    setRenewalDateInput(initialDate);
    setSeatsInput(initialSeats);
    setUseCaseInput(initialUseCase);

    initialRef.current = {
      amount: initialAmount,
      length: initialLength,
      renewalMethod: initialMethod,
      renewalDate: initialDate,
      seats: initialSeats,
      useCase: initialUseCase,
    };

    setSaveError(null);
    setSaveSuccess(null);
  }, [license]);

  const handleRenewalSave = async () => {
    if (!license) return;
    const recordBoardId = license.recordBoardId || license.sourceBoardId || '';
    if (!recordBoardId) {
      setSaveError('This record is missing a Monday board reference, so it cannot be updated from the dashboard yet.');
      return;
    }

    // Only send fields the user actually changed. Prevents accidentally clearing
    // or rewriting fields the form preloaded but the user didn't touch.
    const init = initialRef.current;
    const payload: {
      recordBoardId: string;
      amount?: number;
      length?: string;
      renewalMethod?: string;
      renewalDate?: string;
      seats?: string;
      useCase?: string;
    } = { recordBoardId };

    if (amountInput.trim() !== init.amount.trim()) {
      const trimmed = amountInput.trim();
      if (trimmed) {
        const parsed = Number.parseFloat(trimmed.replace(/[$,\s]/g, ''));
        if (!Number.isFinite(parsed)) {
          setSaveError('Amount must be a valid number.');
          return;
        }
        payload.amount = parsed;
      }
      // empty trimmed -> don't include amount; backend won't touch the cell
    }
    if (lengthInput !== init.length) payload.length = lengthInput;
    if (renewalMethodInput !== init.renewalMethod) payload.renewalMethod = renewalMethodInput;
    if (renewalDateInput !== init.renewalDate) payload.renewalDate = renewalDateInput;
    if (seatsInput !== init.seats) payload.seats = seatsInput;
    if (useCaseInput !== init.useCase) payload.useCase = useCaseInput;

    const changedKeys = Object.keys(payload).filter((k) => k !== 'recordBoardId');
    if (changedKeys.length === 0) {
      setSaveError('Nothing changed -- edit a field before saving.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(null);
    try {
      await updateLicenseRenewal(license.id, payload);
      setSaveSuccess(`Saved ${changedKeys.join(', ')} to Monday.`);
      onLicenseUpdated?.();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to update Monday right now.');
    } finally {
      setIsSaving(false);
    }
  };

  if (accessDenied) {
    return (
      <div className="p-6 max-w-[1100px] mx-auto">
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
          <div className="flex items-start gap-3">
            <IconAlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h2 className="font-display text-lg text-foreground">Access denied</h2>
              <p className="mt-1 text-[13px] text-muted-foreground">
                You do not have permission to view this application. It belongs to a department outside your scope.
              </p>
              <button
                type="button"
                onClick={onBack}
                className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-secondary transition-colors"
              >
                <IconArrowLeft className="w-3.5 h-3.5" />
                Back
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!license) {
    if (isSyncing) {
      return (
        <div className="p-6 max-w-[1100px] mx-auto">
          <div className="flex items-center justify-center py-20">
            <div className="text-center space-y-3">
              <IconLoader2 className="mx-auto w-8 h-8 text-muted-foreground animate-spin" strokeWidth={1.5} />
              <p className="text-[13px] text-muted-foreground">Loading application details...</p>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="p-6 max-w-[1100px] mx-auto">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
          <div className="flex items-start gap-3">
            <IconAlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <h2 className="font-display text-lg text-foreground">Record not found</h2>
              <p className="mt-1 text-[13px] text-muted-foreground">
                This item may have been deleted in Monday and removed during the latest sync.
              </p>
              <button
                type="button"
                onClick={onBack}
                className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-secondary transition-colors"
              >
                <IconArrowLeft className="w-3.5 h-3.5" />
                Back
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const departmentTheme = getDepartmentTheme(license.department);
  const daysUntilRenewal = getDaysUntilRenewal(license);
  const billingCadence = getLicenseBillingCadence(license);
  const renewalUrgency = renewalUrgencyText(license);

  const metricCards = React.useMemo(() => [
    { label: 'Billed Amount', value: formatCurrency(license.amount), sub: `${billingCadence} charge`, Icon: IconCurrencyDollar },
    { label: 'Monthly Cost', value: formatCurrency(getMonthlyCost(license)), sub: 'Normalized monthly', Icon: IconReceiptDollar },
    { label: 'Annual Cost', value: formatCurrency(getAnnualCost(license)), sub: 'Normalized annual', Icon: IconCalendar },
    { label: 'Renewal Date', value: license.renewalDate || 'TBD', sub: renewalUrgency, Icon: IconCalendarEvent },
    { label: 'Seats', value: license.seats || 'N/A', sub: license.useCase || 'No use case', Icon: IconUsers },
    { label: 'Risk / Status', value: license.riskLevel, sub: license.status, Icon: IconShieldCheck },
  ], [license.amount, license.renewalDate, license.seats, license.useCase, license.riskLevel, license.status, billingCadence, renewalUrgency, license]);

  const formFields: Array<{
    key: string;
    label: string;
    value: string;
    setter: React.Dispatch<React.SetStateAction<string>>;
    placeholder?: string;
    type?: string;
  }> = [
    { key: 'amount', label: 'Amount', value: amountInput, setter: setAmountInput, placeholder: '2500', type: 'text' },
    { key: 'renewalDate', label: 'Renewal Date', value: renewalDateInput, setter: setRenewalDateInput, type: 'date' },
    { key: 'length', label: 'Length / Term', value: lengthInput, setter: setLengthInput, placeholder: 'Annual', type: 'text' },
    { key: 'renewalMethod', label: 'Renewal Method', value: renewalMethodInput, setter: setRenewalMethodInput, placeholder: 'ACH', type: 'text' },
    { key: 'seats', label: 'Seats', value: seatsInput, setter: setSeatsInput, placeholder: '25', type: 'text' },
    { key: 'useCase', label: 'Use Case', value: useCaseInput, setter: setUseCaseInput, placeholder: 'Document Signing', type: 'text' },
  ];

  return (
    <div className="p-6 max-w-[1180px] mx-auto space-y-5">
      {/* Header */}
      <motion.div {...fadeUp(0)} className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to inventory"
            className="mt-1 inline-flex items-center justify-center rounded-md border border-border bg-card w-9 h-9 text-foreground hover:bg-secondary transition-colors shrink-0"
          >
            <IconArrowLeft className="w-4 h-4" aria-hidden="true" />
          </button>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl tracking-tight text-foreground truncate">
                {license.application}
              </h1>
              <span
                className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium"
                style={{ backgroundColor: departmentTheme.softBg, borderColor: departmentTheme.border, color: departmentTheme.text }}
              >
                <span className="size-1.5 rounded-full" style={{ backgroundColor: departmentTheme.fill }} />
                {license.department}
              </span>
              <span className="inline-flex items-center rounded-full border border-border bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {license.renewalMethod || 'Unknown'}
              </span>
              <span className="inline-flex items-center rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {billingCadence}
              </span>
            </div>
            <p className="mt-1.5 text-[12px] text-muted-foreground">
              {hasRealVendor(license) && (
                <>
                  Vendor: <span className="font-medium text-foreground">{license.vendor}</span>
                  {license.sourceBoardName && ' • '}
                </>
              )}
              {license.sourceBoardName && (
                <>Source: <span className="font-medium text-foreground">{license.sourceBoardName}</span></>
              )}
            </p>
            {license.coOwners && license.coOwners.length > 0 && (
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                Co-owners: <span className="font-medium text-foreground">
                  {license.coOwners.map((coOwner) => coOwner.name || coOwner.email).filter(Boolean).join(', ')}
                </span>
              </p>
            )}
            <p className={`mt-1.5 text-[12px] font-medium ${
              daysUntilRenewal != null && daysUntilRenewal <= 30 ? 'text-destructive' : 'text-muted-foreground'
            }`}>
              {renewalUrgency}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onOpenInventory?.({
              search: license.application,
              contextLabel: `Detail drilldown: ${license.application}`,
            })}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-secondary transition-colors"
          >
            <IconSearch className="w-3.5 h-3.5" />
            Find in Inventory
          </button>
          <button
            type="button"
            onClick={() => onOpenInventory?.({
              department: license.department,
              contextLabel: `Detail drilldown: ${license.department} department`,
            })}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-[12px] font-medium hover:opacity-90 transition-opacity"
          >
            <IconFilter className="w-3.5 h-3.5" />
            View department
          </button>
        </div>
      </motion.div>

      {/* Metric cards */}
      <motion.div {...fadeUp(0.05)} className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {metricCards.map((card) => {
          const Icon = card.Icon;
          return (
            <div key={card.label} className="rounded-xl border border-border bg-card px-4 py-3" style={{ boxShadow: 'var(--shadow-card)' }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{card.label}</span>
                <div className="w-6 h-6 rounded-md bg-secondary flex items-center justify-center text-muted-foreground">
                  <Icon className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-sm font-semibold text-foreground tabular-nums break-words">{card.value}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5 break-words">{card.sub}</div>
            </div>
          );
        })}
      </motion.div>

      {/* Record details + write-back + metadata */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* Record table */}
        <motion.div {...fadeUp(0.1)} className="xl:col-span-7">
          <div className="rounded-xl border border-border bg-card overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
            <div className="px-5 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Application record</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Synced from Monday. Use the write-back form to edit.</p>
            </div>
            <div className="divide-y divide-border">
              {([
                ['Application', license.application],
                hasRealVendor(license) ? ['Vendor', license.vendor] : null,
                ['Amount', formatCurrency(license.amount)],
                ['Billing Cycle', billingCadence],
                ['Length / Term', license.length || 'Unknown'],
                ['Renewal Method', license.renewalMethod || 'Unknown'],
                ['Renewal Date', license.renewalDate || 'TBD'],
                ['Seats', license.seats || 'N/A'],
                ['Use Case', license.useCase || 'General'],
              ] as Array<[string, string] | null>)
                .filter((row): row is [string, string] => row !== null)
                .map(([label, value]) => (
                  <div key={label} className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-2 px-5 py-2.5">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
                    <p className="text-[12px] text-foreground break-words">{value}</p>
                  </div>
                ))}
            </div>
          </div>
        </motion.div>

        {/* Write-back + metadata */}
        <div className="xl:col-span-5 space-y-4">
          <motion.div {...fadeUp(0.15)}>
            <div className="rounded-xl border border-border bg-card p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Renewal write-back</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Write updated terms directly to Monday.</p>
                </div>
                <span className="inline-flex items-center rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Monday is source of truth
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {formFields.map((field) => (
                  <label key={field.key} className="flex flex-col gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    {field.label}
                    <input
                      type={field.type}
                      value={field.value}
                      onChange={(e) => field.setter(e.target.value)}
                      placeholder={field.placeholder}
                      className="h-8 rounded-md border border-border bg-background px-2.5 text-[12px] text-foreground font-normal normal-case tracking-normal placeholder:text-muted-foreground focus:border-ring transition-colors"
                    />
                  </label>
                ))}
              </div>

              {saveError && (
                <div className="mt-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
                  <IconAlertCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                  <p className="text-[12px] text-destructive">{saveError}</p>
                </div>
              )}

              {saveSuccess && (
                <div className="mt-3 flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                  <IconCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <p className="text-[12px] text-emerald-700 dark:text-emerald-400">{saveSuccess}</p>
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleRenewalSave}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
                >
                  <IconCheck className="w-3.5 h-3.5" />
                  {isSaving ? 'Saving to Monday...' : 'Mark renewal complete'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAmountInput(Number.isFinite(license.amount) ? String(license.amount) : '');
                    setLengthInput(license.length || '');
                    setRenewalMethodInput(license.renewalMethod || '');
                    setRenewalDateInput(toDateInputValue(license.renewalDate));
                    setSeatsInput(license.seats || '');
                    setUseCaseInput(license.useCase || '');
                    setSaveError(null);
                    setSaveSuccess(null);
                  }}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-secondary disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  <IconRefresh className="w-3.5 h-3.5" />
                  Reset
                </button>
              </div>
            </div>
          </motion.div>

          <motion.div {...fadeUp(0.2)}>
            <div className="rounded-xl border border-border bg-card p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
              <h3 className="text-sm font-semibold text-foreground mb-3">Compliance snapshot</h3>
              <div className="space-y-2">
                {[
                  { label: 'Status', value: license.status },
                  { label: 'Risk level', value: license.riskLevel },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2">
                    <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">{row.label}</span>
                    <span className="text-[12px] font-medium text-foreground">{row.value}</span>
                  </div>
                ))}
                <div className="rounded-md border border-border bg-secondary/30 px-3 py-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Term progress</span>
                    <span className="text-[11px] font-medium text-foreground tabular-nums">{license.progress}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${license.progress > 90 ? 'bg-destructive' : 'bg-accent'}`}
                      style={{ width: `${Math.max(0, Math.min(100, license.progress || 0))}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div {...fadeUp(0.25)}>
            <div className="rounded-xl border border-border bg-card p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
              <h3 className="text-sm font-semibold text-foreground mb-3">Source metadata</h3>
              <div className="space-y-1.5 text-[12px]">
                {[
                  { label: 'Record ID', value: license.id, mono: true },
                  { label: 'Monday board', value: license.sourceBoardName || 'Unknown' },
                  { label: 'Source board ID', value: license.sourceBoardId || 'N/A', mono: true },
                  { label: 'Record board ID', value: license.recordBoardId || 'N/A', mono: true },
                  { label: 'Record type', value: (license.recordKind || 'item').toUpperCase() },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{row.label}</span>
                    {row.mono ? (
                      <code className="text-[11px] font-mono text-foreground bg-secondary rounded px-1.5 py-0.5 tabular-nums">
                        {row.value}
                      </code>
                    ) : (
                      <span className="font-medium text-foreground">{row.value}</span>
                    )}
                  </div>
                ))}
                <p className="pt-2 text-[10px] text-muted-foreground leading-relaxed">
                  All saved values are written to Monday first, then re-synced into the dashboard.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default LicenseDetail;
