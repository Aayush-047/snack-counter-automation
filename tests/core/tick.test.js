const { world } = require('../helpers');
const { money } = require('../../src/lib/money');
const { addDays } = require('../../src/lib/days');

test('no reply in 2 hours: admin told once, buyer stays assigned', () => {
  const w = world();
  w.book('BLR', w.tomorrow(), 'asha');
  w.service.reportEmpty('BLR', 'ravi');

  w.clock.advanceHours(1);
  expect(w.service.tick()).toHaveLength(0);

  w.clock.advanceHours(1);
  const [r] = w.service.tick();
  expect(r.buyerId).toBe('asha');
  expect(w.chat.admin.some((m) => m.text.includes("hasn't confirmed"))).toBe(true);

  w.clock.advanceHours(1);
  expect(w.service.tick()).toHaveLength(0); // not again
});

test('confirmed buyers do not trigger the admin reminder', () => {
  const w = world();
  w.book('BLR', w.tomorrow(), 'asha');
  const r = w.service.reportEmpty('BLR', 'ravi');
  w.service.confirm(r.id, 'asha');

  w.clock.advanceHours(3);
  expect(w.service.tick()).toHaveLength(0);
});

test('buying day over with nothing recorded: same person asked again for tomorrow', () => {
  const w = world();
  const day1 = w.tomorrow();
  w.book('BLR', day1, 'asha', 'ravi');
  w.book('BLR', addDays(day1, 1), 'asha', 'ravi');
  let r = w.service.reportEmpty('BLR', 'meera');
  r = w.service.pass(r.id, 'asha'); // ravi is the buyer

  w.nextMorning(); // ravi's buying day
  w.evening(); // over, nothing recorded
  const [again] = w.service.tick();

  expect(again.buyerId).toBe('ravi'); // same person first
  expect(again.buyDay).toBe(addDays(day1, 1));
  expect(w.chat.messagesTo('ravi').some((m) => m.includes('Nothing recorded today'))).toBe(true);
});

test('if they are not booked in tomorrow, it goes to the next person', () => {
  const w = world();
  const day1 = w.tomorrow();
  w.book('BLR', day1, 'asha');
  w.book('BLR', addDays(day1, 1), 'ravi');
  w.service.reportEmpty('BLR', 'meera'); // asha

  w.nextMorning();
  w.evening();
  const [again] = w.service.tick();
  expect(again.buyerId).toBe('ravi');
  expect(again.formerBuyers).toEqual(['asha']);
});

test('restocked but no receipt after a day: reminded once', () => {
  const w = world();
  w.book('BLR', w.tomorrow(), 'asha');
  const r = w.service.reportEmpty('BLR', 'ravi');
  w.nextMorning();
  w.service.markRestocked(r.id, 'asha', []);

  w.clock.advanceHours(24);
  w.service.tick();
  w.clock.advanceHours(24);
  w.service.tick();
  const reminders = w.chat.messagesTo('asha').filter((m) => m.includes('Upload your receipt for'));
  expect(reminders).toHaveLength(1);
});

test('nobody booked in: waits quietly, then is scheduled when someone books', () => {
  const w = world();
  const r = w.service.reportEmpty('BLR', 'ravi');
  expect(r.status).toBe('WAITING_FOR_BOOKING');
  const adminCount = w.chat.admin.length;

  w.clock.advanceHours(1);
  w.service.tick();
  expect(w.chat.admin.length).toBe(adminCount); // no spam

  w.book('BLR', w.tomorrow(), 'meera');
  const [scheduled] = w.service.tick();
  expect(scheduled.buyerId).toBe('meera');
});

test('safety net: former buyer uploads late before the new buyer restocks', () => {
  const w = world();
  const day1 = w.tomorrow();
  w.book('BLR', day1, 'asha');
  w.book('BLR', addDays(day1, 1), 'ravi');
  const r = w.service.reportEmpty('BLR', 'meera'); // asha

  w.nextMorning();
  w.evening();
  w.service.tick(); // moves to ravi

  const done = w.service.uploadReceipt(r.id, 'asha', money(900, 'INR'), 'late.jpg');
  expect(done.status).toBe('CLAIM_SUBMITTED');
  expect(done.buyerId).toBe('asha');
  expect(w.chat.messagesTo('ravi')).toContain('Already done by asha, no need to buy 👍');
});

test('safety net: both bought, admin told to reimburse the late one manually', () => {
  const w = world();
  const day1 = w.tomorrow();
  w.book('BLR', day1, 'asha');
  w.book('BLR', addDays(day1, 1), 'ravi');
  const r = w.service.reportEmpty('BLR', 'meera');

  w.nextMorning();
  w.evening();
  w.service.tick(); // moves to ravi
  w.nextMorning();
  w.service.markRestocked(r.id, 'ravi', []);

  w.service.uploadReceipt(r.id, 'asha', money(900, 'INR'), 'late.jpg');
  expect(w.chat.admin.some((m) => m.text.includes('reimburse manually'))).toBe(true);
});

test('check 3: former buyer taps Restocked after the evening message, new buyer told not to buy', () => {
  const w = world();
  const day1 = w.tomorrow();
  w.book('BLR', day1, 'asha');
  w.book('BLR', addDays(day1, 1), 'ravi');
  const r = w.service.reportEmpty('BLR', 'meera'); // asha

  w.nextMorning();
  w.evening();
  w.service.tick(); // "nothing recorded" → moves to ravi

  const done = w.service.markRestocked(r.id, 'asha', ['biscuits']);
  expect(done.status).toBe('RESTOCKED');
  expect(done.buyerId).toBe('asha');
  expect(w.chat.messagesTo('ravi')).toContain('Already done by asha, no need to buy 👍');
});
