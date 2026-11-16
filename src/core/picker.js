const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// Returns the volunteer who should buy for `officeId` on `buyDay`, or null if nobody can.
function pickBuyer({
  officeId,
  buyDay,
  volunteers,
  refills,
  bookings,
  now,
  exclude = [],
  preferred = null,
}) {
  const candidates = volunteers
    .filter((v) => v.active && v.homeOffice === officeId) // no visitors, no leavers
    .filter((v) => bookings.isBookedIn(v.employeeId, officeId, buyDay)) // in the office that day
    .filter((v) => !exclude.includes(v.employeeId)) // said "won't be in"
    .map((v) => {
      // Only completed refills count; being asked doesn't.
      const done = refills.filter((r) => r.buyerId === v.employeeId && r.restockedAt);
      const recent = done.filter((r) => now - r.restockedAt < THIRTY_DAYS_MS);
      const lastAt = done.length ? Math.max(...done.map((r) => r.restockedAt.getTime())) : 0;
      return { volunteer: v, recentCount: recent.length, lastAt };
    });

  candidates.sort(
    (a, b) =>
      a.recentCount - b.recentCount || // fewest in last 30 days first
      a.lastAt - b.lastAt || // then longest ago (never = 0, so first)
      a.volunteer.employeeId.localeCompare(b.volunteer.employeeId) // stable final tie-break
  );

  // On rollover, the person who didn't buy is asked again first.
  const again = candidates.find((c) => c.volunteer.employeeId === preferred);
  if (again) return again.volunteer;

  return candidates.length ? candidates[0].volunteer : null;
}

module.exports = { pickBuyer };
