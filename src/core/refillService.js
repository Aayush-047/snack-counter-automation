const { newRefill } = require('../data/setup');
const { pickBuyer } = require('./picker');
const { format, isAbove } = require('../lib/money');
const { spentInMonth, thresholdsCrossed } = require('./budget');
const { dayOf, addDays, monthOf, isBuyingDayOver } = require('../lib/days');

const HOURS = 60 * 60 * 1000;

class RefillService {
  constructor({ offices, volunteers, store, chat, hr, bookings, clock }) {
    Object.assign(this, { offices, volunteers, store, chat, hr, bookings, clock });
  }

  // `/snacks empty` — only ever one open refill per office.
  reportEmpty(officeId, reporterId) {
    const open = this.store.findOpen(officeId);
    if (open) {
      this.chat.sendDirect(
        reporterId,
        open.buyerId
          ? `Already reported. ${open.buyerId} is buying on ${open.buyDay}.`
          : 'Already reported. It will be picked up on the next day someone is booked in.'
      );
      return open;
    }

    const refill = this.store.insert(
      newRefill(this.store.nextId(), officeId, reporterId, this.clock.now())
    );
    const tomorrow = addDays(dayOf(this.clock.now()), 1);
    return this.schedule(refill, tomorrow);
  }

  // `/snacks backup-empty`: the next purchase covers the main box + a full backup.
  reportBackupEmpty(officeId, reporterId) {
    const r = this.reportEmpty(officeId, reporterId); // reuses the open refill, or creates one
    if (r.needsDouble) return r; // already marked

    const saved = this.store.update({ ...r, needsDouble: true }, r.version);
    if (saved.buyerId) {
      this.chat.sendDirect(
        saved.buyerId,
        `The backup ran out too: please refill the main box and a full backup (${saved.id}).`
      );
    }
    return saved;
  }

  // Reply "OK"
  confirm(refillId, employeeId) {
    const r = this.mustBeBuyer(refillId, employeeId);
    return this.store.update({ ...r, confirmed: true }, r.version);
  }

  // Reply "won't be in": handed to the next person, same buying day, told today.
  pass(refillId, employeeId) {
    const r = this.mustBeBuyer(refillId, employeeId);
    if (dayOf(this.clock.now()) >= r.buyDay) {
      throw new Error(
        'It is already your buying day; if you cannot buy, it rolls over this evening.'
      );
    }
    return this.schedule({ ...r, passedBy: [...r.passedBy, employeeId] }, r.buyDay);
  }

  // 8a. At the counter: "Restocked ✓" + ticked categories. Closes the refill and counts it.
  markRestocked(refillId, employeeId, categories) {
    this.takeBackIfFormerBuyer(this.store.get(refillId), employeeId);
    const r = this.mustBeBuyer(refillId, employeeId);
    this.checkCategories(r.officeId, categories);
    const saved = this.store.update(
      { ...r, status: 'RESTOCKED', restockedAt: this.clock.now(), categories },
      r.version
    );
    this.chat.sendDirect(
      employeeId,
      'Thanks for restocking! Upload your receipt to get your money back.'
    );
    return saved;
  }

