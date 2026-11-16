// Days are "YYYY-MM-DD" strings, kept in UTC for simplicity.
// A real version would use each office's own time zone.

function dayOf(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(day, n) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return dayOf(d);
}

function monthOf(date) {
  return date.toISOString().slice(0, 7);
}

// After this hour (UTC) the buying day counts as over.
const END_OF_DAY_HOUR = 18;

function isBuyingDayOver(buyDay, now) {
  return now >= new Date(`${buyDay}T${END_OF_DAY_HOUR}:00:00Z`);
}

module.exports = { dayOf, addDays, monthOf, isBuyingDayOver };
