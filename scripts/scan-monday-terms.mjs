#!/usr/bin/env node
//
// Read-only scan of the Monday boards: tallies the values used in the
// term / length / billing-cycle columns and flags any cell containing
// "yearly". Used to plan the verbiage cleanup (e.g. "Yearly" -> "Annually").
//
// Credentials are read from .env.local (MONDAY_API_TOKEN, MONDAY_BOARD_IDS).
// This script only queries Monday - it never writes.
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
        column_values { id text column { title } }
        subitems { name column_values { id text column { title } } }
      }
    }
  }
}`;

const TERM_TITLE = /(length|term|contract|billing|frequency)/i;

const termValues = new Map();   // "<column title>" -> Map(value -> count)
const yearlyHits = [];          // { board, item, column, text }
let totalRecords = 0;

function recordRow(boardName, itemName, columnValues) {
  totalRecords += 1;
  for (const cv of columnValues || []) {
    const title = (cv.column && cv.column.title) || cv.id || '(unknown)';
    const text = (cv.text || '').trim();
    if (!text) continue;
    if (TERM_TITLE.test(title)) {
      if (!termValues.has(title)) termValues.set(title, new Map());
      const bucket = termValues.get(title);
      bucket.set(text, (bucket.get(text) || 0) + 1);
    }
    if (/\byearly\b/i.test(text)) {
      yearlyHits.push({ board: boardName, item: itemName, column: title, text });
    }
  }
}

async function main() {
  for (const boardId of BOARD_IDS) {
    const data = await mondayQuery(ITEMS_QUERY, { boardId: [boardId] });
    const board = data.boards && data.boards[0];
    if (!board) {
      console.error(`board ${boardId}: not found / no access`);
      continue;
    }
    const page = board.items_page || { items: [], cursor: null };
    for (const item of page.items || []) {
      recordRow(board.name, item.name, item.column_values);
      for (const sub of item.subitems || []) {
        recordRow(board.name, `${item.name} / ${sub.name}`, sub.column_values);
      }
    }
    if (page.cursor) {
      console.error(`WARNING: board "${board.name}" has >500 items - scan is incomplete.`);
    }
  }

  console.log(`Scanned ${totalRecords} records across ${BOARD_IDS.length} boards.\n`);

  console.log('=== Term / length column values ===');
  for (const [title, bucket] of termValues) {
    console.log(`\n[${title}]`);
    const sorted = [...bucket.entries()].sort((a, b) => b[1] - a[1]);
    for (const [value, count] of sorted) {
      console.log(`  ${String(count).padStart(4)}  ${JSON.stringify(value)}`);
    }
  }

  console.log(`\n=== Cells containing "yearly" (${yearlyHits.length}) ===`);
  for (const hit of yearlyHits) {
    console.log(`  ${hit.board} :: ${hit.item} :: [${hit.column}] = ${JSON.stringify(hit.text)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