  // 8b. Receipt upload (same day or later): HR claim + budget alerts.
  uploadReceipt(refillId, employeeId, amount, receiptRef) {
    const r = this.takeBackIfFormerBuyer(this.store.get(refillId), employeeId);

    // Rare: both bought (new buyer already restocked). Reimburse the late one manually.
    if (r.formerBuyers.includes(employeeId) && r.buyerId !== employeeId) {
      this.chat.notifyAdmins(
        r.officeId,
        `Refill ${r.id}: ${employeeId} also bought (${format(amount)}, receipt ${receiptRef}). Please reimburse manually.`
      );
      return r;
    }

    // Safety net: a former buyer uploads late after the refill moved on.
    if (r.formerBuyers.includes(employeeId) && r.buyerId !== employeeId) {
      if (r.status === 'SCHEDULED') {
        // Current buyer hasn't restocked yet: the late receipt closes it.
        this.chat.sendDirect(r.buyerId, `Already done by ${employeeId}, no need to buy 👍`);
        this.chat.notifyAdmins(
          r.officeId,
          `Refill ${r.id}: ${employeeId} uploaded late after it moved to ${r.buyerId}; ${r.buyerId} told not to buy.`
        );
        const taken = this.store.update({ ...r, buyerId: employeeId }, r.version);
        return this.uploadReceipt(refillId, employeeId, amount, receiptRef);
      }
      // Both bought: reimburse manually so nobody is out of pocket.
      this.chat.notifyAdmins(
        r.officeId,
        `Refill ${r.id}: ${employeeId} also bought (${format(amount)}, receipt ${receiptRef}). Please reimburse manually.`
      );
      return r;
    }

    if (r.buyerId !== employeeId || !['RESTOCKED', 'SCHEDULED'].includes(r.status)) {
      throw new Error(`Refill ${refillId} is not waiting for a receipt from ${employeeId}`);
    }
    const office = this.offices[r.officeId];
    if (amount.currency !== office.currency) {
      throw new Error(`${office.name} purchases are in ${office.currency}`);
    }

    const now = this.clock.now();
    const before = spentInMonth(office, this.store.all(), monthOf(now));

    const claimId = this.hr.createClaim({
      employeeId,
      amount: amount.minor / 100,
      currency: amount.currency,
      description: `Snack counter refill ${r.id} (${office.name})${r.needsDouble ? ', main box + backup' : ''}`,
      receiptImage: receiptRef,
    });

    const saved = this.store.update(
      {
        ...r,
        status: 'CLAIM_SUBMITTED',
        restockedAt: r.restockedAt || now, // forgot to tap "Restocked": count it now
        amount,
        receiptRef,
        receiptAt: now,
        hrClaimId: claimId,
      },
      r.version
    );
    this.chat.sendDirect(
      employeeId,
      `Your claim of ${format(amount)} was sent to HR (${claimId}).`
    );

    // Soft budget: never blocks, only flags.
    const usual = r.needsDouble
      ? { ...office.usualMax, minor: office.usualMax.minor * 2 }
      : office.usualMax;
    if (isAbove(amount, usual)) {
      this.chat.notifyAdmins(
        r.officeId,
        `Refill ${r.id}: ${format(amount)} is above the usual ${format(usual)}. Please review (already sent to HR).`
      );
    }
    const after = spentInMonth(office, this.store.all(), monthOf(now));
    for (const t of thresholdsCrossed(office, before, after)) {
      this.chat.notifyAdmins(
        r.officeId,
        `${office.name} has used ${t}% of this month's snack budget (${format(after)} of ${format(office.monthlyBudget)}).`
      );
    }
    return saved;
  }

  // HR's decision comes back later (1–10 days). Duplicate callbacks are ignored.
  onHrDecision(claimId, approved) {
    const r = this.store.all().find((x) => x.hrClaimId === claimId);
    if (!r) throw new Error(`No refill for claim ${claimId}`);
    if (r.status !== 'CLAIM_SUBMITTED') return r;

    const saved = this.store.update(
      {
        ...r,
        status: approved ? 'REIMBURSED' : 'CLAIM_REJECTED',
        reimbursedAt: approved ? this.clock.now() : null,
      },
      r.version
    );
    if (approved) {
      this.chat.sendDirect(r.buyerId, `HR approved your snack claim ${claimId}.`);
    } else {
      this.chat.sendDirect(
        r.buyerId,
        `HR rejected your snack claim ${claimId}; an admin will follow up.`
      );
      this.chat.notifyAdmins(
        r.officeId,
        `HR rejected claim ${claimId} for refill ${r.id}. Please follow up.`
      );
    }
    return saved;
  }

  checkCategories(officeId, categories) {
    const unknown = categories.filter((c) => !this.offices[officeId].categories.includes(c));
    if (unknown.length) throw new Error(`Unknown categories: ${unknown.join(', ')}`);
  }

  // Only the assigned buyer of a scheduled refill can act on it.
  mustBeBuyer(refillId, employeeId) {
    const r = this.store.get(refillId);
    if (r.status !== 'SCHEDULED') {
      throw new Error(`Refill ${refillId} is not scheduled (${r.status})`);
    }
    if (r.buyerId !== employeeId) {
      throw new Error(`Refill ${refillId} is assigned to ${r.buyerId}, not ${employeeId}`);
    }
    return r;
  }

