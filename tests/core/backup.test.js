const { world } = require('../helpers');
const { money } = require('../../src/lib/money');

test('backup empty on an open refill: same refill becomes a double, buyer told', () => {
  const w = world();
  w.book('BLR', w.tomorrow(), 'asha');
  const r = w.service.reportEmpty('BLR', 'ravi');

  const d = w.service.reportBackupEmpty('BLR', 'meera');

  expect(d.id).toBe(r.id);
  expect(d.needsDouble).toBe(true);
  expect(w.store.all()).toHaveLength(1);
  expect(w.chat.messagesTo('asha').some((m) => m.includes('full backup'))).toBe(true);
});

test('backup empty with no open refill: a new refill is created as a double', () => {
  const w = world();
  w.book('BLR', w.tomorrow(), 'asha');

  const d = w.service.reportBackupEmpty('BLR', 'meera');

  expect(d.status).toBe('SCHEDULED');
  expect(d.needsDouble).toBe(true);
});

test('reporting backup empty twice only tells the buyer once', () => {
  const w = world();
  w.book('BLR', w.tomorrow(), 'asha');
  w.service.reportBackupEmpty('BLR', 'meera');
  w.service.reportBackupEmpty('BLR', 'ravi');

  const notes = w.chat.messagesTo('asha').filter((m) => m.includes('backup ran out'));
  expect(notes).toHaveLength(1);
});

test('a double purchase up to 2× the usual max is not flagged', () => {
  const w = world();
  w.book('BLR', w.tomorrow(), 'asha');
  const r = w.service.reportBackupEmpty('BLR', 'meera');
  w.nextMorning();
  w.service.markRestocked(r.id, 'asha', ['namkeen', 'biscuits']);

  w.service.uploadReceipt(r.id, 'asha', money(5500, 'INR'), 'double.jpg');

  expect(w.chat.admin.some((m) => m.text.includes('above the usual'))).toBe(false);
  expect(w.hr.claims[0].description).toContain('main box + backup');
});
