const { add, zero, format, toNok } = require('../lib/money');
const { monthOf } = require('../lib/days');
const { spentInMonth } = require('./budget');

const DAY_MS = 24 * 60 * 60 * 1000;

// rates: today's rates, e.g. { NOK: 1, INR: 0.125 }. Used for display only.
function monthlyReport({ offices, refills, month, rates, today }) {
  const lines = Object.values(offices).map((office) => {
    const mine = refills.filter((r) => r.officeId === office.id);

    const spent = spentInMonth(office, refills, month);
    const restockedThisMonth = mine.filter(
      (r) => r.restockedAt && monthOf(r.restockedAt) === month
    );

    const restocked = {};
    for (const r of restockedThisMonth) {
      for (const c of r.categories) restocked[c] = (restocked[c] || 0) + 1;
    }

    // Claims still waiting on HR, from any month: how long people are out of pocket.
    const waiting = mine.filter((r) => r.status === 'CLAIM_SUBMITTED');
    const oldestWaitDays = waiting.length
      ? Math.floor(Math.max(...waiting.map((r) => today - r.receiptAt)) / DAY_MS)
      : 0;

    return {
      officeId: office.id,
      spent,
      budget: office.monthlyBudget,
      budgetUsedPct: Math.round((spent.minor / office.monthlyBudget.minor) * 100),
      spentNokToday: toNok(spent, rates),
      refills: restockedThisMonth.length,
      waitingOnHr: waiting.length,
      oldestWaitDays,
      restocked,
    };
  });

  return {
    month,
    offices: lines,
    combinedNokToday: lines.reduce((sum, l) => add(sum, l.spentNokToday), zero('NOK')),
    rateNote: `1 INR = ${rates.INR} NOK, as of ${today.toISOString().slice(0, 10)}`,
  };
}

function renderReport(report) {
  const out = [`Snack spending ${report.month}`];
  for (const l of report.offices) {
    const nok = l.spent.currency === 'NOK' ? '' : ` (≈ ${format(l.spentNokToday)})`;
    const items = Object.entries(l.restocked)
      .sort((a, b) => b[1] - a[1])
      .map(([c, n]) => `${c} ${n}×`)
      .join(', ');
    out.push(
      `${l.officeId}: ${format(l.spent)}${nok} of ${format(l.budget)} (${l.budgetUsedPct}%), ` +
        `${l.refills} refills, ${l.waitingOnHr} waiting on HR` +
        (l.waitingOnHr ? ` (oldest ${l.oldestWaitDays} days)` : '') +
        (items ? `; restocked: ${items}` : '')
    );
  }
  out.push(`Combined ≈ ${format(report.combinedNokToday)} (${report.rateNote})`);
  return out.join('\n');
}

module.exports = { monthlyReport, renderReport };