  // Check 3: a former buyer says "I did buy" after the refill moved on.
  // If the new buyer hasn't restocked yet, hand it back and tell them not to buy.
  takeBackIfFormerBuyer(r, employeeId) {
    if (
      !r.formerBuyers.includes(employeeId) ||
      r.buyerId === employeeId ||
      r.status !== 'SCHEDULED'
    ) {
      return r;
    }
    this.chat.sendDirect(r.buyerId, `Already done by ${employeeId}, no need to buy 👍`);
    this.chat.notifyAdmins(
      r.officeId,
      `Refill ${r.id}: ${employeeId} restocked late after it moved to ${r.buyerId}; ${r.buyerId} told not to buy.`
    );
    return this.store.update({ ...r, buyerId: employeeId }, r.version);
  }

  // Pick the buyer for `buyDay` and tell them today.
  schedule(refill, buyDay, { preferred = null, quiet = false } = {}) {
    const buyer = pickBuyer({
      officeId: refill.officeId,
      buyDay,
      volunteers: this.volunteers,
      refills: this.store.all(),
      bookings: this.bookings,
      now: this.clock.now(),
      exclude: refill.passedBy,
      preferred,
    });

    if (!buyer) {
      if (quiet) return refill; // still nobody; don't spam admins
      this.chat.notifyAdmins(
        refill.officeId,
        `Refill ${refill.id}: nobody is booked in on ${buyDay}. The backup covers it; retrying daily.`
      );
      return this.store.update(
        {
          ...refill,
          status: 'WAITING_FOR_BOOKING',
          buyerId: null,
          buyDay: null,
          askedAt: null,
        },
        refill.version
      );
    }

    const saved = this.store.update(
      {
        ...refill,
        status: 'SCHEDULED',
        buyerId: buyer.employeeId,
        buyDay,
        askedAt: this.clock.now(),
        confirmed: false,
        adminReminded: false,
      },
      refill.version
    );
    this.chat.sendDirect(
      buyer.employeeId,
      `You're on snack duty for ${this.offices[refill.officeId].name} on ${buyDay}. ` +
        `Refill the main box and top up the backup. Reply OK, or "won't be in". (${refill.id})`
    );
    return saved;
  }

  // Runs every ~15 minutes.
  tick() {
    const now = this.clock.now();
    const changed = [];

    for (const r of this.store.all()) {
      if (r.status === 'SCHEDULED' && isBuyingDayOver(r.buyDay, now)) {
        // Buying day over, nothing recorded: warn and reschedule, same person first.
        this.chat.sendDirect(
          r.buyerId,
          `Nothing recorded today for ${r.id}. If you bought, tap Restocked or upload your receipt; otherwise it's scheduled again.`
        );
        const formerBuyers = [...new Set([...r.formerBuyers, r.buyerId])];
        changed.push(
          this.schedule({ ...r, passedBy: [], formerBuyers }, addDays(dayOf(now), 1), {
            preferred: r.buyerId,
          })
        );
      } else if (
        r.status === 'SCHEDULED' &&
        !r.confirmed &&
        !r.adminReminded &&
        now - r.askedAt >= 2 * HOURS
      ) {
        // No reply in 2 hours: tell an admin once; the buyer stays assigned.
        this.chat.notifyAdmins(
          r.officeId,
          `${r.buyerId} hasn't confirmed snack duty for ${r.buyDay} (${r.id}). Please check with them.`
        );
        changed.push(this.store.update({ ...r, adminReminded: true }, r.version));
      } else if (
        r.status === 'RESTOCKED' &&
        !r.receiptReminded &&
        now - r.restockedAt >= 24 * HOURS
      ) {
        // Restocked but no receipt after a day: remind once.
        this.chat.sendDirect(r.buyerId, `Upload your receipt for ${r.id} to get your money back.`);
        changed.push(this.store.update({ ...r, receiptReminded: true }, r.version));
      } else if (r.status === 'WAITING_FOR_BOOKING') {
        // Retry quietly: only act if someone is now booked in tomorrow.
        const retried = this.schedule(r, addDays(dayOf(now), 1), { quiet: true });
        if (retried.status === 'SCHEDULED') changed.push(retried);
      }
    }
    return changed;
  }
}

module.exports = { RefillService };
