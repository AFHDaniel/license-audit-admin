import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildMondayColumnValuesPayload } from './mondayWriteback.mjs';
import { EmailClient } from '@azure/communication-email';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DIST_DIR = join(__dirname, '..', 'dist');
const SERVE_STATIC = process.env.NODE_ENV === 'production';

const STATIC_MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.otf': 'font/otf',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
};

async function serveStaticFile(res, pathname) {
  const safePath = pathname.replace(/\.\./g, '');
  const filePath = join(DIST_DIR, safePath);

  try {
    const info = await stat(filePath);
    if (!info.isFile()) return false;

    const ext = extname(filePath);
    const mime = STATIC_MIME[ext] || 'application/octet-stream';
    const content = await readFile(filePath);

    res.setHeader('Content-Type', mime);
    if (ext !== '.html') {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      res.setHeader('Cache-Control', 'no-cache');
    }
    res.statusCode = 200;
    res.end(content);
    return true;
  } catch {
    return false;
  }
}

const PORT = Number(process.env.MONDAY_PROXY_PORT || 8787);
const MONDAY_API_URL = process.env.MONDAY_API_URL || 'https://api.monday.com/v2';
const MONDAY_API_TOKEN = process.env.MONDAY_API_TOKEN || '';
const MONDAY_CACHE_TTL_MS = Math.max(0, Number(process.env.MONDAY_CACHE_TTL_MS || 35000));
const DEFAULT_BOARD_DEPARTMENT_MAP = {
  '1000000001': 'IT',
  '1000000002': 'Accounting',
  '1000000003': 'Marketing',
  '1000000004': 'Operations',
  '1000000005': 'Listings',
  '1000000006': 'Relocations',
  '1000000007': 'Admin',
  '1000000008': 'Property Management',
  '1000000009': 'HR',
};
const DEFAULT_BOARD_IDS = Object.keys(DEFAULT_BOARD_DEPARTMENT_MAP);
const MONDAY_BOARD_ID = process.env.MONDAY_BOARD_ID || DEFAULT_BOARD_IDS[0];
const MONDAY_BOARD_IDS = (
  process.env.MONDAY_BOARD_IDS ||
  (process.env.MONDAY_BOARD_ID ? MONDAY_BOARD_ID : DEFAULT_BOARD_IDS.join(','))
)
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);

function parseJsonEnv(value, fallback) {
  if (!value || !String(value).trim()) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
}

// Merge user overrides on top of the project defaults so departments remain tagged as more boards are added.
const BOARD_DEPARTMENT_MAP = {
  ...DEFAULT_BOARD_DEPARTMENT_MAP,
  ...parseJsonEnv(process.env.MONDAY_BOARD_DEPARTMENT_MAP, {}),
};

const COLUMN_ID_MAP = {
  amount: process.env.MONDAY_AMOUNT_COLUMN_ID || 'numeric_mkzv7frm',
  length: process.env.MONDAY_LENGTH_COLUMN_ID || 'text_mkzvze3c',
  renewalMethod: process.env.MONDAY_RENEWAL_METHOD_COLUMN_ID || 'text_mkzv6trx',
  renewalDate: process.env.MONDAY_RENEWAL_DATE_COLUMN_ID || 'text_mkzvze62',
  seats: process.env.MONDAY_SEATS_COLUMN_ID || 'text_mm02ecnv',
  useCase: process.env.MONDAY_USE_CASE_COLUMN_ID || 'text_mkzv7n7',
  coOwners: process.env.MONDAY_CO_OWNERS_COLUMN_ID || '',
};

const COLUMN_TITLE_ALIASES = {
  amount: ['Amount', 'Price', 'Cost', 'Annual Cost', 'Monthly Cost', 'Spend', 'Cost Amount'],
  length: ['Length', 'Term', 'Contract Length', 'Contract Term', 'Billing Cycle', 'Frequency'],
  renewalMethod: ['Renewal Method', 'Payment Method', 'Payment Type', 'Billing Method', 'Payment'],
  renewalDate: ['Renewal Date', 'Renew Date', 'Next Renewal', 'Renews On', 'Expiration Date', 'Expiry Date', 'End Date', 'Contract End'],
  seats: ['Seats', 'Licenses', 'Seat Count', 'License Count', 'Quantity', 'Qty'],
  useCase: ['Use Case', 'Usecase', 'Purpose', 'Description', 'Business Use', 'Function'],
  coOwners: ['Co-Owners', 'Co Owners', 'Owners', 'Owner', 'Other Owners', 'Other Owner', 'Shared Owners', 'Managers', 'Application Owners'],
};

const BOARD_ITEMS_QUERY = `
  query GetBoardItems($boardIds: [ID!]) {
    boards(ids: $boardIds) {
      id
      name
      items_page(limit: 100) {
        items {
          id
          name
          board {
            id
            name
          }
          column_values {
            id
            type
            text
            value
            column {
              title
            }
          }
          subitems {
            id
            name
            board {
              id
              name
            }
            column_values {
              id
              type
              text
              value
              column {
                title
              }
            }
          }
        }
      }
    }
  }
`;

const USERS_BY_IDS_QUERY = `
  query GetUsersByIds($userIds: [ID!]) {
    users(ids: $userIds) {
      id
      name
      email
    }
  }
`;

