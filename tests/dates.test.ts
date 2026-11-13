import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { formatDate, resolveDateFormat } from '../src/core/dates';

test('date format configuration defaults and accepts supported formats', () => {
  assert.equal(resolveDateFormat(), 'MM/DD/YYYY');
  assert.equal(resolveDateFormat('invalid'), 'MM/DD/YYYY');
  assert.equal(resolveDateFormat(' dd/mm/yyyy '), 'DD/MM/YYYY');
  assert.equal(resolveDateFormat('YYYY-MM-DD'), 'YYYY-MM-DD');
});

test('calendar date formatting preserves leap days and year boundaries', () => {
  assert.equal(formatDate('2028-02-29', 'MM/DD/YYYY'), '02/29/2028');
  assert.equal(formatDate('2028-02-29', 'DD/MM/YYYY'), '29/02/2028');
  assert.equal(formatDate('2027-01-01', 'YYYY-MM-DD'), '2027-01-01');
});
