const COLUMN_TITLE_ALIASES = {
  amount: ['Amount', 'Price', 'Cost', 'Annual Cost', 'Monthly Cost', 'Spend', 'Cost Amount'],
  length: ['Length', 'Term', 'Contract Length', 'Contract Term', 'Billing Cycle', 'Frequency'],
  renewalMethod: ['Renewal Method', 'Payment Method', 'Payment Type', 'Billing Method', 'Payment'],
  renewalDate: ['Renewal Date', 'Renew Date', 'Next Renewal', 'Renews On', 'Expiration Date', 'Expiry Date', 'End Date', 'Contract End'],
  seats: ['Seats', 'Licenses', 'Seat Count', 'License Count', 'Quantity', 'Qty'],
  useCase: ['Use Case', 'Usecase', 'Purpose', 'Description', 'Business Use', 'Function'],
};

function normalizeColumnTitle(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function findColumn(columns, columnId) {
  if (!columnId) return null;
  const idStr = String(columnId);
  return columns.find((column) => String(column.id) === idStr) || null;
}

function resolveColumn(columns, fieldKey, preferredColumnIds = {}) {
  const preferredId = String(preferredColumnIds[fieldKey] || '').trim();
  const preferred = findColumn(columns, preferredId);
  if (preferred) return preferred;

  const aliases = COLUMN_TITLE_ALIASES[fieldKey] || [];
  const byNormalizedTitle = new Map(
    columns.map((column) => [normalizeColumnTitle(column.title), column]),
  );

  for (const alias of aliases) {
    const match = byNormalizedTitle.get(normalizeColumnTitle(alias));
    if (match) return match;
  }

  return null;
}

function sanitizeStringValue(value) {
  const sanitized = String(value ?? '').trim();
  return sanitized ? sanitized : null;
}

function parseNumericString(value) {
  const cleaned = String(value ?? '').replace(/[$,\s]/g, '').trim();
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function formatMondayDate(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatValueForColumnType(columnType, rawValue) {
  const type = String(columnType || '').toLowerCase();

  if (type === 'numbers' || type === 'numeric' || type === 'number') {
    const num = parseNumericString(rawValue);
    return num == null ? null : String(num);
  }

  if (type === 'date') {
    const formatted = formatMondayDate(rawValue);
    return formatted == null ? null : { date: formatted };
  }

  if (type === 'status' || type === 'color') {
    const label = sanitizeStringValue(rawValue);
    return label == null ? null : { label };
  }

  if (type === 'dropdown') {
    const label = sanitizeStringValue(rawValue);
    return label == null ? null : { labels: [label] };
  }

  if (type === 'long_text' || type === 'long-text' || type === 'longtext') {
    const text = sanitizeStringValue(rawValue);
    return text == null ? null : { text };
  }

  // text, unknown, or missing type: plain string fallback.
  return sanitizeStringValue(rawValue);
}

const FIELD_ORDER = [
  ['amount', (updates) => (updates.amount == null ? null : updates.amount)],
  ['length', (updates) => updates.length],
  ['renewalMethod', (updates) => updates.renewalMethod],
  ['renewalDate', (updates) => updates.renewalDate],
  ['seats', (updates) => updates.seats],
  ['useCase', (updates) => updates.useCase],
];

export function buildMondayColumnValuesPayload(columns, updates, preferredColumnIds = {}) {
  const payload = {};

  for (const [fieldKey, getRaw] of FIELD_ORDER) {
    const rawValue = getRaw(updates);
    if (rawValue == null || String(rawValue).trim() === '') continue;

    const column = resolveColumn(columns, fieldKey, preferredColumnIds);
    if (!column) continue;

    const formatted = formatValueForColumnType(column.type, rawValue);
    if (formatted == null) continue;

    payload[String(column.id)] = formatted;
  }

  return payload;
}
