const { world } = require('../helpers');
const { money } = require('../../src/lib/money');

// Schedule a refill for `buyer`, move to the buying day, and restock it.
function restocked(w, officeId, buyer, categories = []) {
  w.book(officeId, w.tomorrow(), buyer);
  const r = w.service.reportEmpty(officeId, 'someone');
  w.nextMorning();
  return w.service.markRestocked(r.id, buyer, categories);
}

test('"Restocked" closes the refill and counts it, so a new "empty" starts a fresh refill', () => {
  const w = world();
  const r = restocked(w, 'BLR', 'asha', ['biscuits', 'fruit']);

  expect(r.status).toBe('RESTOCKED');
  expect(r.restockedAt).not.toBeNull();
  expect(r.categories).toEqual(['biscuits', 'fruit']);

  w.book('BLR', w.tomorrow(), 'asha', 'ravi');
  const next = w.service.reportEmpty('BLR', 'meera');
  expect(next.id).not.toBe(r.id);
  expect(next.buyerId).toBe('ravi'); // asha has 1 refill now, ravi 0
});

test("categories must come from the office's own list", () => {
  const w = world();
  w.book('BLR', w.tomorrow(), 'asha');
  const r = w.service.reportEmpty('BLR', 'ravi');
  expect(() => w.service.markRestocked(r.id, 'asha', ['crispbread & cheese'])).toThrow(
    'Unknown categories'
  );
});

test('receipt uploaded later creates the HR claim automatically', () => {
  const w = world();
  const r = restocked(w, 'BLR', 'asha', ['namkeen']);
  w.clock.advanceHours(14); // next morning

  const c = w.service.uploadReceipt(r.id, 'asha', money(2450, 'INR'), 'receipt.jpg');

  expect(c.status).toBe('CLAIM_SUBMITTED');
  expect(w.hr.claims[0]).toMatchObject({
    employeeId: 'asha',
    amount: 2450,
    currency: 'INR',
    receiptImage: 'receipt.jpg',
  });
});

test('forgot to tap "Restocked" but uploads the receipt: still counted', () => {
  const w = world();
  w.book('BLR', w.tomorrow(), 'asha');
  const r = w.service.reportEmpty('BLR', 'ravi');
  w.nextMorning();

  const c = w.service.uploadReceipt(r.id, 'asha', money(900, 'INR'), 'x.jpg');
  expect(c.status).toBe('CLAIM_SUBMITTED');
  expect(c.restockedAt).not.toBeNull();
});

test('only the buyer can upload, and only in the office currency', () => {
  const w = world();
  const r = restocked(w, 'BLR', 'asha');
  expect(() => w.service.uploadReceipt(r.id, 'ravi', money(900, 'INR'), 'x.jpg')).toThrow(
    'not waiting for a receipt'
  );
  expect(() => w.service.uploadReceipt(r.id, 'asha', money(100, 'NOK'), 'x.jpg')).toThrow(
    'purchases are in INR'
  );
});

test('above the usual max: flagged to an admin, but still sent to HR', () => {
  const w = world();
  const r = restocked(w, 'BLR', 'asha');
  const c = w.service.uploadReceipt(r.id, 'asha', money(3500, 'INR'), 'big.jpg');
  expect(c.status).toBe('CLAIM_SUBMITTED');
  expect(w.chat.admin.some((m) => m.text.includes('above the usual'))).toBe(true);
});

test('budget alerts at 80% and 100%, once each, and refills are never blocked', () => {
  const w = world('2026-11-02T09:00:00Z');
  const buy = (who, nok) => {
    const r = restocked(w, 'OSLO', who);
    w.service.uploadReceipt(r.id, who, money(nok, 'NOK'), 'r.jpg');
  };

  buy('ola', 1200);
  buy('kari', 1200);
  buy('ola', 1200); // 3600 = 60%
  expect(w.chat.admin).toHaveLength(0);
  buy('kari', 1200); // 4800 = 80%
  buy('ola', 1000); // 5800
  buy('kari', 1000); // 6800 = over 100%, still allowed
  expect(w.chat.admin.map((m) => m.text)).toEqual([
    expect.stringContaining('80%'),
    expect.stringContaining('100%'),
  ]);
  expect(w.hr.claims).toHaveLength(6);
});

test('HR approves → reimbursed; HR rejects → admin told; duplicate callbacks ignored', () => {
  const w = world();
  const a = restocked(w, 'BLR', 'asha');
  const ca = w.service.uploadReceipt(a.id, 'asha', money(800, 'INR'), 'a.jpg');
  expect(w.service.onHrDecision(ca.hrClaimId, true).status).toBe('REIMBURSED');
  expect(w.service.onHrDecision(ca.hrClaimId, false).status).toBe('REIMBURSED'); // ignored

  const b = restocked(w, 'BLR', 'ravi');
  const cb = w.service.uploadReceipt(b.id, 'ravi', money(700, 'INR'), 'b.jpg');
  expect(w.service.onHrDecision(cb.hrClaimId, false).status).toBe('CLAIM_REJECTED');
  expect(w.chat.admin.some((m) => m.text.includes('rejected'))).toBe(true);
});
