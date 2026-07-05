import React from 'react';
import RiskBadge, { StatusBadge } from './RiskBadge.jsx';

function money(amount, currency) {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency || 'INR', maximumFractionDigits: 0 }).format(amount);
  } catch (e) {
    return `${currency || ''} ${amount}`;
  }
}

function shortDate(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

/** Journal-entry table. Presentational class component; selection bubbles up via onSelect. */
export default class EntryTable extends React.Component {
  render() {
    const { entries, onSelect } = this.props;
    if (!entries || entries.length === 0) {
      return <div className="text-muted p-4 text-center">No entries match the current filters.</div>;
    }
    return (
      <div className="table-responsive">
        <table className="table table-sm table-hover align-middle mb-0">
          <thead className="table-light">
            <tr>
              <th>Entry No</th>
              <th>Name</th>
              <th className="text-end">Amount</th>
              <th>GL</th>
              <th>Posting Date</th>
              <th>Status</th>
              <th>Risk</th>
              <th className="text-center">Anomalies</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} data-testid="entry-row" data-entryno={e.entryNo}>
                <td className="fw-semibold" data-testid="entry-no">{e.entryNo}</td>
                <td>{e.name}</td>
                <td className="text-end">{money(e.amount, e.currency)}</td>
                <td>{e.glNumber || <span className="text-danger">—</span>}</td>
                <td>{shortDate(e.postingDate)}</td>
                <td data-testid="entry-status" data-status={e.intelligence?.status}><StatusBadge status={e.intelligence?.status} /></td>
                <td><RiskBadge severity={e.intelligence?.severity} score={e.intelligence?.riskScore} /></td>
                <td className="text-center">
                  {e.intelligence?.anomalies?.length ? (
                    <span className="badge text-bg-light border">{e.intelligence.anomalies.length}</span>
                  ) : (
                    <span className="text-muted">0</span>
                  )}
                </td>
                <td className="text-end">
                  <button className="btn btn-sm btn-outline-primary" data-testid="diagnostics-btn" onClick={() => onSelect(e)}>
                    Diagnostics
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
}
