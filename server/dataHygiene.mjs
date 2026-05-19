//
// Data-hygiene audit for the renewal-reminder pipeline.
//
// A license can fire a reminder only when BOTH:
//   1. It resolves to a real renewal date — renewalClass 'dated' or 'projected'
//   2. It has at least one co-owner with a usable email
//
// The renewal date itself is classified once, upstream, by
// server/renewalClassifier.mjs — this module consumes `license.renewalClass`
// instead of re-parsing the date text. It groups every license against the
// two firing requirements so the Settings UI can show "X of Y records are
// ready to fire" plus a drill-down of the records still missing data.
//

import { classifyRenewal } from './renewalClassifier.mjs';

// One bucket per renewalClass. `label` / `severity` drive the Settings chips.
const CLASS_META = {
  dated: { label: 'Has a real renewal date', severity: 'good' },
  projected: { label: 'Projected from contract term', severity: 'good' },
  'undated-by-design': { label: 'Renews on a cycle (no fixed date)', severity: 'neutral' },
};

function coOwnerEmailCount(license) {
  let count = 0;
  for (const coOwner of license.coOwners || []) {
    const email = String(coOwner?.email || '').trim();
    if (email.includes('@')) count += 1;
  }
  return count;
}

// Prefer the classification the proxy already attached. Fall back to running
// the classifier here for legacy / hand-built records that lack `renewalClass`.
function resolveRenewalClass(license) {
  if (license.renewalClass && CLASS_META[license.renewalClass]) {
    return license.renewalClass;
  }
  return classifyRenewal({
    renewalType: license.renewalType,
    rawDate: license.renewalDate,
    length: license.length,
  }).renewalClass;
}

/**
 * Audit a list of licenses and return a structured hygiene report.
 * @param {Array<object>} licenses
 */
export function auditDataHygiene(licenses) {
  const buckets = {};
  for (const key of Object.keys(CLASS_META)) {
    buckets[key] = {
      key,
      label: CLASS_META[key].label,
      severity: CLASS_META[key].severity,
      count: 0,
      sampleIds: [],
    };
  }

  let withCoOwners = 0;
  let readyToFire = 0;
  let intentionallySilent = 0;
  const needsAttention = [];

  for (const license of licenses) {
    const renewalClass = resolveRenewalClass(license);
    const bucket = buckets[renewalClass] || buckets['undated-by-design'];
    bucket.count += 1;
    if (bucket.sampleIds.length < 5) bucket.sampleIds.push(license.id);

    const coOwnerCount = coOwnerEmailCount(license);
    const hasCoOwner = coOwnerCount > 0;
    if (hasCoOwner) withCoOwners += 1;

    // Undated by design — renews on a cycle, correctly has no reminders.
    if (renewalClass === 'undated-by-design') {
      intentionallySilent += 1;
      continue;
    }

    // dated / projected — has a date; fires only if it also has a co-owner.
    if (hasCoOwner) {
      readyToFire += 1;
    } else {
      needsAttention.push({
        id: license.id,
        application: license.application || 'Unnamed',
        department: license.department || '',
        renewalDate: license.renewalDate || '',
        dateBucket: renewalClass,
        dateBucketLabel: CLASS_META[renewalClass]?.label || '',
        hasCoOwner,
        coOwnerCount,
        amount: license.amount || 0,
        missing: 'co-owner',
      });
    }
  }

  // Most expensive gaps first.
  needsAttention.sort((a, b) => (b.amount || 0) - (a.amount || 0));

  return {
    total: licenses.length,
    readyToFire,
    withCoOwners,
    withRealDate: buckets.dated.count + buckets.projected.count,
    intentionallySilent,
    buckets: Object.values(buckets).sort((a, b) => b.count - a.count),
    needsAttention,
    generatedAt: new Date().toISOString(),
  };
}
