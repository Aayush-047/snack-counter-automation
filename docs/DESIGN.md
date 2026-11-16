# Snack Counter Automation: Design

## 1. Problem and approach

**Problem.** Each office's snack counter is kept stocked by volunteers who pay out of pocket and claim the money back through an external HR system. Because nobody owns the job, the box sits empty or two people buy on the same day. A few people do most refills and wait weeks for their money, and nobody knows what is spent or what gets eaten.

**Approach.** Make it clearly someone's turn, in a way that fits hybrid work:

- **Assigned only when needed.** When someone reports the box empty, the system picks **tomorrow's buyer** from home-office staff booked into the office tomorrow, and tells them the same day. Nothing happens on days the box isn't empty, so we never buy more often than we need to.
- **Fair turns** based on completed refills (section 3).
- **A 3-day backup stash** at each counter, so an empty box is never an emergency and a missed day can be absorbed.
- **Everything happens in the company chat**, and the **HR claim is created automatically** from the uploaded receipt, so reimbursement starts the same day.
- **Spend and what was bought are recorded** with every refill, giving one monthly report across both offices.

**Assumptions**

- Office presence (who is booked in tomorrow) comes from an existing login/logout or desk-booking system. If there isn't one, volunteers mark "in office" or "WFH" in the chat app instead.
- Snack duty only goes to staff whose home office is that office. Visitors from the other office are never asked to buy.
- HR's approval time (1–10 days) is outside our control.
- Each office's purchases, budget and claims stay in that office's own currency. Conversion to NOK is only used in management's report.

## 2. How a refill moves from "empty" to "reimbursed"

| #   | Step                  | What happens                                                                                                                                                                                                                                                        | Who                  |
| --- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| 1   | **Reported empty**    | Someone types `/snacks empty` and opens the backup stash. If a refill is already open for that counter, they are told who is on it ("Already reported. Ravi is buying tomorrow") and nothing new starts.                                                            | Anyone in the office |
| 2   | **Buyer chosen**      | The system picks tomorrow's buyer (section 3) and messages them that day.                                                                                                                                                                                           | System               |
| 3   | **Accept or pass**    | The buyer taps "OK" or "Won't be in tomorrow". A pass moves it to the next person that same day. If there is no reply within 2 hours, an office admin is notified to confirm with them; until then the buyer stays assigned.                                        | Buyer, admin         |
| 4   | **Restocked**         | Next day, the buyer refills the main box, tops the backup up to about 3 days, and taps "Restocked ✓" at the counter, ticking what they put in from the office's category list. The refill closes and counts as their refill, so it can't roll over to someone else. | Buyer                |
| 5   | **Receipt and claim** | The buyer uploads the receipt photo and amount, the same day or later. The system creates the HR claim straight away (amount, currency, description, receipt image, employee ID). If there's no receipt after 1 day, they get a reminder.                           | Buyer, system        |
| 6   | **Reimbursed**        | HR approves within 1–10 days. The system tells the buyer and closes the refill. If HR rejects it, an admin follows up.                                                                                                                                              | HR → system          |

**When things don't go to plan**

- **The buyer doesn't buy on their day.** That same day they are asked again whether they'll be in tomorrow. If yes, they're assigned again; if no, it goes to the next person. They stay first in line until they've actually bought.
- **The backup runs out as well** (`/snacks backup-empty`). The next purchase must cover both the main box and a full backup, and the buyer is told so.
- **No one is booked in tomorrow.** The backup covers the gap, and the refill goes to the next day on which someone is booked in.
- **The buyer bought but recorded nothing.** There are three checks before anyone else buys: tapping "Restocked" at the counter, uploading the receipt, and the evening "nothing recorded today" message. Even after the refill has moved on, the earlier buyer can still tap "Restocked" or upload; the refill comes back to them and the new buyer is told not to buy. If both have already bought, an admin reimburses the later receipt manually.
- **Duplicate reports.** There is only ever one open refill per counter, so a second report while one is open just shows who is on it. This is what stops two people buying on the same day.