const BOARD_COLUMNS_QUERY = `
  query GetBoardColumns($boardIds: [ID!]) {
    boards(ids: $boardIds) {
      id
      columns {
        id
        title
        type
      }
    }
  }
`;

const UPDATE_ITEM_COLUMNS_MUTATION = `
  mutation UpdateItemColumns($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
    change_multiple_column_values(
      board_id: $boardId
      item_id: $itemId
      column_values: $columnValues
    ) {
      id
    }
  }
`;

const SINGLE_ITEM_QUERY = `
  query GetSingleItem($itemIds: [ID!]) {
    items(ids: $itemIds) {
      id
      name
      parent_item {
        id
        name
      }
      board {
        id
        name
      }
      column_values {
        id
        type
        text
        value
        column {
          title
        }
      }
      subitems {
        id
        name
        board {
          id
          name
        }
        column_values {
          id
          type
          text
          value
          column {
            title
          }
        }
      }
    }
  }
`;

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function sendJson(res, statusCode, payload) {
  setCors(res);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return null;
  }

  const raw = Buffer.concat(chunks).toString('utf-8');
  if (!raw) {
    return null;
  }

  return JSON.parse(raw);
}

async function mondayRequest(query, variables = {}) {
  if (!MONDAY_API_TOKEN) {
    throw new Error('MONDAY_API_TOKEN is not set on the proxy server.');
  }

  const response = await fetch(MONDAY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: MONDAY_API_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error_message || `Monday API request failed (${response.status})`);
  }

  if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
    const message = payload.errors.map((err) => err.message).filter(Boolean).join('; ');
    throw new Error(message || 'Monday API returned GraphQL errors.');
  }

  return payload.data;
}

