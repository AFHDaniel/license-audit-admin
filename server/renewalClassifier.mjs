//
// Canonical renewal-date classifier — the single source of truth for turning
// a Monday record's renewal columns into a usable date plus a classification.
//
// Every license resolves to exactly one renewalClass:
//   - 'dated'              a real, parseable renewal date today or later
//   - 'projected'          a real date that has lapsed, rolled forward by the
//                          contract term to its next occurrence (an annual
//                          contract renews a year on, a quarterly one a
//                          quarter on, and so on)
//   - 'undated-by-design'  no fixed renewal day — it renews on a cycle
//                          (monthly, until-cancelled, externally managed,
//                          one-time). The Length / Term column says which.
//
// There is deliberately no "missing" class. The Monday Length column always
// carries the term, so a record is never short of renewal information: it
// either has a date or renews on a known cycle. This replaces the old
// behaviour where an empty date was stamped the fake sentinel "TBD" and
// unparseable free text ("N/A", "Managed by Cortavo") was passed straight
// through as if it were a date.
//

// Renewal Type values that mean "no fixed renewal date, on purpose". The value
// is the clean label shown in place of a date.
const UNDATED_BY_DESIGN_TYPES = new Map([
  ['Until Cancelled', 'Until cancelled'],
  ['Month-to-month', 'Month-to-month'],
  ['Externally Managed', 'Externally managed'],
  ['One-time', 'One-time purchase'],
]);

// Free-text renewal-date values that themselves signal "no fixed date". Used
// only as a fallback for legacy rows whose Renewal Type column is still blank.
const UNDATED_BY_DESIGN_TEXT = [
  { test: /until cancel/i, label: 'Until cancelled' },
  { test: /managed by|externally managed/i, label: 'Externally managed' },
  { test: /month[\s-]?to[\s-]?month/i, label: 'Month-to-month' },
  { test: /\b(ongoing|continuous)\b/i, label: 'Ongoing' },
  { test: /^\s*(n\/?a|not applicable|none)\s*$/i, label: 'Not applicable' },
];

// Parse a renewal-date string into a Date, or null when it isn't a date.
// YYYY-MM-DD is parsed as a local date so it doesn't shift a day across zones.
export function parseRenewalDate(value) {
  if (!value) return null;
  const str = String(value).trim();
  if (!str) return null;
  const ymd = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    const [, y, m, d] = ymd;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  const parsed = new Date(str);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDisplay(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

// Months in one renewal cycle, inferred from the Length / Term text.
// Returns null when the term can't be read as a fixed cadence.
export function cadenceMonthsFromLength(length) {
  const norm = String(length || '').trim().toLowerCase();
  if (!norm) return null;
  if (/(quarter|qtr|every\s*3\s*months?)/.test(norm)) return 3;
  if (/(multi[\s-]?year|3\s*year|36\s*months?)/.test(norm)) return 36;
  if (/(annual|yearly|per\s*year|12\s*months?)/.test(norm)) return 12;
  if (/(monthly|per\s*month|month[\s-]?to[\s-]?month)/.test(norm)) return 1;
  if (/^\d+$/.test(norm)) {
    const n = Number(norm);
    if (n === 1 || n === 3 || n === 12 || n === 36) return n;
  }
  return null;
}

// Roll a lapsed date forward by whole cadence cycles until it lands today or
// later. Returns null when the term gives no usable cadence.
function projectForward(date, length, today) {
  const months = cadenceMonthsFromLength(length);
  if (!months) return null;
  const next = new Date(date.getTime());
  let guard = 0;
  while (startOfDay(next) < today && guard < 600) {
    next.setMonth(next.getMonth() + months);
    guard += 1;
  }
  return next;
}

/**
 * Classify a record's renewal columns.
 * @param {{ renewalType?: string, rawDate?: string, length?: string, now?: Date }} input
 * @returns {{ renewalClass: 'dated'|'projected'|'undated-by-design',
 *             renewalDateISO: string|null, renewalDateDisplay: string }}
 */
export function classifyRenewal({ renewalType, rawDate, length, now = new Date() } = {}) {
  const type = String(renewalType || '').trim();
  const raw = String(rawDate || '').trim();
  const today = startOfDay(now);

  // 1. The Renewal Type column explicitly says there is no fixed renewal date.
  if (UNDATED_BY_DESIGN_TYPES.has(type)) {
    return {
      renewalClass: 'undated-by-design',
      renewalDateISO: null,
      renewalDateDisplay: UNDATED_BY_DESIGN_TYPES.get(type),
    };
  }

  const parsed = parseRenewalDate(raw);

  // 2. No parseable date — the record renews on a cycle, not a fixed day.
  if (!parsed) {
    // Legacy rows with a blank Renewal Type but free text that itself reads
    // "until cancelled" / "managed by X" / "n/a" are undated by design.
    for (const { test, label } of UNDATED_BY_DESIGN_TEXT) {
      if (test.test(raw)) {
        return { renewalClass: 'undated-by-design', renewalDateISO: null, renewalDateDisplay: label };
      }
    }
    // No fixed renewal day. The term (Monthly / Annually / ...) is the
    // renewal information — show that rather than inventing a missing flag.
    return {
      renewalClass: 'undated-by-design',
      renewalDateISO: null,
      renewalDateDisplay: String(length || '').trim(),
    };
  }

  // 3. A real date that is today or still in the future.
  if (startOfDay(parsed) >= today) {
    return {
      renewalClass: 'dated',
      renewalDateISO: toISO(parsed),
      renewalDateDisplay: formatDisplay(parsed),
    };
  }

  // 4. A real date that has lapsed — roll it forward by the contract term.
  const projected = projectForward(parsed, length, today);
  if (projected) {
    return {
      renewalClass: 'projected',
      renewalDateISO: toISO(projected),
      renewalDateDisplay: formatDisplay(projected),
    };
  }

  // 5. A lapsed date with no usable term — keep the real (overdue) date.
  return {
    renewalClass: 'dated',
    renewalDateISO: toISO(parsed),
    renewalDateDisplay: formatDisplay(parsed),
  };
}
