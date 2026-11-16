// All amounts are stored as whole minor units (øre / paise) so totals never drift.

function money(major, currency) {
  return { minor: Math.round(major * 100), currency };
}

function zero(currency) {
  return { minor: 0, currency };
}

function sameCurrency(a, b) {
  if (a.currency !== b.currency) {
    throw new Error(`Currency mismatch: ${a.currency} vs ${b.currency}`);
  }
}

function add(a, b) {
  sameCurrency(a, b);
  return { minor: a.minor + b.minor, currency: a.currency };
}

function isAbove(a, b) {
  sameCurrency(a, b);
  return a.minor > b.minor;
}

function format(m) {
  return `${(m.minor / 100).toFixed(2)} ${m.currency}`;
}

// rates = how many NOK one unit is worth today, e.g. { NOK: 1, INR: 0.125 }
function toNok(m, rates) {
  return { minor: Math.round(m.minor * rates[m.currency]), currency: 'NOK' };
}

module.exports = { money, zero, add, isAbove, format, toNok };
