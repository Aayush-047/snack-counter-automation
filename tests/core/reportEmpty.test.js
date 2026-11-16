const { world } = require('../helpers');
const { ConflictError } = require('../../src/data/store');

test("reporting empty picks tomorrow's buyer and tells them today", () => {
  const w = world();
  w.book('BLR', w.tomorrow(), 'asha');

  const r = w.service.reportEmpty('BLR', 'ravi');

  expect(r.status).toBe('SCHEDULED');
  expect(r.buyerId).toBe('asha');
  expect(r.buyDay).toBe(w.tomorrow());
  expect(w.chat.messagesTo('asha')[0]).toContain("You're on snack duty");
});

test('a second "empty" report does not start a second refill (no double-buying)', () => {
  const w = world();
  w.book('BLR', w.tomorrow(), 'asha', 'ravi');

  const first = w.service.reportEmpty('BLR', 'meera');
  const second = w.service.reportEmpty('BLR', 'ravi');

  expect(second.id).toBe(first.id);
  expect(w.store.all()).toHaveLength(1);
  expect(w.chat.messagesTo('ravi')).toContain(
    `Already reported. ${first.buyerId} is buying on ${first.buyDay}.`
  );
});

test('each office has its own refill', () => {
  const w = world();
  w.book('BLR', w.tomorrow(), 'asha');
  w.book('OSLO', w.tomorrow(), 'ola');

  w.service.reportEmpty('BLR', 'ravi');
  w.service.reportEmpty('OSLO', 'kari');

  expect(w.store.all()).toHaveLength(2);
});

test('nobody booked in tomorrow: refill waits and an admin is told', () => {
  const w = world();

  const r = w.service.reportEmpty('BLR', 'ravi');

  expect(r.status).toBe('WAITING_FOR_BOOKING');
  expect(w.chat.admin[0].text).toContain('nobody is booked in');
});

test('the store refuses a second open refill for the same office', () => {
  const w = world();
  w.service.reportEmpty('BLR', 'ravi');
  expect(() =>
    w.store.insert({ id: 'X', officeId: 'BLR', status: 'SCHEDULED', version: 0 })
  ).toThrow('already has an open refill');
});

test('a save based on an old version is rejected (no overwriting each other)', () => {
  const w = world();
  w.book('BLR', w.tomorrow(), 'asha');
  const r = w.service.reportEmpty('BLR', 'ravi');

  const copyA = w.store.get(r.id);
  const copyB = w.store.get(r.id);

  w.store.update({ ...copyA, confirmed: true }, copyA.version); // A saves first
  expect(() => w.store.update({ ...copyB, buyerId: 'ravi' }, copyB.version)).toThrow(ConflictError);
});
