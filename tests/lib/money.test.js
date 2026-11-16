const { money, zero, add, isAbove, format, toNok } = require('../../src/lib/money');

test('stores amounts as whole paise / øre', () => {
  expect(money(2450.5, 'INR')).toEqual({ minor: 245050, currency: 'INR' });
});

test('adding ten 0.10 NOK gives exactly 1.00 NOK (no drift)', () => {
  let total = zero('NOK');
  for (let i = 0; i < 10; i++) total = add(total, money(0.1, 'NOK'));
  expect(total).toEqual(money(1, 'NOK'));
});

test('refuses to add INR to NOK', () => {
  expect(() => add(money(100, 'INR'), money(100, 'NOK'))).toThrow('Currency mismatch');
});

test('isAbove compares amounts', () => {
  expect(isAbove(money(3500, 'INR'), money(3000, 'INR'))).toBe(true);
  expect(isAbove(money(3000, 'INR'), money(3000, 'INR'))).toBe(false);
});

test('format shows two decimals and the currency', () => {
  expect(format(money(890, 'NOK'))).toBe('890.00 NOK');
});

test("toNok converts with today's rate", () => {
  expect(toNok(money(4000, 'INR'), { NOK: 1, INR: 0.125 })).toEqual(money(500, 'NOK'));
});
