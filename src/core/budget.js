const { add, zero } = require('../lib/money');
const { monthOf } = require('../lib/days');

// Spend comes from receipts, by the month the receipt was uploaded. Rejected claims don't count.
function spentInMonth(office, refills, month) {
  return refills
    .filter((r) => r.officeId === office.id && r.receiptAt && monthOf(r.receiptAt) === month)
    .filter((r) => r.status !== 'CLAIM_REJECTED')
    .reduce((sum, r) => add(sum, r.amount), zero(office.currency));
}

// Which of 80% / 100% did this purchase cross? Each alert fires once per month.
function thresholdsCrossed(office, before, after) {
  const pct = (m) => (m.minor / office.monthlyBudget.minor) * 100;
  return [80, 100].filter((t) => pct(before) < t && pct(after) >= t);
}

module.exports = { spentInMonth, thresholdsCrossed };
