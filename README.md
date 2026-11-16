# Snack Counter Automation

My Framsikt take-home for the Product Engineer role. It is the core logic for running the snack counters in Oslo and Bengaluru: the refill lifecycle, choosing who buys, the soft budget check and the monthly report. The company chat tool, the HR system and desk bookings are replaced by simulated stand-ins.

**Design document:** [docs/DESIGN.md](docs/DESIGN.md) (also attached as a PDF)

## Run

```bash
npm install
npm test        # 50 tests
npm run demo    # a week of refills end to end, with chat messages and the monthly report
```

Requires Node 18 or later. Plain JavaScript, with Jest for tests.

## Code layout

| Folder / file               | What it does                                                                                                                                                    |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/core/refillService.js` | The lifecycle: `reportEmpty`, `reportBackupEmpty`, `confirm`, `pass`, `markRestocked`, `uploadReceipt`, `onHrDecision`, and `tick`                              |
| `src/core/picker.js`        | Choosing who buys: home office, booked in tomorrow, fewest restocks in the last 30 days, then whoever restocked longest ago; on rollover, the same person first |
| `src/core/budget.js`        | Soft budget: monthly spend from receipts, and 80% / 100% alerts                                                                                                 |
| `src/core/report.js`        | Monthly report: local-currency totals, live NOK at today's rate, claims waiting on HR, and restocked categories                                                 |
| `src/data/setup.js`         | Offices (budgets, usual max, category lists), sample volunteers, and the refill shape                                                                           |
| `src/data/store.js`         | Storage: one open refill per office, and versioned saves so two people can't overwrite each other                                                               |
| `src/lib/money.js`          | Money as whole øre / paise (no rounding drift)                                                                                                                  |
| `src/lib/days.js`           | Day helpers and the end-of-day cutoff for rollovers                                                                                                             |
| `src/simulated/fakes.js`    | Simulated chat, HR, desk bookings and clock; real systems would replace these without touching `core/`                                                          |
| `src/demo.js`               | Scripted walkthrough                                                                                                                                            |
| `tests/core/`, `tests/lib/` | Tests mirroring `src/`; `tests/helpers.js` builds a fresh simulated world for each test                                                                         |

`tick()` runs every ~15 minutes. It handles:

- the 2-hour admin reminder;
- the evening rollover, which also sends a "nothing recorded today" message;
- the 1-day receipt reminder;
- quiet retries for refills waiting on bookings.

## Rules the tests prove

- **`money.test.js`:** whole minor units, no drift, and INR is never mixed with NOK.
- **`picker.test.js`:**
  - only home-office volunteers booked in that day are picked (no visitors, no leavers);
  - the person with the fewest restocks in the last 30 days goes first;
  - ties go to whoever restocked longest ago;
  - "won't be in" is respected;
  - on rollover, the same person is asked first.
- **`reportEmpty.test.js`:**
  - a second "empty" report reuses the open refill (no double-buying);
  - each office has its own refill;
  - if nobody is booked in, the refill waits and an admin is told;
  - stale saves are rejected.
- **`reply.test.js`:**
  - only the assigned buyer can reply, so two people cannot both commit;
  - "won't be in" passes it to the next person the same day;
  - it is never moved on the buying day itself.
- **`restockAndReceipt.test.js`:**
  - "Restocked" closes the refill and counts it;
  - the receipt can be uploaded later, and the HR claim is created automatically;
  - only the office's own currency and categories are accepted;
  - receipts above the usual max are flagged;
  - budget alerts fire once each and never block a refill;
  - HR approvals, rejections and duplicate callbacks are handled.
- **`tick.test.js`:**
  - admin reminder after 2 hours (once only);
  - rollover to the same person, or to the next person if they aren't booked in;
  - receipt reminder;
  - quiet retry while waiting on bookings;
  - the three checks before anyone else buys, including a late "Restocked" or receipt from a former buyer.
- **`backup.test.js`:** an empty backup turns the open refill into a double purchase, the buyer is told once, and up to 2× the usual max is allowed.
- **`report.test.js`:**
  - the combined NOK total is correct across both currencies;
  - today's rate changes only the NOK view, never the stored figures;
  - claims waiting on HR and the oldest wait are shown;
  - restocked categories are counted;
  - rejected claims are excluded from spend.

## Simplifications

- **Days are in UTC.** A real version would use each office's time zone. The rollover cutoff is 18:00.
- **Storage is in memory.** `store.js` describes the database constraints it stands in for.
