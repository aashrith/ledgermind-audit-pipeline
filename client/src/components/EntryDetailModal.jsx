import React from 'react';
import { api } from '../api.js';
import RiskBadge, { StatusBadge } from './RiskBadge.jsx';
import VectorDiagnosticsPanel from './VectorDiagnosticsPanel.jsx';
import SimilaritySearchPanel from './SimilaritySearchPanel.jsx';
import UpdateControls from './UpdateControls.jsx';

const POLL_MS = 3000;

function field(label, value) {
  return (
    <div className="col-6 col-md-4 mb-2">
      <div className="text-muted small">{label}</div>
      <div>{value != null && value !== '' ? String(value) : '—'}</div>
    </div>
  );
}

/**
 * Deep-dive diagnostics modal for one entry. Fetches on mount and polls while open so a
 * triggered recomputation (stale → completed) is reflected live. Class component using
 * componentDidMount / componentWillUnmount for the polling lifecycle.
 */
export default class EntryDetailModal extends React.Component {
  constructor(props) {
    super(props);
    this.state = { entry: null, loading: true, error: null };
    this.timer = null;
  }

  componentDidMount() {
    this.refresh();
    this.timer = setInterval(this.refresh, POLL_MS);
  }

  componentWillUnmount() {
    if (this.timer) clearInterval(this.timer);
  }

  refresh = async () => {
    try {
      const entry = await api.getEntry(this.props.entryId);
      this.setState({ entry, loading: false, error: null });
    } catch (err) {
      this.setState({ error: err.message, loading: false });
    }
  };

  onChanged = () => {
    this.refresh();
    this.props.onChanged();
  };

  render() {
    const { onClose } = this.props;
    const { entry, loading, error } = this.state;
    const intel = entry ? entry.intelligence : null;

    return (
      <div>
        <div className="modal fade show d-block" tabIndex="-1" role="dialog">
          <div className="modal-dialog modal-xl modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {entry ? `${entry.entryNo} · ${entry.name}` : 'Entry diagnostics'}
                  {intel && <span className="ms-2"><StatusBadge status={intel.status} /></span>}
                </h5>
                <button type="button" className="btn-close" onClick={onClose}></button>
              </div>

              <div className="modal-body">
                {loading && <div className="text-muted">Loading…</div>}
                {error && <div className="alert alert-danger py-2">{error}</div>}

                {entry && (
                  <div className="row">
                    <div className="col-lg-7">
                      <h6 className="text-uppercase text-muted small">Baseline ledger</h6>
                      <div className="row">
                        {field('Transaction', entry.transactionType)}
                        {field('Amount', `${entry.currency} ${entry.amount}`)}
                        {field('Debit', entry.debit)}
                        {field('Credit', entry.credit)}
                        {field('GL Number', entry.glNumber)}
                        {field('Posting date', new Date(entry.postingDate).toLocaleString())}
                        {field('Posting by', entry.postingBy)}
                        {field('Audit status', entry.auditMetadata?.status)}
                        {field('Description', entry.description)}
                      </div>

                      <h6 className="text-uppercase text-muted small mt-3">Risk</h6>
                      <div className="mb-2">
                        <RiskBadge severity={intel?.severity} score={intel?.riskScore} />
                      </div>
                      {intel?.riskFactors?.length ? (
                        <ul className="small mb-2">
                          {intel.riskFactors.map((f, i) => (
                            <li key={i}>
                              <code>{f.code}</code> (+{f.contribution}) — {f.detail}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-muted small">No risk factors.</div>
                      )}

                      <h6 className="text-uppercase text-muted small mt-3">Anomalies</h6>
                      {intel?.anomalies?.length ? (
                        <ul className="small mb-2">
                          {intel.anomalies.map((a, i) => (
                            <li key={i}>
                              <span className="badge text-bg-light border me-1">{a.type}</span>
                              <span className="text-muted">[{a.field}]</span> {a.message}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-muted small">None.</div>
                      )}

                      <h6 className="text-uppercase text-muted small mt-3">Compliance flags</h6>
                      {intel?.complianceFlags?.length ? (
                        <ul className="small mb-2">
                          {intel.complianceFlags.map((c, i) => (
                            <li key={i}>
                              <code>{c.code}</code> — {c.message}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-muted small">None.</div>
                      )}
                    </div>

                    <div className="col-lg-5">
                      <h6 className="text-uppercase text-muted small">Vector diagnostics</h6>
                      <VectorDiagnosticsPanel vectors={intel?.vectors} />

                      <h6 className="text-uppercase text-muted small mt-3">Similar transactions</h6>
                      <SimilaritySearchPanel entryId={entry.id} />
                    </div>

                    <div className="col-12 mt-3">
                      <h6 className="text-uppercase text-muted small">Update controls</h6>
                      <UpdateControls entry={entry} onChanged={this.onChanged} />
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={onClose}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="modal-backdrop fade show"></div>
      </div>
    );
  }
}
