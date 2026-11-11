import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { editable, monday, parseHours, shiftDate, sumHours, unusualHours, weekDays } from '../src/modules/timesheets/domain';

test('Monday to Sunday week crosses year boundaries correctly', () => {
  assert.equal(monday('2027-01-03'), '2026-12-28');
  assert.equal(monday('2027-01-04'), '2027-01-04');
  assert.deepEqual(weekDays('2026-12-28'), ['2026-12-28','2026-12-29','2026-12-30','2026-12-31','2027-01-01','2027-01-02','2027-01-03']);
});
test('date navigation handles daylight saving and leap day', () => {
  assert.equal(shiftDate('2026-03-08', 1), '2026-03-09');
  assert.equal(shiftDate('2028-02-28', 1), '2028-02-29');
});
test('warning thresholds are exclusive and never cap valid hours', () => {
  for (const hours of [0.5, 8.01, 25, 1000]) { assert.equal(unusualHours(hours), true); assert.equal(parseHours(String(hours)), hours); }
  for (const hours of [1, 7.5, 8]) assert.equal(unusualHours(hours), false);
});
test('rejects invalid or excess-precision hours', () => {
  for (const hours of ['', '0', '-1', 'NaN', 'Infinity', '2.555', '1e2', '3abc']) assert.throws(() => parseHours(hours));
});
test('totals avoid common decimal rounding artifacts', () => {
  assert.equal(sumHours([{ hours: 0.1 }, { hours: 0.2 }]), 0.3);
});
test('only drafts and returned weeks allow entry edits', () => {
  assert.equal(editable('draft'), true); assert.equal(editable('returned'), true);
  assert.equal(editable('submitted'), false); assert.equal(editable('approved'), false);
});
