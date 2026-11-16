const { money } = require('../lib/money');

// Each office's admins can edit their own list. "Other" is always there.
const OSLO_CATEGORIES = [
  'chips',
  'chocolate',
  'biscuits',
  'fruit',
  'crispbread & cheese',
  'drinks',
  'healthy snacks',
  'Other',
];
const BLR_CATEGORIES = [
  'namkeen',
  'biscuits',
  'chips',
  'chocolate',
  'fruit',
  'dry fruits & nuts',
  'drinks',
  'Other',
];

// Budgets and typical purchases from the brief. Admins can edit categories per office.
const OFFICES = {
  OSLO: {
    id: 'OSLO',
    name: 'Oslo',
    currency: 'NOK',
    monthlyBudget: money(6000, 'NOK'),
    usualMax: money(1200, 'NOK'),
    categories: OSLO_CATEGORIES,
  },
  BLR: {
    id: 'BLR',
    name: 'Bengaluru',
    currency: 'INR',
    monthlyBudget: money(15000, 'INR'),
    usualMax: money(3000, 'INR'),
    categories: BLR_CATEGORIES,
  },
};

// Sample volunteers for tests and the demo.
const VOLUNTEERS = [
  { employeeId: 'ola', name: 'Ola', homeOffice: 'OSLO', active: true },
  { employeeId: 'kari', name: 'Kari', homeOffice: 'OSLO', active: true },
  { employeeId: 'asha', name: 'Asha', homeOffice: 'BLR', active: true },
  { employeeId: 'ravi', name: 'Ravi', homeOffice: 'BLR', active: true },
  { employeeId: 'meera', name: 'Meera', homeOffice: 'BLR', active: true },
  { employeeId: 'dev', name: 'Dev', homeOffice: 'BLR', active: false }, // left the pool
];

// A refill is "open" until it's bought.
const OPEN_STATUSES = ['SCHEDULED', 'WAITING_FOR_BOOKING'];

function newRefill(id, officeId, reportedBy, reportedAt) {
  return {
    id,
    officeId,
    status: 'WAITING_FOR_BOOKING',
    version: 0,
    reportedBy,
    reportedAt,
    buyerId: null,
    buyDay: null,
    askedAt: null,
    confirmed: false,
    adminReminded: false,
    passedBy: [],
    formerBuyers: [], // people this refill moved away from on rollover
    receiptReminded: false,
    needsDouble: false,
    amount: null,
    categories: [],
    receiptRef: null,
    restockedAt: null,
    receiptAt: null,
    hrClaimId: null,
    reimbursedAt: null,
  };
}

module.exports = { OFFICES, VOLUNTEERS, OPEN_STATUSES, newRefill };
