const { RefillService } = require('../src/core/refillService');
const { RefillStore } = require('../src/data/store');
const { FakeChat, FakeHr, FakeBookings, FakeClock } = require('../src/simulated/fakes');
const { OFFICES, VOLUNTEERS } = require('../src/data/setup');
const { dayOf, addDays } = require('../src/lib/days');

function world(startIso = '2026-11-16T09:00:00Z') {
  const clock = new FakeClock(startIso);
  const chat = new FakeChat();
  const hr = new FakeHr();
  const bookings = new FakeBookings();
  const store = new RefillStore();
  const service = new RefillService({
    offices: OFFICES,
    volunteers: VOLUNTEERS,
    store,
    chat,
    hr,
    bookings,
    clock,
  });

  const today = () => dayOf(clock.now());
  const tomorrow = () => addDays(today(), 1);
  const book = (officeId, day, ...people) => people.forEach((p) => bookings.book(p, officeId, day));
  const nextMorning = () => clock.set(`${tomorrow()}T09:00:00Z`);
  const evening = () => clock.set(`${today()}T18:30:00Z`);

  return {
    clock,
    chat,
    hr,
    bookings,
    store,
    service,
    today,
    tomorrow,
    book,
    nextMorning,
    evening,
  };
}

module.exports = { world };
