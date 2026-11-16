const { world } = require('../helpers');

test('OK marks the refill confirmed', () => {
  const w = world();
  w.book('BLR', w.tomorrow(), 'asha');
  const r = w.service.reportEmpty('BLR', 'ravi');

  expect(w.service.confirm(r.id, 'asha').confirmed).toBe(true);
});

test('only the assigned buyer can reply (two people cannot both commit)', () => {
  const w = world();
  w.book('BLR', w.tomorrow(), 'asha', 'ravi');
  const r = w.service.reportEmpty('BLR', 'meera'); // asha is picked
  expect(r.buyerId).toBe('asha');

  expect(() => w.service.confirm(r.id, 'ravi')).toThrow('assigned to asha');
  expect(() => w.service.pass(r.id, 'ravi')).toThrow('assigned to asha');
});

test('"won\'t be in" moves it to the next person for the same day, told today', () => {
  const w = world();
  w.book('BLR', w.tomorrow(), 'asha', 'ravi');
  const r = w.service.reportEmpty('BLR', 'meera');

  const moved = w.service.pass(r.id, 'asha');

  expect(moved.buyerId).toBe('ravi');
  expect(moved.buyDay).toBe(r.buyDay);
  expect(moved.passedBy).toEqual(['asha']);
  expect(w.chat.messagesTo('ravi')[0]).toContain("You're on snack duty");
});

test('if everyone booked in passes, the refill waits and an admin is told', () => {
  const w = world();
  w.book('BLR', w.tomorrow(), 'asha');
  const r = w.service.reportEmpty('BLR', 'meera');

  const waiting = w.service.pass(r.id, 'asha');

  expect(waiting.status).toBe('WAITING_FOR_BOOKING');
  expect(w.chat.admin.some((m) => m.text.includes('nobody is booked in'))).toBe(true);
});

test('it is never moved on the buying day itself', () => {
  const w = world();
  w.book('BLR', w.tomorrow(), 'asha', 'ravi');
  const r = w.service.reportEmpty('BLR', 'meera');

  w.nextMorning(); // it's now asha's buying day
  expect(() => w.service.pass(r.id, 'asha')).toThrow('already your buying day');
});
