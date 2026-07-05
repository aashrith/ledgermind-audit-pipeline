import React from 'react';
import { api } from '../api.js';
import EntryTable from './EntryTable.jsx';
import EntryDetailModal from './EntryDetailModal.jsx';

const REFRESH_MS = 4000;

/**
 * Top-level auditor dashboard. Owns list/filter/pagination/selection state and polls for
 * live enrichment-status updates. Class component using componentDidMount /
 * componentWillUnmount for the polling lifecycle.
 */
export default class AuditDashboard extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      entries: [],
      total: 0,
      page: 1,
      pageSize: 20,
      severity: '',
      status: '',
      search: '',
      loading: true,
      error: null,
      selected: null,
      health: null,
    };
    this.timer = null;
  }

  componentDidMount() {
    this.fetchEntries();
    this.fetchHealth();
    this.timer = setInterval(() => {
      this.fetchEntries({ quiet: true });
      this.fetchHealth();
    }, REFRESH_MS);
  }

  componentWillUnmount() {
    if (this.timer) clearInterval(this.timer);
  }

  fetchEntries = async ({ quiet = false } = {}) => {
    if (!quiet) this.setState({ loading: true, error: null });
    try {
      const { page, pageSize, severity, status, search } = this.state;
      const data = await api.listEntries({
        page,
        pageSize,
        severity: severity || undefined,
        status: status || undefined,
        search: search.length >= 2 ? search : undefined,
      });
      this.setState({ entries: data.items, total: data.total, loading: false });
    } catch (err) {
      this.setState({ error: err.message, loading: false });
    }
  };

  fetchHealth = async () => {
    try {
      this.setState({ health: await api.health() });
    } catch (e) {
      /* health is best-effort */
    }
  };

  onFilter = (field) => (event) => {
    this.setState({ [field]: event.target.value, page: 1 }, this.fetchEntries);
  };

  onSearch = (event) => {
    this.setState({ search: event.target.value, page: 1 }, this.fetchEntries);
  };

  changePage = (delta) => {
    const next = this.state.page + delta;
    if (next < 1) return;
    this.setState({ page: next }, this.fetchEntries);
  };

  openEntry = (entry) => this.setState({ selected: entry });
  closeEntry = () => this.setState({ selected: null }, this.fetchEntries);

  render() {
    const { entries, total, page, pageSize, severity, status, search, loading, error, selected, health } = this.state;
    const maxPage = Math.max(1, Math.ceil(total / pageSize));
    const q = health && health.queue ? health.queue : null;

    return (
      <div className="container-fluid py-3">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <h4 className="mb-0">LedgerMind Audit Pipeline</h4>
            <small className="text-muted">Asynchronous AI-enriched journal auditing</small>
          </div>
          {q && (
            <div className="small text-muted">
              queue — <span className="text-secondary">pending {q.pending}</span>,{' '}
              <span className="text-info">processing {q.processing}</span>,{' '}
              <span className="text-success">completed {q.completed}</span>,{' '}
              <span className="text-danger">failed {q.failed}</span>
              <span className="ms-2">db: {health.db}</span>
            </div>
          )}
        </div>

        <div className="card shadow-sm">
          <div className="card-body">
            <div className="row g-2 mb-3">
              <div className="col-md-4">
                <input
                  className="form-control"
                  data-testid="search"
                  placeholder="Search entry no / description / name…"
                  value={search}
                  onChange={this.onSearch}
                />
              </div>
              <div className="col-md-3">
                <select className="form-select" value={severity} onChange={this.onFilter('severity')}>
                  <option value="">All severities</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div className="col-md-3">
                <select className="form-select" value={status} onChange={this.onFilter('status')}>
                  <option value="">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                  <option value="stale">Stale</option>
                </select>
              </div>
              <div className="col-md-2 text-end">
                <button className="btn btn-outline-secondary w-100" onClick={() => this.fetchEntries()}>
                  Refresh
                </button>
              </div>
            </div>

            {error && <div className="alert alert-danger py-2">{error}</div>}
            {loading ? (
              <div className="text-center text-muted py-4">Loading…</div>
            ) : (
              <EntryTable entries={entries} onSelect={this.openEntry} />
            )}

            <div className="d-flex justify-content-between align-items-center mt-3">
              <small className="text-muted">{total} entries</small>
              <div className="btn-group">
                <button className="btn btn-sm btn-outline-secondary" disabled={page <= 1} onClick={() => this.changePage(-1)}>
                  ← Prev
                </button>
                <span className="btn btn-sm btn-light disabled">
                  {page} / {maxPage}
                </span>
                <button className="btn btn-sm btn-outline-secondary" disabled={page >= maxPage} onClick={() => this.changePage(1)}>
                  Next →
                </button>
              </div>
            </div>
          </div>
        </div>

        {selected && (
          <EntryDetailModal entryId={selected.id} onClose={this.closeEntry} onChanged={() => this.fetchEntries({ quiet: true })} />
        )}
      </div>
    );
  }
}
