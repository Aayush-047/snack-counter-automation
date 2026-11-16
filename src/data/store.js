const { OPEN_STATUSES } = require('./setup');

class ConflictError extends Error {}

// In-memory store. In production: a DB table with a `version` column and a
// unique index allowing only one open refill per office.
class RefillStore {
  constructor() {
    this.rows = new Map();
    this.seq = 0;
  }

  nextId() {
    this.seq += 1;
    return `R-${this.seq}`;
  }

  get(id) {
    const r = this.rows.get(id);
    if (!r) throw new Error(`Unknown refill ${id}`);
    return structuredClone(r); // callers get a copy, never the stored object
  }

  all() {
    return [...this.rows.values()].map((r) => structuredClone(r));
  }

  findOpen(officeId) {
    const r = [...this.rows.values()].find(
      (x) => x.officeId === officeId && OPEN_STATUSES.includes(x.status)
    );
    return r ? structuredClone(r) : null;
  }

  insert(refill) {
    if (this.findOpen(refill.officeId)) {
      throw new Error(`${refill.officeId} already has an open refill`);
    }
    this.rows.set(refill.id, structuredClone(refill));
    return this.get(refill.id);
  }

  // Save only if nobody else saved since we read `expectedVersion`.
  update(refill, expectedVersion) {
    const current = this.rows.get(refill.id);
    if (!current || current.version !== expectedVersion) {
      throw new ConflictError(`Refill ${refill.id} was changed by someone else`);
    }
    this.rows.set(refill.id, { ...structuredClone(refill), version: expectedVersion + 1 });
    return this.get(refill.id);
  }
}

module.exports = { RefillStore, ConflictError };
