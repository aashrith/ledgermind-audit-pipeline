import React from 'react';

const PREVIEW_DIMS = 8;

/** Renders a compact preview (first N dims) of each vector space. */
export default class VectorDiagnosticsPanel extends React.Component {
  renderRow(label, vec) {
    if (!vec || vec.length === 0) {
      return (
        <div className="mb-2">
          <div className="small fw-semibold">{label}</div>
          <span className="text-muted small">not generated yet</span>
        </div>
      );
    }
    const preview = vec.slice(0, PREVIEW_DIMS);
    return (
      <div className="mb-2">
        <div className="d-flex justify-content-between">
          <span className="small fw-semibold">{label}</span>
          <span className="text-muted small">dim {vec.length}</span>
        </div>
        <div className="d-flex align-items-end gap-1" style={{ height: 32 }}>
          {preview.map((v, i) => (
            <div
              key={i}
              title={v.toFixed(4)}
              style={{
                width: 14,
                height: `${Math.max(6, Math.abs(v) * 30)}px`,
                background: v >= 0 ? '#0d6efd' : '#dc3545',
                borderRadius: 2,
              }}
            />
          ))}
        </div>
        <code className="small text-muted">[{preview.map((v) => v.toFixed(2)).join(', ')}, …]</code>
      </div>
    );
  }

  render() {
    const { vectors } = this.props;
    if (!vectors) {
      return <div className="text-muted small">Vectors are generated once enrichment completes.</div>;
    }
    return (
      <div>
        {this.renderRow('Semantic', vectors.semantic)}
        {this.renderRow('Financial', vectors.financial)}
        {this.renderRow('Entity', vectors.entity)}
      </div>
    );
  }
}
