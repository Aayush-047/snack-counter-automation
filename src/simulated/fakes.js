// Simulated stand-ins for the chat tool, the HR system, desk bookings and time.

class FakeChat {
  constructor() {
    this.direct = []; // { to, text }
    this.admin = []; // { officeId, text }
  }
  sendDirect(to, text) {
    this.direct.push({ to, text });
  }
  notifyAdmins(officeId, text) {
    this.admin.push({ officeId, text });
  }
  messagesTo(person) {
    return this.direct.filter((m) => m.to === person).map((m) => m.text);
  }
}

class FakeHr {
  constructor() {
    this.claims = [];
  }
  // claim = { employeeId, amount, currency, description, receiptImage }
  createClaim(claim) {
    const id = `HR-${this.claims.length + 1}`;
    this.claims.push({ ...claim, id });
    return id;
  }
}

class FakeBookings {
  constructor() {
    this.bookings = new Set();
  }
  book(person, officeId, day) {
    this.bookings.add(`${person}|${officeId}|${day}`);
  }
  cancel(person, officeId, day) {
    this.bookings.delete(`${person}|${officeId}|${day}`);
  }
  isBookedIn(person, officeId, day) {
    return this.bookings.has(`${person}|${officeId}|${day}`);
  }
}

class FakeClock {
  constructor(iso) {
    this.current = new Date(iso);
  }
  now() {
    return new Date(this.current);
  }
  set(iso) {
    this.current = new Date(iso);
  }
  advanceHours(h) {
    this.current = new Date(this.current.getTime() + h * 60 * 60 * 1000);
  }
}

module.exports = { FakeChat, FakeHr, FakeBookings, FakeClock };
