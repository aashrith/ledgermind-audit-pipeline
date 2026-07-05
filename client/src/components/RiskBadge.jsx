import React from 'react';

const SEVERITY_CLASS = { low: 'success', medium: 'warning', high: 'danger' };
const STATUS_CLASS = {
  pending: 'secondary',
  processing: 'info',
  completed: 'success',
  failed: 'danger',
  stale: 'warning',
};

/** Colored severity badge (optionally with the numeric score). */
export default class RiskBadge extends React.Component {
  render() {
    const { severity, score } = this.props;
    const cls = SEVERITY_CLASS[severity] || 'secondary';
    return (
      <span className={`badge text-bg-${cls}`}>
        {severity || '—'}
        {score != null ? ` · ${Number(score).toFixed(2)}` : ''}
      </span>
    );
  }
}

/** Intelligence status pill. */
export class StatusBadge extends React.Component {
  render() {
    const { status } = this.props;
    const cls = STATUS_CLASS[status] || 'secondary';
    return <span className={`badge rounded-pill text-bg-${cls}`}>{status || 'unknown'}</span>;
  }
}