function parseMaybeJson(value) {
  if (value == null || value === '') {
    return null;
  }

  if (typeof value === 'object') {
    return value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeName(value) {
  return String(value || '').trim();
}

function normalizeColumnTitle(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function columnsById(columnValues = []) {
  return columnValues.reduce((acc, column) => {
    const entry = {
      id: column.id,
      type: column.type || '',
      text: column.text || '',
      value: parseMaybeJson(column.value),
      title: column?.column?.title || '',
    };

    acc.byId[column.id] = entry;

    const normalizedTitle = normalizeColumnTitle(entry.title);
    if (normalizedTitle && !acc.byTitle[normalizedTitle]) {
      acc.byTitle[normalizedTitle] = entry;
    }

    return acc;
  }, { byId: {}, byTitle: {} });
}

function parseAmount(value) {
  if (!value) {
    return 0;
  }
  const cleaned = String(value).replace(/[^0-9.-]/g, '');
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDateLike(value) {
  if (!value) {
    return null;
  }

  const str = String(value).trim();
  if (!str) {
    return null;
  }

  // Monday date fields are often YYYY-MM-DD; parse as local date to avoid timezone day shifts.
  const ymdMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymdMatch) {
    const [, y, m, d] = ymdMatch;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }

  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function formatDateDisplay(value) {
  if (!value) {
    return 'TBD';
  }

  const date = parseDateLike(value);
  if (!date) {
    return value;
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
}

function daysUntil(value) {
  if (!value) {
    return null;
  }

  const date = parseDateLike(value);
  if (!date) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((date.getTime() - today.getTime()) / msPerDay);
}

function deriveRisk(daysRemaining) {
  if (daysRemaining == null) {
    return 'Low Risk';
  }
  if (daysRemaining < 0) {
    return 'High Risk';
  }
  if (daysRemaining <= 30) {
    return 'High Risk';
  }
  if (daysRemaining <= 90) {
    return 'Medium Risk';
  }
  return 'Low Risk';
}

function deriveStatus(daysRemaining, seats) {
  if (daysRemaining != null && daysRemaining <= 30) {
    return 'Warning';
  }
  if (typeof seats === 'string' && /unlimited/i.test(seats)) {
    return 'Healthy';
  }
  return 'Healthy';
}

function deriveProgress(daysRemaining) {
  if (daysRemaining == null) {
    return 40;
  }
  if (daysRemaining < 0) {
    return 100;
  }
  if (daysRemaining <= 30) {
    return 95;
  }
  if (daysRemaining <= 90) {
    return 72;
  }
  if (daysRemaining <= 180) {
    return 55;
  }
  return 30;
}

function normalizeRenewalMethod(value) {
  const normalized = String(value || '').trim().toLowerCase();

  if (!normalized) {
    return 'Manual';
  }

  if (/(^|\b)(cc|credit card)(\b|$)/i.test(normalized)) {
    return 'Credit Card';
  }

  if (/(^|\b)ach(\b|$)/i.test(normalized)) {
    return 'ACH';
  }

  if (/(invoice|wire|check|bill|net\s*\d+)/i.test(normalized)) {
    return 'Manual';
  }

  if (
    /(auto|automatic|autopay|auto-pay|auto renew|auto-renew|recurring)/i.test(normalized) ||
    ['yes', 'true', 'checked', 'enabled', '1', 'on'].includes(normalized) ||
    /(manual|manually|no auto)/i.test(normalized) ||
    ['no', 'false', 'unchecked', 'disabled', '0', 'off'].includes(normalized)
  ) {
    return 'Manual';
  }

  return 'Manual';
}

function deriveDepartment(useCase, application) {
  const haystack = `${useCase || ''} ${application || ''}`.toLowerCase();

  if (/(infra|cloud|devops|monitor|engineer)/.test(haystack)) return 'Engineering';
  if (/(design|creative|brand|marketing)/.test(haystack)) return 'Marketing';
  if (/(sales|crm|pipeline)/.test(haystack)) return 'Sales';
  if (/(hr|recruit|people)/.test(haystack)) return 'HR';
  return 'Operations';
}

function getBoardDepartment(boardId, fallbackDepartment) {
  const mapped = BOARD_DEPARTMENT_MAP[String(boardId)];
  if (typeof mapped === 'string' && mapped.trim()) {
    return mapped.trim();
  }
  return fallbackDepartment;
}

function deriveVendor(application) {
  if (!application) return 'Unknown';
  const normalized = application.trim();
  if (!normalized) return 'Unknown';
  return normalized.split(/\s+/)[0];
}

function getColumn(columns, id) {
  return columns?.byId?.[id] || null;
}

function getColumnByTitle(columns, possibleTitles = []) {
  for (const title of possibleTitles) {
    const normalized = normalizeColumnTitle(title);
    if (!normalized) continue;

    const column = columns?.byTitle?.[normalized];
    if (column) {
      return column;
    }
  }

  return null;
}

function getMappedColumn(columns, fieldKey) {
  return (
    (COLUMN_ID_MAP[fieldKey] ? getColumn(columns, COLUMN_ID_MAP[fieldKey]) : null) ||
    getColumnByTitle(columns, COLUMN_TITLE_ALIASES[fieldKey] || [])
  );
}

function parseNamesFromColumnText(text) {
  return String(text || '')
    .split(',')
    .map((part) => normalizeName(part))
    .filter(Boolean);
}

function uniqueCoOwners(coOwners = []) {
  const seen = new Set();
  const result = [];

  for (const coOwner of coOwners) {
    const name = normalizeName(coOwner?.name);
    const email = normalizeEmail(coOwner?.email);
    const dedupeKey = email || `name:${name.toLowerCase()}`;
    if (!dedupeKey || seen.has(dedupeKey)) continue;

    seen.add(dedupeKey);
    result.push({ name, email });
  }

  return result;
}

function mergeCoOwners(a = [], b = []) {
  return uniqueCoOwners([...(a || []), ...(b || [])]);
}

function readPeopleEntries(value) {
  if (!value || typeof value !== 'object') return [];

  if (Array.isArray(value.personsAndTeams)) return value.personsAndTeams;
  if (Array.isArray(value.persons_and_teams)) return value.persons_and_teams;

  return [];
}

function collectCoOwnerUserIds(column) {
  if (!column) return [];

  const ids = [];
  for (const person of readPeopleEntries(column.value)) {
    const kind = String(person?.kind || '').trim().toLowerCase();
    const id = String(person?.id || '').trim();
    if (id && (!kind || kind === 'person' || kind === 'user')) {
      ids.push(id);
    }
  }

  return ids;
}

function resolveCoOwnersFromColumn(column, mondayUsersById) {
  if (!column) return [];

  const namesFromText = parseNamesFromColumnText(column.text);
  const resolved = [];

  for (const person of readPeopleEntries(column.value)) {
    const id = String(person?.id || '').trim();
    const kind = String(person?.kind || '').trim().toLowerCase();
    if (kind && kind !== 'person' && kind !== 'user') {
      continue;
    }

    const directName = normalizeName(
      typeof person?.name === 'string'
        ? person.name
        : typeof person?.display_name === 'string'
          ? person.display_name
          : '',
    );
    const directEmail = normalizeEmail(
      typeof person?.email === 'string'
        ? person.email
        : typeof person?.user_email === 'string'
          ? person.user_email
          : '',
    );
    const mondayUser = id ? mondayUsersById.get(id) : null;

    resolved.push({
      name: directName || mondayUser?.name || '',
      email: directEmail || mondayUser?.email || '',
    });
  }

  if (resolved.length > 0) {
    return uniqueCoOwners(resolved);
  }

  return uniqueCoOwners(
    namesFromText.map((name) => ({
      name,
      email: '',
    })),
  );
}

function readNestedLabel(value) {
  if (!value || typeof value !== 'object') {
    return '';
  }

  if (typeof value.label === 'string') {
    return value.label;
  }

  if (value.label && typeof value.label === 'object' && typeof value.label.text === 'string') {
    return value.label.text;
  }

  if (Array.isArray(value.labels)) {
    const labels = value.labels
      .map((label) => {
        if (typeof label === 'string') return label;
        if (label && typeof label === 'object') {
          if (typeof label.text === 'string') return label.text;
          if (typeof label.label === 'string') return label.label;
        }
        return '';
      })
      .filter(Boolean);

    if (labels.length > 0) {
      return labels.join(', ');
    }
  }

  return '';
}

function getColumnText(columns, id) {
  const column = getColumn(columns, id);
  if (!column) {
    return '';
  }

  if (typeof column.text === 'string' && column.text.trim()) {
    return column.text.trim();
  }

  const raw = column.value;
  if (typeof raw === 'string') {
    return raw.trim();
  }

  if (typeof raw === 'number') {
    return String(raw);
  }

  if (typeof raw === 'boolean') {
    return raw ? 'true' : 'false';
  }

  if (raw && typeof raw === 'object') {
    const label = readNestedLabel(raw);
    if (label) return label;

    if (typeof raw.text === 'string' && raw.text.trim()) return raw.text.trim();
    if (typeof raw.index === 'number') return String(raw.index);
    if (typeof raw.number === 'string' || typeof raw.number === 'number') return String(raw.number);
    if (typeof raw.value === 'string' || typeof raw.value === 'number') return String(raw.value);
    if (typeof raw.checked === 'boolean') return raw.checked ? 'true' : 'false';
    if (typeof raw.date === 'string') return raw.date;
    if (typeof raw.from === 'string' && typeof raw.to === 'string') {
      return `${formatDateDisplay(raw.from)} - ${formatDateDisplay(raw.to)}`;
    }
  }

  return '';
}

function getAmount(columns) {
  const column = getMappedColumn(columns, 'amount');
  if (!column) {
    return 0;
  }

  const raw = column.value;
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : 0;
  }

  if (typeof raw === 'string') {
    return parseAmount(raw);
  }

  if (raw && typeof raw === 'object') {
    if (typeof raw.number === 'number') return raw.number;
    if (typeof raw.number === 'string') return parseAmount(raw.number);
    if (typeof raw.value === 'number') return raw.value;
    if (typeof raw.value === 'string') return parseAmount(raw.value);
    if (typeof raw.amount === 'number') return raw.amount;
    if (typeof raw.amount === 'string') return parseAmount(raw.amount);
  }

  return parseAmount(column.text);
}

function getRenewalDateRaw(columns) {
  const column = getMappedColumn(columns, 'renewalDate');
  if (!column) {
    return '';
  }

  const raw = column.value;
  if (typeof raw === 'string') {
    return raw.trim();
  }

  if (raw && typeof raw === 'object') {
    if (typeof raw.date === 'string' && raw.date) return raw.date;
    if (typeof raw.from === 'string' && raw.from) return raw.from;
    if (typeof raw.value === 'string' && raw.value) return raw.value;
  }

  return (column.text || '').trim();
}

function normalizeLengthText(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return '';
  }

  // Common Monday numbers formatting for whole values can come through as "12.0"
  if (/^-?\d+\.0+$/.test(trimmed)) {
    return String(Number(trimmed));
  }

  return trimmed;
}

function getLengthText(columns) {
  const column = getMappedColumn(columns, 'length');
  if (!column) {
    return 'Unknown';
  }

  const directText = normalizeLengthText(column.text);
  if (directText) {
    return directText;
  }

  const raw = column.value;
  if (typeof raw === 'number') {
    return normalizeLengthText(raw);
  }

  if (raw && typeof raw === 'object') {
    const label = readNestedLabel(raw);
    if (label) {
      return label;
    }

    if (typeof raw.number === 'number' || typeof raw.number === 'string') {
      return normalizeLengthText(raw.number);
    }

    if ((typeof raw.duration === 'number' || typeof raw.duration === 'string')) {
      const duration = normalizeLengthText(raw.duration);
      const unit = typeof raw.unit === 'string' ? ` ${raw.unit}` : '';
      return `${duration}${unit}`.trim();
    }

    if (typeof raw.date === 'string') {
      return formatDateDisplay(raw.date);
    }

    if (typeof raw.from === 'string' && typeof raw.to === 'string') {
      return `${formatDateDisplay(raw.from)} - ${formatDateDisplay(raw.to)}`;
    }
  }

  if (typeof raw === 'string' && raw.trim()) {
    return normalizeLengthText(raw);
  }

  return 'Unknown';
}

async function getMondayUsersByIds(userIds = []) {
  const normalizedIds = Array.from(new Set(
    userIds
      .map((id) => String(id || '').trim())
      .filter(Boolean),
  ));

  if (normalizedIds.length === 0) {
    return new Map();
  }

  const usersById = new Map();
  const chunkSize = 50;

  for (let i = 0; i < normalizedIds.length; i += chunkSize) {
    const chunk = normalizedIds.slice(i, i + chunkSize);
    const data = await mondayRequest(USERS_BY_IDS_QUERY, {
      userIds: chunk,
    });

    for (const user of data?.users || []) {
      usersById.set(String(user.id), {
        id: String(user.id),
        name: normalizeName(user.name),
        email: normalizeEmail(user.email),
      });
    }
  }

  return usersById;
}

async function getBoardColumns(boardId) {
  const data = await mondayRequest(BOARD_COLUMNS_QUERY, {
    boardIds: [String(boardId)],
  });

  return data?.boards?.[0]?.columns || [];
}

async function fetchSingleLicense(itemId, { sourceBoardId = '', sourceBoardName = '', departmentOverride = null } = {}) {
  const data = await mondayRequest(SINGLE_ITEM_QUERY, {
    itemIds: [String(itemId)],
  });

  const item = data?.items?.[0];
  if (!item) return null;

  const coOwnerUserIds = new Set();
  const itemColumns = columnsById(item.column_values);
  for (const userId of collectCoOwnerUserIds(getMappedColumn(itemColumns, 'coOwners'))) {
    coOwnerUserIds.add(userId);
  }
  for (const subitem of item.subitems || []) {
    const subitemColumns = columnsById(subitem.column_values);
    for (const userId of collectCoOwnerUserIds(getMappedColumn(subitemColumns, 'coOwners'))) {
      coOwnerUserIds.add(userId);
    }
  }

  const mondayUsersById = await getMondayUsersByIds(Array.from(coOwnerUserIds));

  const parentItem = item.parent_item || null;
  const isSubitem = Boolean(parentItem);
  const resolvedSourceBoardId = sourceBoardId || String(item?.board?.id || '');
  const resolvedSourceBoardName = sourceBoardName || String(item?.board?.name || '');

  return mapMondayItem(item, {
    parentItemName: parentItem?.name || null,
    parentItemId: parentItem?.id || null,
    sourceBoardId: resolvedSourceBoardId,
    sourceBoardName: resolvedSourceBoardName,
    recordBoardId: String(item?.board?.id || resolvedSourceBoardId),
    recordBoardName: item?.board?.name || resolvedSourceBoardName,
    recordKind: isSubitem ? 'subitem' : 'item',
    departmentOverride,
    mondayUsersById,
  });
}

function replaceLicenseInCache(updatedLicense) {
  if (!updatedLicense || !licensesCache.payload) return;
  const id = String(updatedLicense.id);
  const existing = licensesCache.payload.licenses || [];
  let replaced = false;
  const nextLicenses = existing.map((license) => {
    if (String(license.id) === id) {
      replaced = true;
      return updatedLicense;
    }
    return license;
  });
  if (!replaced) {
    nextLicenses.push(updatedLicense);
  }
  licensesCache.payload = {
    ...licensesCache.payload,
    licenses: nextLicenses,
  };
}

async function updateLicenseRenewal(itemId, boardId, updates) {
  const resolvedItemId = String(itemId || '').trim();
  const resolvedBoardId = String(boardId || '').trim();

  if (!resolvedItemId) {
    throw new Error('A license item id is required for write-back.');
  }

  if (!resolvedBoardId) {
    throw new Error('A Monday board id is required for write-back.');
  }

  const boardColumns = await getBoardColumns(resolvedBoardId);
  const columnValues = buildMondayColumnValuesPayload(boardColumns, updates, COLUMN_ID_MAP);

  if (Object.keys(columnValues).length === 0) {
    throw new Error('No writable renewal fields were provided or matched on this board.');
  }

  console.log(`[writeback] item=${resolvedItemId} board=${resolvedBoardId} fields=${Object.keys(columnValues).join(',')}`);

  await mondayRequest(UPDATE_ITEM_COLUMNS_MUTATION, {
    boardId: resolvedBoardId,
    itemId: resolvedItemId,
    columnValues: JSON.stringify(columnValues),
  });

  const previousLicense = (licensesCache.payload?.licenses || []).find(
    (license) => String(license.id) === resolvedItemId,
  );

  const updatedLicense = await fetchSingleLicense(resolvedItemId, {
    sourceBoardId: previousLicense?.sourceBoardId || '',
    sourceBoardName: previousLicense?.sourceBoardName || '',
    departmentOverride: previousLicense?.department || null,
  });

  if (updatedLicense) {
    replaceLicenseInCache(updatedLicense);
  }

  return {
    ok: true,
    updated: updatedLicense,
  };
}

function mapMondayItem(item, options = {}) {
  const {
    parentItemName = null,
    parentItemId = null,
    sourceBoardId = '',
    sourceBoardName = '',
    recordBoardId = '',
    recordBoardName = '',
    recordKind = 'item',
    departmentOverride = null,
    mondayUsersById = new Map(),
  } = options;
  const columns = columnsById(item.column_values);
  const applicationName = parentItemName ? `${parentItemName} / ${item.name}` : item.name;
  const amount = getAmount(columns);
  const renewalText = getRenewalDateRaw(columns);
  const daysRemaining = daysUntil(renewalText);
  const riskLevel = deriveRisk(daysRemaining);
  const seatsColumn = getMappedColumn(columns, 'seats');
  const useCaseColumn = getMappedColumn(columns, 'useCase');
  const renewalMethodColumn = getMappedColumn(columns, 'renewalMethod');
  const seats = (seatsColumn ? getColumnText(columns, seatsColumn.id) : '') || 'N/A';
  const useCase = (useCaseColumn ? getColumnText(columns, useCaseColumn.id) : '') || 'General';
  const derivedDepartment = deriveDepartment(useCase, applicationName);
  const department = getBoardDepartment(sourceBoardId, departmentOverride || derivedDepartment);
  const coOwners = resolveCoOwnersFromColumn(getMappedColumn(columns, 'coOwners'), mondayUsersById);

  return {
    id: String(item.id),
    application: applicationName || 'Untitled',
    vendor: deriveVendor(applicationName),
    amount,
    length: getLengthText(columns),
    renewalMethod: normalizeRenewalMethod(renewalMethodColumn ? getColumnText(columns, renewalMethodColumn.id) : ''),
    renewalDate: formatDateDisplay(renewalText),
    seats,
    useCase,
    progress: deriveProgress(daysRemaining),
    department,
    sourceBoardId: String(sourceBoardId || ''),
    sourceBoardName: sourceBoardName || '',
    recordBoardId: String(recordBoardId || sourceBoardId || ''),
    recordBoardName: recordBoardName || sourceBoardName || '',
    recordKind,
    parentItemId: parentItemId ? String(parentItemId) : undefined,
    coOwners,
    riskLevel,
    status: deriveStatus(daysRemaining, seats),
  };
}

async function getBoardLicenses() {
  const data = await mondayRequest(BOARD_ITEMS_QUERY, {
    boardIds: MONDAY_BOARD_IDS,
  });

  const boards = data?.boards || [];
  const coOwnerUserIds = new Set();

  for (const board of boards) {
    const items = board?.items_page?.items || [];

    for (const item of items) {
      const itemColumns = columnsById(item.column_values);
      for (const userId of collectCoOwnerUserIds(getMappedColumn(itemColumns, 'coOwners'))) {
        coOwnerUserIds.add(userId);
      }

      for (const subitem of item.subitems || []) {
        const subitemColumns = columnsById(subitem.column_values);
        for (const userId of collectCoOwnerUserIds(getMappedColumn(subitemColumns, 'coOwners'))) {
          coOwnerUserIds.add(userId);
        }
      }
    }
  }

  const mondayUsersById = await getMondayUsersByIds(Array.from(coOwnerUserIds));
  const licenses = [];

  for (const board of boards) {
    const items = board?.items_page?.items || [];
    const boardId = String(board?.id || '');
    const boardName = board?.name || '';

    for (const item of items) {
      licenses.push(
        mapMondayItem(item, {
          sourceBoardId: boardId,
          sourceBoardName: boardName,
          recordBoardId: String(item?.board?.id || boardId),
          recordBoardName: item?.board?.name || boardName,
          recordKind: 'item',
          mondayUsersById,
        }),
      );

      const parentLicense = licenses[licenses.length - 1];
      for (const subitem of item.subitems || []) {
        const subitemLicense = mapMondayItem(subitem, {
          parentItemName: item.name,
          parentItemId: item.id,
          sourceBoardId: boardId,
          sourceBoardName: boardName,
          recordBoardId: String(subitem?.board?.id || boardId),
          recordBoardName: subitem?.board?.name || boardName,
          recordKind: 'subitem',
          mondayUsersById,
        });
        // Subitems inherit their parent's co-owners. Anyone tagged on the parent
        // application gets access to all of its subitems too.
        subitemLicense.coOwners = mergeCoOwners(parentLicense?.coOwners, subitemLicense.coOwners);
        licenses.push(subitemLicense);
      }
    }
  }

  const boardNames = boards.map((board) => board?.name).filter(Boolean);

  return {
    source: 'monday',
    boardName: boardNames.length === 1 ? boardNames[0] : `${boardNames.length} boards`,
    boardNames,
    fetchedAt: new Date().toISOString(),
    licenses,
  };
}

const licensesCache = {
  payload: null,
  syncedAtMs: 0,
  syncPromise: null,
  lastError: null,
};

function isLicensesCacheFresh() {
  if (!licensesCache.payload) {
    return false;
  }

  return Date.now() - licensesCache.syncedAtMs < MONDAY_CACHE_TTL_MS;
}

function mergeLicenseSnapshots(previousLicenses = [], nextLicenses = []) {
  if (!Array.isArray(previousLicenses) || previousLicenses.length === 0) {
    return {
      licenses: nextLicenses,
      diff: {
        added: nextLicenses.length,
        updated: 0,
        removed: 0,
        unchanged: 0,
      },
    };
  }

  const previousById = new Map();
  const previousSerializedById = new Map();

  for (const license of previousLicenses) {
    const id = String(license?.id || '');
    previousById.set(id, license);
    previousSerializedById.set(id, JSON.stringify(license));
  }

  const nextIds = new Set();
  let added = 0;
  let updated = 0;
  let unchanged = 0;

  const mergedLicenses = nextLicenses.map((license) => {
    const id = String(license?.id || '');
    nextIds.add(id);

    const previous = previousById.get(id);
    if (!previous) {
      added += 1;
      return license;
    }

    if (previousSerializedById.get(id) === JSON.stringify(license)) {
      unchanged += 1;
      return previous;
    }

    updated += 1;
    return license;
  });

  let removed = 0;
  for (const license of previousLicenses) {
    if (!nextIds.has(String(license?.id || ''))) {
      removed += 1;
    }
  }

  return {
    licenses: mergedLicenses,
    diff: {
      added,
      updated,
      removed,
      unchanged,
    },
  };
}

async function syncLicensesCache({ reason = 'request' } = {}) {
  if (licensesCache.syncPromise) {
    return licensesCache.syncPromise;
  }

  licensesCache.syncPromise = (async () => {
    const nextPayload = await getBoardLicenses();
    const previousPayload = licensesCache.payload;
    const { licenses, diff } = mergeLicenseSnapshots(previousPayload?.licenses, nextPayload.licenses);

    const mergedPayload = {
      ...nextPayload,
      licenses,
    };

    licensesCache.payload = mergedPayload;
    licensesCache.syncedAtMs = Date.now();
    licensesCache.lastError = null;

    console.log(
      `[monday-proxy] sync (${reason}) -> ${licenses.length} licenses `
      + `[+${diff.added} ~${diff.updated} -${diff.removed} =${diff.unchanged}]`,
    );

    return mergedPayload;
  })()
    .catch((error) => {
      licensesCache.lastError = error;
      throw error;
    })
    .finally(() => {
      licensesCache.syncPromise = null;
    });

  return licensesCache.syncPromise;
}

function scheduleLicensesCacheRefresh(reason = 'background') {
  if (licensesCache.syncPromise) {
    return;
  }

  void syncLicensesCache({ reason }).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[monday-proxy] background sync failed (${reason}): ${message}`);
  });
}

async function resolveLicensesPayload({ forceRefresh = false, reason = 'request' } = {}) {
  if (forceRefresh || !licensesCache.payload) {
    return syncLicensesCache({
      reason: forceRefresh ? `forced-${reason}` : `initial-${reason}`,
    });
  }

  if (isLicensesCacheFresh()) {
    return licensesCache.payload;
  }

  try {
    return await syncLicensesCache({ reason: `stale-${reason}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[monday-proxy] serving stale cache after sync failure: ${message}`);
    return licensesCache.payload;
  }
}

let emailClientInstance = null;
function getEmailClient() {
  const conn = process.env.ACS_CONNECTION_STRING;
  if (!conn) return null;
  if (!emailClientInstance) emailClientInstance = new EmailClient(conn);
  return emailClientInstance;
}

async function sendRenewalReminderEmail({ to, license, daysUntilRenewal }) {
  const client = getEmailClient();
  if (!client) throw new Error('ACS_CONNECTION_STRING is not set on the server.');
  const sender = process.env.ACS_SENDER_ADDRESS;
  if (!sender) throw new Error('ACS_SENDER_ADDRESS is not set on the server.');

  const dept = license.department || 'unassigned';
  const renewalDate = license.renewalDate || 'TBD';
  const method = license.renewalMethod || 'Manual';
  const amount = license.amount > 0 ? `$${Number(license.amount).toLocaleString()}` : 'not on file';
  const detailUrl = `https://applications.atlantafinehomes.com/license/${license.id}`;

  const subject = `Renewal reminder: ${license.application} (${daysUntilRenewal} days)`;
  const plainText = [
    `${license.application} is set to renew in ${daysUntilRenewal} days.`,
    '',
    `Department: ${dept}`,
    `Renewal date: ${renewalDate}`,
    `Renewal method: ${method}`,
    `Amount on file: ${amount}`,
    '',
    `Review in the dashboard: ${detailUrl}`,
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 540px; color: #1f2937;">
      <h2 style="margin: 0 0 8px 0; font-size: 18px;">Renewal reminder</h2>
      <p style="margin: 0 0 12px 0;"><strong>${license.application}</strong> is set to renew in <strong>${daysUntilRenewal} days</strong>.</p>
      <table style="border-collapse: collapse; font-size: 13px;">
        <tr><td style="padding: 4px 12px 4px 0; color: #6b7280;">Department</td><td>${dept}</td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #6b7280;">Renewal date</td><td>${renewalDate}</td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #6b7280;">Renewal method</td><td>${method}</td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #6b7280;">Amount on file</td><td>${amount}</td></tr>
      </table>
      <p style="margin: 16px 0 0 0;"><a href="${detailUrl}" style="color: #4f46e5;">Review in the dashboard</a></p>
    </div>
  `;

  const poller = await client.beginSend({
    senderAddress: sender,
    content: { subject, plainText, html },
    recipients: { to: [{ address: to }] },
  });
  return poller.pollUntilDone();
}

// ---------------------------------------------------------------------------
// Microsoft Graph profile-photo proxy (Azure AD)
//
// Uses the client-credentials flow: an Azure AD app registration with
// `User.Read.All` (Application permission, admin-consented) lets us fetch
// any AFH user's profile photo by email. Caches the access token and the
// photo buffers in-process to keep latency down.
// ---------------------------------------------------------------------------
const AZURE_TENANT_ID = process.env.AZURE_TENANT_ID || '';
const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID || '';
const AZURE_CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET || '';
const AZURE_PHOTO_ALLOWED_DOMAIN = (process.env.AZURE_PHOTO_ALLOWED_DOMAIN || 'atlantafinehomes.com').toLowerCase();

const azureGraph = {
  token: '',
  tokenExpiresAtMs: 0,
};
const azurePhotoCache = new Map(); // email -> { buffer, contentType, expiresAtMs } | { miss: true, expiresAtMs }
const PHOTO_TTL_MS = 60 * 60 * 1000; // 1 hour
const PHOTO_NEGATIVE_TTL_MS = 10 * 60 * 1000; // 10 minutes for misses

async function getGraphAccessToken() {
  if (!AZURE_TENANT_ID || !AZURE_CLIENT_ID || !AZURE_CLIENT_SECRET) return '';
  if (azureGraph.token && Date.now() < azureGraph.tokenExpiresAtMs - 60_000) {
    return azureGraph.token;
  }

  const tokenUrl = `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: AZURE_CLIENT_ID,
    client_secret: AZURE_CLIENT_SECRET,
    grant_type: 'client_credentials',
    scope: 'https://graph.microsoft.com/.default',
  });

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    console.error('[graph] token fetch failed', res.status, await res.text().catch(() => ''));
    return '';
  }
  const json = await res.json();
  azureGraph.token = json.access_token || '';
  azureGraph.tokenExpiresAtMs = Date.now() + Number(json.expires_in || 3600) * 1000;
  return azureGraph.token;
}

const azureProfileCache = new Map(); // email -> { profile, expiresAtMs }
const PROFILE_TTL_MS = 60 * 60 * 1000;
const PROFILE_NEGATIVE_TTL_MS = 10 * 60 * 1000;

async function fetchAzureProfile(email) {
  if (!email || !email.includes('@')) return null;
  const normalized = email.trim().toLowerCase();
  if (AZURE_PHOTO_ALLOWED_DOMAIN && !normalized.endsWith(`@${AZURE_PHOTO_ALLOWED_DOMAIN}`)) {
    return null;
  }

  const cached = azureProfileCache.get(normalized);
  if (cached && Date.now() < cached.expiresAtMs) {
    return cached.profile;
  }

  const token = await getGraphAccessToken();
  if (!token) return null;

  const profileUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(normalized)}?$select=displayName,mail,userPrincipalName,jobTitle,department`;
  try {
    const res = await fetch(profileUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      azureProfileCache.set(normalized, { profile: null, expiresAtMs: Date.now() + PROFILE_NEGATIVE_TTL_MS });
      return null;
    }
    const json = await res.json();
    const profile = {
      email: (json.mail || json.userPrincipalName || normalized).toLowerCase(),
      displayName: json.displayName || normalized,
      jobTitle: json.jobTitle || null,
      department: json.department || null,
    };
    azureProfileCache.set(normalized, { profile, expiresAtMs: Date.now() + PROFILE_TTL_MS });
    return profile;
  } catch (error) {
    console.error('[graph] profile fetch failed', error?.message || error);
    return null;
  }
}

async function fetchAzureProfilePhoto(email) {
  if (!email || !email.includes('@')) return null;
  const normalized = email.trim().toLowerCase();
  if (AZURE_PHOTO_ALLOWED_DOMAIN && !normalized.endsWith(`@${AZURE_PHOTO_ALLOWED_DOMAIN}`)) {
    return null;
  }

  const cached = azurePhotoCache.get(normalized);
  if (cached && Date.now() < cached.expiresAtMs) {
    return cached.miss ? null : cached;
  }

  const token = await getGraphAccessToken();
  if (!token) return null;

  const photoUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(normalized)}/photo/$value`;
  try {
    const res = await fetch(photoUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      azurePhotoCache.set(normalized, { miss: true, expiresAtMs: Date.now() + PHOTO_NEGATIVE_TTL_MS });
      return null;
    }
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const buffer = Buffer.from(await res.arrayBuffer());
    const entry = { buffer, contentType, expiresAtMs: Date.now() + PHOTO_TTL_MS };
    azurePhotoCache.set(normalized, entry);
    return entry;
  } catch (error) {
    console.error('[graph] photo fetch failed', error?.message || error);
    azurePhotoCache.set(normalized, { miss: true, expiresAtMs: Date.now() + PHOTO_NEGATIVE_TTL_MS });
    return null;
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'OPTIONS') {
      setCors(res);
      res.statusCode = 204;
      res.end();
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/health') {
      sendJson(res, 200, { ok: true, service: 'monday-proxy' });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/profile/photo') {
      const email = (url.searchParams.get('email') || '').trim();
      const photo = await fetchAzureProfilePhoto(email);
      if (!photo) {
        res.statusCode = 404;
        res.end();
        return;
      }
      res.setHeader('Content-Type', photo.contentType);
      res.setHeader('Cache-Control', 'private, max-age=3600');
      res.statusCode = 200;
      res.end(photo.buffer);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/profile/lookup') {
      const email = (url.searchParams.get('email') || '').trim();
      const profile = await fetchAzureProfile(email);
      if (!profile) {
        sendJson(res, 404, { error: 'profile not found' });
        return;
      }
      sendJson(res, 200, profile);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/licenses') {
      const forceRefresh = url.searchParams.get('refresh') === '1';
      const payload = await resolveLicensesPayload({
        forceRefresh,
        reason: 'licenses-request',
      });
      sendJson(res, 200, payload);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/monday/webhook') {
      const body = await readJson(req);

      if (body && typeof body.challenge === 'string') {
        sendJson(res, 200, { challenge: body.challenge });
        return;
      }

      // Invalidate and re-sync in the background when Monday notifies us of a change.
      licensesCache.syncedAtMs = 0;
      if (licensesCache.payload) {
        scheduleLicensesCacheRefresh('webhook');
      }

      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === 'POST' && /^\/api\/licenses\/[^/]+\/renewal$/.test(url.pathname)) {
      const itemId = decodeURIComponent(url.pathname.split('/')[3] || '');
      const body = await readJson(req);
      const result = await updateLicenseRenewal(itemId, body?.recordBoardId, {
        amount: body?.amount,
        length: body?.length,
        renewalMethod: body?.renewalMethod,
        renewalDate: body?.renewalDate,
        seats: body?.seats,
        useCase: body?.useCase,
      });

      sendJson(res, 200, result);
      return;
    }

    // Production static file serving (when dist/ exists)
    if (SERVE_STATIC && req.method === 'GET') {
      const served = await serveStaticFile(res, url.pathname);
      if (served) return;

      // SPA fallback: serve index.html for any non-API, non-file route
      const fallback = await serveStaticFile(res, '/index.html');
      if (fallback) return;
    }

    sendJson(res, 404, { error: `Route not found: ${req.method} ${url.pathname}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    sendJson(res, 500, { error: message });
  }
});

server.listen(PORT, () => {
  console.log(`Monday proxy listening on http://localhost:${PORT}`);
});