## 3. Choosing who buys

1. **Who can be picked:** volunteers whose home office is that office and who are booked into the office tomorrow (working from home today doesn't matter). People choose to join or leave the volunteer pool.
2. **Order:** fewest _completed_ refills in the last 30 days, then whoever refilled longest ago. A rolling 30 days never resets suddenly at month end, and new or returning volunteers start near the top without being stuck with every refill.
3. **Never on the day itself:** once it's someone's buying day, the job doesn't move to anyone else that day. Nobody is surprised with a job in the morning.

## 4. Budget, currencies and reporting

**Budget (a soft limit, never blocking)**

- Each office's monthly budget stays in its own currency: Oslo 6,000 NOK, Bengaluru 15,000 INR.
- Refills are never blocked, because an empty snack counter is worse than a small overspend.
- Office admins are warned at 80% and 100% of the month's budget.
- A receipt above the usual maximum (1,200 NOK / 3,000 INR) is flagged for an admin to review but still reimbursed, so the volunteer is never left out of pocket. A double purchase (main box plus a full backup) is expected to be higher and is labelled as such.

**Currencies**

- Only an office's own staff buy for it, so every purchase and HR claim is in that office's currency, which is also the buyer's payroll currency. HR never converts anything.
- All amounts are stored as whole øre and paise, not decimals, so totals never drift from rounding.

**Monthly report (one for both offices)**

- For each office: total spent in its own currency, budget vs. actual, number of refills, claims still waiting on HR (count and oldest in days, so slow reimbursements are visible), and what was restocked (e.g. "biscuits 9×, fruit 2×"). Each office's admins edit their own category list, which always includes "Other". What was restocked tells us what ran out, so it is a proxy for what gets eaten, not an exact count.
- The stored figures are the real receipt amounts and never change. Next to each figure is a live NOK conversion at today's rate, labelled with the rate and date ("≈ 756 NOK at 1 INR = 0.126 NOK, 29 Nov"), plus a combined NOK total for both offices.
- Because every month is converted at the same rate, comparing months shows real changes in spending, not exchange-rate movements.

## 5. Main parts and the data each keeps

| Part                               | What it does                                                                                                                                                        | Data it keeps                                                                                                                                                       |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Refill**                         | Tracks one refill from "empty" to "reimbursed"                                                                                                                      | Office, status, reported by/at, current buyer, buying day, people who passed, needs-double flag, restocked at and categories, receipt amount and image, HR claim ID |
| **Buyer picker**                   | Chooses tomorrow's buyer (section 3)                                                                                                                                | Reads the volunteer pool, tomorrow's bookings and completed refills in the last 30 days                                                                             |
| **Budget and report**              | 80/100% alerts, large-receipt flags, monthly report                                                                                                                 | Office budgets and category lists; reads refills; today's rate, used for display only                                                                               |
| **Chat, HR and presence adapters** | Commands and messages; creating HR claims and receiving decisions; "who is booked in tomorrow?". Each can be swapped, and in the code they are simulated stand-ins. | HR claim ID ↔ refill                                                                                                                                                |

## 6. Trade-offs

- **Asking one person a day ahead, rather than everyone now:** slower to react, but nobody assumes someone else will do it and nobody double-buys. The backup absorbs the delay.
- **A soft budget, not a hard cap:** the budget can be exceeded, but the counter never goes empty, and any overspend is visible straight away.
- **A typed amount and category ticks, not reading receipts automatically:** much simpler and enough for the report. HR already checks the receipt image.
- **Live NOK at today's rate, not a frozen historical rate:** months compare fairly and there is nothing to close at month end, but it is not an accounting figure.
- **Presence from an existing system:** no daily check-in for people to forget, but it relies on accurate bookings. "Won't be in tomorrow" covers the gaps.

## 7. What we deliberately won't build

Company cards or paying shops directly (a finance policy change); reading receipts automatically (OCR), shelf sensors or stock counting; a separate app (everything happens in chat); our own approval workflow duplicating HR's; and snack analytics beyond the category ticks.
