const { pickBuyer } = require('../../src/core/picker');
const { VOLUNTEERS } = require('../../src/data/setup');
const { FakeBookings } = require('../../src/simulated/fakes');

const DAY = '2026-11-17';
const NOW = new Date('2026-11-16T10:00:00Z');

// A completed refill by `who` on date `iso`
const done = (who, iso) => ({ buyerId: who, status: 'RESTOCKED', restockedAt: new Date(iso) });

function bookings(...people) {
  const b = new FakeBookings();
  people.forEach((p) => b.book(p, 'BLR', DAY));
  return b;
}

const pick = (opts) =>
  pickBuyer({
    officeId: 'BLR',
    buyDay: DAY,
    volunteers: VOLUNTEERS,
    refills: [],
    now: NOW,
    ...opts,
  });

test('only people booked into that office on that day can be picked', () => {
  expect(pick({ bookings: bookings('ravi') }).employeeId).toBe('ravi');
  expect(pick({ bookings: bookings() })).toBeNull();
});

test('visitors from the other office and people who left the pool are never picked', () => {
  const b = new FakeBookings();
  b.book('ola', 'BLR', DAY); // Oslo employee visiting Bengaluru
  b.book('dev', 'BLR', DAY); // left the pool
  expect(pick({ bookings: b })).toBeNull();
});

test('fewest completed refills in the last 30 days goes first', () => {
  const refills = [done('asha', '2026-11-10T10:00:00Z')];
  expect(pick({ bookings: bookings('asha', 'ravi'), refills }).employeeId).toBe('ravi');
});

test('refills older than 30 days no longer count', () => {
  const refills = [done('ravi', '2026-10-01T10:00:00Z'), done('asha', '2026-11-10T10:00:00Z')];
  expect(pick({ bookings: bookings('asha', 'ravi'), refills }).employeeId).toBe('ravi');
});

test('on a tie, whoever refilled longest ago goes first', () => {
  const refills = [done('asha', '2026-11-12T10:00:00Z'), done('ravi', '2026-11-02T10:00:00Z')];
  expect(pick({ bookings: bookings('asha', 'ravi'), refills }).employeeId).toBe('ravi');
});

test('people who said "won\'t be in" are skipped', () => {
  expect(pick({ bookings: bookings('asha', 'ravi'), exclude: ['asha'] }).employeeId).toBe('ravi');
});

test('on rollover, the same person is asked again first if they are booked in', () => {
  expect(pick({ bookings: bookings('asha', 'ravi'), preferred: 'ravi' }).employeeId).toBe('ravi');
  expect(pick({ bookings: bookings('asha'), preferred: 'ravi' }).employeeId).toBe('asha');
});
