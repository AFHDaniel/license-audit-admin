//
// Data-hygiene audit for the renewal-reminder pipeline.
//
// A license can only fire a reminder if BOTH:
//   1. Its `renewalDate` parses to a real date (so we can compute days-until)
//   2. It has at least one co-owner with a usable email
//
// This module classifies every license against those two requirements so the
// Settings UI can show "X of Y records are ready to trigger reminders" plus a
// drill-down list of the records still missing data.
//

const NON_DATE_KEYWORDS = {
  empty: ['', null, undefined],
  na: ['n/a', 'na', 'none', '-'],
  tbd: ['tbd', 'tba', '?', 'pending'],
  monthToMonth: ['month to month', 'm2m', 'monthly'],
  untilCancelled: ['until cancelled', 'until canceled', 'ongoing', 'continuous'],
};

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function classifyDate(rawValue) {
  const value = String(rawValue || '').trim();
  if (!value) return 'empty';

  const norm = normalize(value);
  for (const [bucket, hits] of Object.entries(NON_DATE_KEYWORDS)) {
    if (bucket === 'empty') continue;
    if (hits.some((h) => norm === h || norm.includes(h))) return bucket;
  }

  // ISO `YYYY-MM-DD`
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return 'parseable';

  // Prose dates like "Apr 01, 2026", "April 1 2026"
  if (/^[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}$/.test(value)) return 'parseable';

  // Month/year only — not enough to fire on a specific day
  if (/^\d{1,2}[/-]\d{4}$/.test(value)) return 'monthYearOnly';

  return 'unstructured';
}

const BUCKET_LABELS = {
  parseable: 'Has a real renewal date',
  empty: 'Missing renewal date',
  na: 'Marked N/A',
  tbd: 'Marked TBD',
  monthToMonth: 'Month-to-month',
  untilCancelled: 'Until cancelled',
  monthYearOnly: 'Month/year only (no day)',
  unstructured: 'Free-text — needs cleanup',
};

const BUCKET_SEVERITY = {
  parseable: 'good',
  empty: 'bad',
  na: 'neutral',
  tbd: 'warn',
  monthToMonth: 'neutral',
  untilCancelled: 'neutral',
  monthYearOnly: 'warn',
  unstructured: 'warn',
};

function coOwnerEmailCount(license) {
  let count = 0;
  for (const coOwner of license.coOwners || []) {
    const email = String(coOwner?.email || '').trim();
    if (email.includes('@')) count += 1;
  }
  return count;
}

// Renewal types that intentionally never fire reminders. A license tagged with
// one of these is OK to have an empty date — it's a deliberate choice, not a
// data-hygiene issue.
const NON_FIRING_TYPES = new Set(['Until Cancelled', 'Month-to-month', 'One-time', 'Externally Managed']);
const FIRING_TYPES = new Set(['Fixed Date', 'Auto-renew']);

/**
 * Audit a list of licenses and return a structured hygiene report.
 * @param {Array<object>} licenses
 */
export function auditDataHygiene(licenses) {
  const buckets = {};
  for (const key of Object.keys(BUCKET_LABELS)) {
    buckets[key] = { key, label: BUCKET_LABELS[key], severity: BUCKET_SEVERITY[key], count: 0, sampleIds: [] };
  }

  let withCoOwners = 0;
  let readyToFire = 0;
  let intentionallySilent = 0;
  let needsClassification = 0;
  const needsAttention = [];

  for (const license of licenses) {
    const bucket = classifyDate(license.renewalDate);
    buckets[bucket].count += 1;
    if (buckets[bucket].sampleIds.length < 5) buckets[bucket].sampleIds.push(license.id);

    const hasCoOwner = coOwnerEmailCount(license) > 0;
    if (hasCoOwner) withCoOwners += 1;

    const renewalType = (license.renewalType || '').trim();
    const isFiring = FIRING_TYPES.has(renewalType);
    const isNonFiring = NON_FIRING_TYPES.has(renewalType);
    const dateOk = bucket === 'parseable';

    // Intentionally silent: tagged Until Cancelled / Month-to-month / etc. —
    // these correctly have no reminders. Don't flag them as broken.
    if (isNonFiring) {
      intentionallySilent += 1;
      continue;
    }

    // No renewal type set yet (Pending or empty) — needs human classification.
    if (!isFiring) {
      needsClassification += 1;
      needsAttention.push({
        id: license.id,
        application: license.application || 'Unnamed',
        department: license.department || '',
        renewalDate: license.renewalDate || '',
        dateBucket: bucket,
        dateBucketLabel: BUCKET_LABELS[bucket],
        hasCoOwner,
        coOwnerCount: coOwnerEmailCount(license),
        amount: license.amount || 0,
        missing: renewalType === 'Pending' ? 'renewal-type-pending' : 'renewal-type',
      });
      continue;
    }

    // Firing type (Fixed Date / Auto-renew): must have date + co-owner.
    if (dateOk && hasCoOwner) {
      readyToFire += 1;
    } else {
      needsAttention.push({
        id: license.id,
        application: license.application || 'Unnamed',
        department: license.department || '',
        renewalDate: license.renewalDate || '',
        dateBucket: bucket,
        dateBucketLabel: BUCKET_LABELS[bucket],
        hasCoOwner,
        coOwnerCount: coOwnerEmailCount(license),
        amount: license.amount || 0,
        missing: !dateOk ? (hasCoOwner ? 'date' : 'date+co-owner') : 'co-owner',
      });
    }
  }

  const missingRank = {
    'renewal-type': 0,
    'renewal-type-pending': 1,
    'date+co-owner': 2,
    'date': 3,
    'co-owner': 4,
  };
  needsAttention.sort((a, b) => {
    const r = (missingRank[a.missing] ?? 99) - (missingRank[b.missing] ?? 99);
    if (r !== 0) return r;
    return (b.amount || 0) - (a.amount || 0);
  });

  return {
    total: licenses.length,
    readyToFire,
    withCoOwners,
    withRealDate: buckets.parseable.count,
    intentionallySilent,
    needsClassification,
    buckets: Object.values(buckets).sort((a, b) => b.count - a.count),
    needsAttention,
    generatedAt: new Date().toISOString(),
  };
}
