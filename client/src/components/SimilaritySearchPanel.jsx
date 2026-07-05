import React from 'react';
import { api } from '../api.js';

/** Multi-space similarity search for the selected entry. Class component managing its own
 * async search state; re-runs when the strategy changes. */
export default class SimilaritySearchPanel extends React.Component {
  constructor(props) {
    super(props);
    this.state = { strategy: 'semantic', results: [], truncated: false, loading: false, error: null };
  }

  componentDidMount() {
    this.run();
  }

  run = async () => {
    this.setState({ loading: true, error: null });
    try {
      const data = await api.searchSimilar(this.props.entryId, this.state.strategy, 5);
      this.setState({ results: data.matches, truncated: data.truncated, loading: false });
    } catch (err) {
      this.setState({ error: err.message, results: [], loading: false });
    }
  };

  onStrategy = (event) => {
    this.setState({ strategy: event.target.value }, this.run);
  };

  render() {
    const { strategy, results, truncated, loading, error } = this.state;
    return (
      <div>
        <div className="d-flex align-items-center gap-2 mb-2">
          <label className="small fw-semibold mb-0">Strategy</label>
          <select className="form-select form-select-sm w-auto" data-testid="similarity-strategy" value={strategy} onChange={this.onStrategy}>
            <option value="semantic">Semantic</option>
            <option value="financial">Financial</option>
            <option value="entity">Entity</option>
          </select>
          <button className="btn btn-sm btn-outline-secondary" onClick={this.run} disabled={loading}>
            {loading ? 'Searching…' : 'Search'}
          </button>
          {truncated && <span className="badge text-bg-warning">approx (capped)</span>}
        </div>

        {error && <div className="alert alert-warning py-2 small mb-2">{error}</div>}

        {results.length === 0 && !loading && !error ? (
          <div className="text-muted small">No similar entries found.</div>
        ) : (
          <ul className="list-group list-group-flush">
            {results.map((m) => (
              <li key={m.entryId} data-testid="similar-item" className="list-group-item d-flex justify-content-between px-0 py-1">
                <span>
                  <span className="fw-semibold">{m.entryNo}</span> · {m.name}
                </span>
                <span className="badge text-bg-light border">{m.score.toFixed(4)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
}
