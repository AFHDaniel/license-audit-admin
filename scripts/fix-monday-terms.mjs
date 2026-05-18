#!/usr/bin/env node
//
// Normalizes verbiage in the Monday "Length / Term" column so the data is
// consistent (e.g. "Yearly" / "Annual" -> "Annually").
//
// DRY RUN by default - prints the changes it would make. Pass --apply to
// actually write them back to Monday. Credentials come from .env.local.
//
// Only the unambiguous synonym fixes are mapped here. Genuinely different
// terms ("3 Year", "Both", "N/A") are left alone - those need a human call.
//

import fs from 'node:fs';

const ENV_PATH = new URL('../.env.local', import.meta.url);
const APPLY = process.argv.includes('--apply');

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

// Lowercased exact-match synonyms -> canonical value.
const VERBIAGE_MAP = new Map([
  ['yearly', 'Annually'],
  ['annual', 'Annually'],
]);

const TERM_TITLE = /(length|term|contract|billing|frequency)/i;

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
        id name
        board { id }
        column_values { id text column { title } }
        subitems {
          id name
          board { id }
          column_values { id text column { title } }
        }
      }
    }
  }
}`;

const MUTATION = `
mutation ($itemId: ID!, $boardId: ID!, $columnId: String!, $value: String!) {
  change_simple_column_value(item_id: $itemId, board_id: $boardId, column_id: $columnId, value: $value) { id }
}`;

// Returns a planned change for a row, or null if nothing to fix.
function planRow(boardName, rowName, row) {
  const termCol = (row.column_values || []).find(
    (cv) => cv.column && TERM_TITLE.test(cv.column.title || ''),
  );
  if (!termCol) return null;
  const current = (termCol.text || '').trim();
  const canonical = VERBIAGE_MAP.get(current.toLowerCase());
  if (!canonical || canonical === current) return null;
  return {
    boardName,
    rowName,
    itemId: row.id,
    boardId: row.board && row.board.id,
    columnId: termCol.id,
    from: current,
    to: canonical,
  };
}

async function main() {
  const changes = [];
  for (const boardId of BOARD_IDS) {
    const data = await mondayQuery(ITEMS_QUERY, { boardId: [boardId] });
    const board = data.boards && data.boards[0];
    if (!board) continue;
    const page = board.items_page || { items: [] };
    for (const item of page.items || []) {
      const itemChange = planRow(board.name, item.name, item);
      if (itemChange) changes.push(itemChange);
      for (const sub of item.subitems || []) {
        const subChange = planRow(board.name, `${item.name} / ${sub.name}`, sub);
        if (subChange) changes.push(subChange);
      }
    }
    if (page.cursor) console.error(`WARNING: board "${board.name}" has >500 items.`);
  }

  if (changes.length === 0) {
    console.log('No verbiage changes needed.');
    return;
  }

  console.log(`${APPLY ? 'APPLYING' : 'DRY RUN -'} ${changes.length} change(s):\n`);
  let applied = 0;
  for (const c of changes) {
    process.stdout.write(`  ${c.boardName} :: ${c.rowName}: ${JSON.stringify(c.from)} -> ${JSON.stringify(c.to)}`);
    if (!APPLY) { console.log(''); continue; }
    try {
      await mondayQuery(MUTATION, {
        itemId: c.itemId, boardId: c.boardId, columnId: c.columnId, value: c.to,
      });
      applied += 1;
      console.log('  ... done');
    } catch (err) {
      console.log(`  ... FAILED: ${err.message}`);
    }
  }

  if (APPLY) {
    console.log(`\nApplied ${applied}/${changes.length}.`);
  } else {
    console.log('\nDry run only. Re-run with --apply to write these to Monday.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
