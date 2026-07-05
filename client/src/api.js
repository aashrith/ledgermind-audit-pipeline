/**
 * Thin API client for the LedgerMind backend. A plain class (not a component) — the UI
 * classes call these methods from their lifecycle handlers.
 */
export class ApiClient {
  constructor(base = '/api') {
    this.base = base;
  }

  async _json(res) {
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const message = body && body.error && body.error.message ? body.error.message : res.statusText;
      const err = new Error(message);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  listEntries({ page = 1, pageSize = 20, severity, status, search } = {}) {
    const q = new URLSearchParams({ page, pageSize });
    if (severity) q.set('severity', severity);
    if (status) q.set('status', status);
    if (search) q.set('search', search);
    return fetch(`${this.base}/entries?${q.toString()}`).then((r) => this._json(r));
  }

  getEntry(id) {
    return fetch(`${this.base}/entries/${id}`).then((r) => this._json(r));
  }

  createEntry(body) {
    return fetch(`${this.base}/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => this._json(r));
  }

  updateCore(id, patch) {
    return fetch(`${this.base}/entries/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).then((r) => this._json(r));
  }

  updateAuditMetadata(id, patch) {
    return fetch(`${this.base}/entries/${id}/audit-metadata`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).then((r) => this._json(r));
  }

  searchSimilar(entryId, strategy, topK = 5) {
    return fetch(`${this.base}/entries/search/similar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entryId, strategy, topK }),
    }).then((r) => this._json(r));
  }

  health() {
    return fetch(`${this.base}/health`).then((r) => this._json(r));
  }
}

export const api = new ApiClient();
