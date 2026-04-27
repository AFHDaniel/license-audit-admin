import test from 'node:test';
import assert from 'node:assert/strict';

import { buildMondayColumnValuesPayload } from './mondayWriteback.mjs';

test('buildMondayColumnValuesPayload resolves board-specific column ids by title aliases (untyped → plain string)', () => {
  const payload = buildMondayColumnValuesPayload(
    [
      { id: 'numbers_amount', title: 'Amount' },
      { id: 'text_length', title: 'Length' },
      { id: 'text_method', title: 'Renewal Method' },
      { id: 'text_date', title: 'Renewal Date' },
      { id: 'text_seats', title: 'Seats' },
      { id: 'text_usecase', title: 'Use Case' },
    ],
    {
      amount: 2500,
      length: 'Annual',
      renewalMethod: 'ACH',
      renewalDate: '2026-09-01',
      seats: '25',
      useCase: 'Design',
    },
    {},
  );

  assert.deepEqual(payload, {
    numbers_amount: '2500',
    text_length: 'Annual',
    text_method: 'ACH',
    text_date: '2026-09-01',
    text_seats: '25',
    text_usecase: 'Design',
  });
});

test('buildMondayColumnValuesPayload ignores empty fields and supports explicit preferred ids', () => {
  const payload = buildMondayColumnValuesPayload(
    [
      { id: 'custom_amount', title: 'Annual Cost' },
      { id: 'custom_date', title: 'Expiration Date' },
    ],
    {
      amount: 3200,
      renewalDate: '  ',
      length: '',
    },
    {
      amount: 'custom_amount',
    },
  );

  assert.deepEqual(payload, {
    custom_amount: '3200',
  });
});

test('numbers-typed column emits a numeric string and strips currency/commas', () => {
  const payload = buildMondayColumnValuesPayload(
    [{ id: 'num1', title: 'Amount', type: 'numbers' }],
    { amount: '$1,250.50' },
    {},
  );
  assert.deepEqual(payload, { num1: '1250.5' });
});

test('date-typed column emits {date: YYYY-MM-DD}', () => {
  const payload = buildMondayColumnValuesPayload(
    [{ id: 'd1', title: 'Renewal Date', type: 'date' }],
    { renewalDate: '2026-09-01' },
    {},
  );
  assert.deepEqual(payload, { d1: { date: '2026-09-01' } });
});

test('date-typed column parses non-ISO input and normalizes to YYYY-MM-DD', () => {
  const payload = buildMondayColumnValuesPayload(
    [{ id: 'd1', title: 'Renewal Date', type: 'date' }],
    { renewalDate: 'September 1, 2026' },
    {},
  );
  assert.deepEqual(payload, { d1: { date: '2026-09-01' } });
});

test('date-typed column rejects unparseable input', () => {
  const payload = buildMondayColumnValuesPayload(
    [{ id: 'd1', title: 'Renewal Date', type: 'date' }],
    { renewalDate: 'not a date' },
    {},
  );
  assert.deepEqual(payload, {});
});

test('status-typed column emits {label}', () => {
  const payload = buildMondayColumnValuesPayload(
    [{ id: 's1', title: 'Renewal Method', type: 'status' }],
    { renewalMethod: 'ACH' },
    {},
  );
  assert.deepEqual(payload, { s1: { label: 'ACH' } });
});

test('dropdown-typed column emits {labels:[...]}', () => {
  const payload = buildMondayColumnValuesPayload(
    [{ id: 'dd1', title: 'Length', type: 'dropdown' }],
    { length: 'Annual' },
    {},
  );
  assert.deepEqual(payload, { dd1: { labels: ['Annual'] } });
});

test('long_text-typed column emits {text}', () => {
  const payload = buildMondayColumnValuesPayload(
    [{ id: 'lt1', title: 'Use Case', type: 'long_text' }],
    { useCase: 'Marketing automation workflows' },
    {},
  );
  assert.deepEqual(payload, { lt1: { text: 'Marketing automation workflows' } });
});

test('mixed-type board produces per-column correct shapes in one call', () => {
  const payload = buildMondayColumnValuesPayload(
    [
      { id: 'num', title: 'Amount', type: 'numbers' },
      { id: 'dropdown_length', title: 'Length', type: 'dropdown' },
      { id: 'status_method', title: 'Renewal Method', type: 'status' },
      { id: 'real_date', title: 'Renewal Date', type: 'date' },
      { id: 'plain_seats', title: 'Seats', type: 'text' },
    ],
    {
      amount: 1500,
      length: 'Monthly',
      renewalMethod: 'Credit Card',
      renewalDate: '2027-01-15',
      seats: '10',
    },
    {},
  );

  assert.deepEqual(payload, {
    num: '1500',
    dropdown_length: { labels: ['Monthly'] },
    status_method: { label: 'Credit Card' },
    real_date: { date: '2027-01-15' },
    plain_seats: '10',
  });
});
