// A week of snack refills, end to end, using the simulated chat, HR and desk bookings.
// Run with: npm run demo
const { RefillService } = require('./core/refillService');
const { RefillStore } = require('./data/store');
const { FakeChat, FakeHr, FakeBookings, FakeClock } = require('./simulated/fakes');
const { OFFICES, VOLUNTEERS } = require('./data/setup');
const { money } = require('./lib/money');
const { monthlyReport, renderReport } = require('./core/report');

const clock = new FakeClock('2026-11-16T10:00:00Z'); // Monday
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

const log = (msg) =>
  console.log(`[${clock.now().toISOString().slice(0, 16).replace('T', ' ')}] ${msg}`);

// Desk bookings for the week.
for (const day of ['2026-11-17', '2026-11-18']) {
  bookings.book('asha', 'BLR', day);
  bookings.book('ravi', 'BLR', day);
}
bookings.book('ola', 'OSLO', '2026-11-18');

// Monday
let r = service.reportEmpty('BLR', 'meera');
log(`Mon: Bengaluru box empty, backup opened -> ${r.buyerId} told they're buying on ${r.buyDay}`);
service.reportEmpty('BLR', 'karthik');
log('Mon: second "empty" report -> same refill, reporter told who is on it');
r = service.pass(r.id, r.buyerId);
log(`Mon: first pick said "won't be in" -> handed to ${r.buyerId}, same day`);
clock.advanceHours(2);
service.tick();
log(`Mon: ${r.buyerId} hasn't replied in 2h -> admin told, ${r.buyerId} stays assigned`);

// Tuesday: Ravi doesn't buy
clock.set('2026-11-17T18:30:00Z');
[r] = service.tick();
log(
  `Tue evening: nothing recorded -> ${r.buyerId} asked again for ${r.buyDay} (still first in line)`
);
const oslo = service.reportEmpty('OSLO', 'kari');
log(`Tue: Oslo box empty -> ${oslo.buyerId} buying on ${oslo.buyDay}`);
r = service.reportBackupEmpty('BLR', 'meera');
log('Tue: Bengaluru backup also empty -> next purchase covers main box + full backup');

// Wednesday: both offices restock
clock.set('2026-11-18T09:00:00Z');
service.markRestocked(r.id, r.buyerId, ['namkeen', 'biscuits', 'fruit']);
log(`Wed: ${r.buyerId} tapped "Restocked" at the counter -> refill closed and counted`);
service.markRestocked(oslo.id, 'ola', ['chocolate', 'fruit']);
log('Wed: ola restocked Oslo');

clock.set('2026-11-18T20:00:00Z');
r = service.uploadReceipt(r.id, r.buyerId, money(5200, 'INR'), 'receipt-blr.jpg');
log(`Wed night: ${r.buyerId} uploaded 5200 INR -> HR claim ${r.hrClaimId} created automatically`);
service.uploadReceipt(oslo.id, 'ola', money(890, 'NOK'), 'receipt-osl.jpg');
log('Wed night: ola uploaded 890 NOK -> HR claim created');

// Saturday: HR approves the Bengaluru claim
clock.set('2026-11-21T10:00:00Z');
service.onHrDecision(r.hrClaimId, true);
log(`Sat: HR approved ${r.hrClaimId} -> reimbursed`);

console.log('\nChat messages sent:');
for (const m of chat.direct) console.log(`  DM ${m.to}: ${m.text}`);
for (const m of chat.admin) console.log(`  Admins (${m.officeId}): ${m.text}`);

console.log(
  '\n' +
    renderReport(
      monthlyReport({
        offices: OFFICES,
        refills: store.all(),
        month: '2026-11',
        rates: { NOK: 1, INR: 0.125 },
        today: clock.now(),
      })
    )
);
