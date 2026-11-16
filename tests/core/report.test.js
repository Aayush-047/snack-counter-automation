const { world } = require('../helpers');
const { money } = require('../../src/lib/money');
const { OFFICES } = require('../../src/data/setup');
const { monthlyReport, renderReport } = require('../../src/core/report');

const RATES = { NOK: 1, INR: 0.125 };

// Full cycle for one refill: scheduled → restocked → receipt uploaded.
function buy(w, officeId, who, amount, categories = []) {
  w.book(officeId, w.tomorrow(), who);
  const r = w.service.reportEmpty(officeId, 'someone');
  w.nextMorning();
  w.service.markRestocked(r.id, who, categories);
  return w.service.uploadReceipt(r.id, who, amount, `${r.id}.jpg`);
}

const report = (w) =>
  monthlyReport({
    offices: OFFICES,
    refills: w.store.all(),
    month: '2026-11',
    rates: RATES,
    today: w.clock.now(),
  });
const office = (rep, id) => rep.offices.find((o) => o.officeId === id);

test("totals stay in local currency; combined NOK uses today's rate", () => {
  const w = world('2026-11-02T09:00:00Z');
  buy(w, 'OSLO', 'ola', money(1000, 'NOK'));
  buy(w, 'OSLO', 'kari', money(450.5, 'NOK'));
  buy(w, 'BLR', 'asha', money(2400, 'INR'));
  buy(w, 'BLR', 'ravi', money(1600, 'INR'));

  const rep = report(w);
  expect(office(rep, 'OSLO').spent).toEqual(money(1450.5, 'NOK'));
  expect(office(rep, 'BLR').spent).toEqual(money(4000, 'INR'));
  expect(office(rep, 'BLR').spentNokToday).toEqual(money(500, 'NOK'));
  expect(rep.combinedNokToday).toEqual(money(1950.5, 'NOK')); // 1450.50 + 4000 × 0.125
});

test('a different rate today changes only the NOK view, never the stored INR', () => {
  const w = world('2026-11-02T09:00:00Z');
  buy(w, 'BLR', 'asha', money(6000, 'INR'));
  const refills = w.store.all();

  const a = monthlyReport({
    offices: OFFICES,
    refills,
    month: '2026-11',
    rates: { NOK: 1, INR: 0.125 },
    today: w.clock.now(),
  });
  const b = monthlyReport({
    offices: OFFICES,
    refills,
    month: '2026-11',
    rates: { NOK: 1, INR: 0.13 },
    today: w.clock.now(),
  });

  expect(office(a, 'BLR').spent).toEqual(money(6000, 'INR'));
  expect(office(b, 'BLR').spent).toEqual(money(6000, 'INR'));
  expect(office(a, 'BLR').spentNokToday).toEqual(money(750, 'NOK'));
  expect(office(b, 'BLR').spentNokToday).toEqual(money(780, 'NOK'));
});

test('shows claims still waiting on HR and the oldest wait', () => {
  const w = world('2026-11-02T09:00:00Z');
  const first = buy(w, 'BLR', 'asha', money(800, 'INR'));
  buy(w, 'BLR', 'ravi', money(700, 'INR'));
  w.clock.advanceHours(24 * 5);

  let rep = report(w);
  expect(office(rep, 'BLR').waitingOnHr).toBe(2);
  expect(office(rep, 'BLR').oldestWaitDays).toBe(6); // asha's has waited longest

  w.service.onHrDecision(first.hrClaimId, true);
  rep = report(w);
  expect(office(rep, 'BLR').waitingOnHr).toBe(1);
});

test('counts refills and what was restocked; rejected claims are not spend', () => {
  const w = world('2026-11-02T09:00:00Z');
  buy(w, 'BLR', 'asha', money(800, 'INR'), ['biscuits', 'namkeen']);
  const rejected = buy(w, 'BLR', 'ravi', money(700, 'INR'), ['biscuits']);
  w.service.onHrDecision(rejected.hrClaimId, false);

  const blr = office(report(w), 'BLR');
  expect(blr.refills).toBe(2);
  expect(blr.restocked).toEqual({ biscuits: 2, namkeen: 1 });
  expect(blr.spent).toEqual(money(800, 'INR'));
});

test('renders a readable report', () => {
  const w = world('2026-11-02T09:00:00Z');
  buy(w, 'BLR', 'asha', money(2400, 'INR'), ['biscuits']);
  const text = renderReport(report(w));
  expect(text).toContain('BLR: 2400.00 INR (≈ 300.00 NOK) of 15000.00 INR (16%)');
  expect(text).toContain('1 waiting on HR');
  expect(text).toContain('1 INR = 0.125 NOK');
});
