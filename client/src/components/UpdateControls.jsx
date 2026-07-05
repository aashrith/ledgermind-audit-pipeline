import React from 'react';
import { api } from '../api.js';

/**
 * Demonstrates the two update paths:
 *  - Core field edit (amount/description/glNumber) → triggers async recomputation.
 *  - Audit metadata edit (status/comment) → saves atomically, bypasses enrichment.
 *
 * Save buttons are disabled while a request is in flight — a simple, explicit guard
 * against sequential double-click races (the backend also enforces an optimistic version
 * check and returns 409 on a concurrent conflict).
 */
export default class UpdateControls extends React.Component {
  constructor(props) {
    super(props);
    const e = props.entry;
    this.state = {
      amount: e.amount,
      description: e.description || '',
      glNumber: e.glNumber || '',
      status: e.auditMetadata?.status || 'open',
      comment: '',
      savingCore: false,
      savingMeta: false,
      message: null,
      error: null,
    };
  }

  field = (name) => (event) => this.setState({ [name]: event.target.value });

  saveCore = async () => {
    if (this.state.savingCore) return; // guard double-submit
    this.setState({ savingCore: true, message: null, error: null });
    try {
      await api.updateCore(this.props.entry.id, {
        amount: Number(this.state.amount),
        description: this.state.description,
        glNumber: this.state.glNumber,
      });
      this.setState({ savingCore: false, message: 'Core updated — recomputation enqueued.' });
      this.props.onChanged();
    } catch (err) {
      this.setState({ savingCore: false, error: err.message });
    }
  };

  saveMeta = async () => {
    if (this.state.savingMeta) return;
    this.setState({ savingMeta: true, message: null, error: null });
    try {
      const patch = { status: this.state.status };
      if (this.state.comment.trim()) {
        patch.comments = [{ by: 'auditor', text: this.state.comment.trim() }];
      }
      await api.updateAuditMetadata(this.props.entry.id, patch);
      this.setState({ savingMeta: false, comment: '', message: 'Metadata saved — no recomputation.' });
      this.props.onChanged();
    } catch (err) {
      this.setState({ savingMeta: false, error: err.message });
    }
  };

  render() {
    const { amount, description, glNumber, status, comment, savingCore, savingMeta, message, error } = this.state;
    return (
      <div>
        {message && <div className="alert alert-success py-2 small">{message}</div>}
        {error && <div className="alert alert-danger py-2 small">{error}</div>}

        <div className="row g-3">
          <div className="col-md-6">
            <div className="border rounded p-2 h-100">
              <div className="fw-semibold small mb-2">Core update <span className="text-danger">(recomputes)</span></div>
              <input className="form-control form-control-sm mb-2" type="number" data-testid="core-amount" value={amount} onChange={this.field('amount')} placeholder="Amount" />
              <input className="form-control form-control-sm mb-2" value={description} onChange={this.field('description')} placeholder="Description" />
              <input className="form-control form-control-sm mb-2" value={glNumber} onChange={this.field('glNumber')} placeholder="GL Number" />
              <button className="btn btn-sm btn-primary" data-testid="save-core" onClick={this.saveCore} disabled={savingCore}>
                {savingCore ? 'Saving…' : 'Save core fields'}
              </button>
            </div>
          </div>

          <div className="col-md-6">
            <div className="border rounded p-2 h-100">
              <div className="fw-semibold small mb-2">Audit metadata <span className="text-success">(no recompute)</span></div>
              <select className="form-select form-select-sm mb-2" data-testid="meta-status" value={status} onChange={this.field('status')}>
                <option value="open">open</option>
                <option value="in_review">in_review</option>
                <option value="approved">approved</option>
                <option value="rejected">rejected</option>
              </select>
              <input className="form-control form-control-sm mb-2" value={comment} onChange={this.field('comment')} placeholder="Add a comment (optional)" />
              <button className="btn btn-sm btn-success" data-testid="save-meta" onClick={this.saveMeta} disabled={savingMeta}>
                {savingMeta ? 'Saving…' : 'Save metadata'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
