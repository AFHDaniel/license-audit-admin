#!/usr/bin/env node
//
// Read-only scan of the Monday boards' renewal-date columns. Dumps the raw
// "Next Renewal" (structured date), legacy "Renewal Date" (free text) and
// "Renewal Type" values per record so the parsing rework can be designed
// against real data instead of guesses. Never writes to Monday.
//
// Credentials are read from .env.local (MONDAY_API_TOKEN, MONDAY_BOARD_IDS).
//

import fs from 'node:fs';

const ENV_PATH = new URL('../.env.local', import.meta.url);

function loadEnv(path) {
  const out = {};
  for (const line of fs.readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const env = loadEnv(ENV_PATH);
const TOKEN = process.env.MONDAY_API_TOKEN || env.MONDAY_API_TOKEN;
const BOARD_IDS = (process.env.MONDAY_BOARD_IDS || env.MONDAY_BOARD_IDS || '')
  .split(',').map((s) => s.trim()).filter(Boolean);

if (!TOKEN || BOARD_IDS.length === 0) {
  console.error('Missing MONDAY_API_TOKEN or MONDAY_BOARD_IDS in .env.local');
  process.exit(1);
}

async function mondayQuery(query, variables) {
  const res = await fetch('https://api.monday.com/v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: TOKEN },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

const ITEMS_QUERY = `
query ($boardId: [ID!]) {
  boards(ids: $boardId) {
    name
    items_page(limit: 500) {
      cursor
      items {
        name
        column_values { id text value column { title } }
        subitems { name column_values { id text value column { title } } }
      }
    }
  }
}`;

const NEXT_RENEWAL = /^next renewal$/i;
const LEGACY_DATE = /(renewal date|renew date|renews on|expiration|expiry|end date|contract end)/i;
const RENEWAL_TYPE = /^renewal type$/i;
const LENGTH = /(length|term|contract|billing|frequency)/i;

// Does parseDateLike-equivalent logic succeed on this text?
function parsesAsDate(text) {
  const str = String(text || '').trim();
  if (!str) return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return true;
  return !Number.isNaN(new Date(str).getTime());
}

const rows = [];
let totalRecords = 0;

function recordRow(boardName, itemName, columnValues) {
  totalRecords += 1;
  let nextRenewal = '';
  let nextRenewalVal = '';
  let legacy = '';
  let renewalType = '';
  let length = '';
  for (const cv of columnValues || []) {
    const title = (cv.column && cv.column.title) || '';
    const text = (cv.text || '').trim();
    if (NEXT_RENEWAL.test(title)) { nextRenewal = text; nextRenewalVal = cv.value || ''; }
    else if (RENEWAL_TYPE.test(title)) renewalType = text;
    else if (LEGACY_DATE.test(title) && !legacy) legacy = text;
    else if (LENGTH.test(title) && !length) length = text;
  }
  rows.push({ boardName, itemName, nextRenewal, nextRenewalVal, legacy, renewalType, length });
}

async function main() {
  for (const boardId of BOARD_IDS) {
    const data = await mondayQuery(ITEMS_QUERY, { boardId: [boardId] });
    const board = data.boards && data.boards[0];
    if (!board) { console.error(`board ${boardId}: not found / no access`); continue; }
    const page = board.items_page || { items: [], cursor: null };
    for (const item of page.items || []) {
      recordRow(board.name, item.name, item.column_values);
      for (const sub of item.subitems || []) {
        recordRow(board.name, `${item.name} / ${sub.name}`, sub.column_values);
      }
    }
    if (page.cursor) console.error(`WARNING: board "${board.name}" has >500 items.`);
  }

  console.log(`Scanned ${totalRecords} records across ${BOARD_IDS.length} boards.\n`);

  // Effective value = Next Renewal if set, else legacy (mirrors getRenewalDateRaw).
  const buckets = { dated: [], unparseable: [], empty: [] };
  for (const r of rows) {
    const effective = r.nextRenewal || r.legacy;
    if (!effective) buckets.empty.push(r);
    else if (parsesAsDate(effective)) buckets.dated.push(r);
    else buckets.unparseable.push(r);
  }

  console.log(`=== Effective renewal value (Next Renewal -> legacy fallback) ===`);
  console.log(`  parses as a date : ${buckets.dated.length}`);
  console.log(`  unparseable text : ${buckets.unparseable.length}`);
  console.log(`  empty (-> "TBD") : ${buckets.empty.length}\n`);

  console.log(`=== UNPARSEABLE effective values (${buckets.unparseable.length}) ===`);
  for (const r of buckets.unparseable) {
    console.log(`  ${r.boardName} :: ${r.itemName}`);
    console.log(`     next="${r.nextRenewal}" legacy="${r.legacy}" type="${r.renewalType}" length="${r.length}"`);
  }

  console.log(`\n=== EMPTY effective values (${buckets.empty.length}) ===`);
  for (const r of buckets.empty) {
    console.log(`  ${r.boardName} :: ${r.itemName}`);
    console.log(`     type="${r.renewalType}" length="${r.length}"`);
  }

  // Unique Renewal Type values.
  const typeCounts = new Map();
  for (const r of rows) {
    const t = r.renewalType || '(empty)';
    typeCounts.set(t, (typeCounts.get(t) || 0) + 1);
  }
  console.log(`\n=== Renewal Type values ===`);
  for (const [t, c] of [...typeCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(c).padStart(4)}  ${JSON.stringify(t)}`);
  }

  // How many records have a structured Next Renewal column at all.
  const withNext = rows.filter((r) => r.nextRenewal).length;
  const withLegacy = rows.filter((r) => r.legacy).length;
  console.log(`\n=== Column population ===`);
  console.log(`  Next Renewal set : ${withNext}`);
  console.log(`  legacy date set  : ${withLegacy}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
