const demoIssues = [
  '#12 Hermes cockpit dashboard shell',
  '#13 Harness detector in main process',
  '#14 GitHub PR read-only pane',
];

const demoPullRequests = [
  '#22 feat/ui-operator-grid · draft',
  '#21 chore/scaffold-electron · merged',
  '#20 docs/add-review-lenses · merged',
];

const demoBatchRows = [
  { id: '#12', label: 'Dashboard shell', progress: 74, status: 'builder running' },
  { id: '#13', label: 'Harness detector', progress: 35, status: 'needs spec' },
  { id: '#14', label: 'PR state pane', progress: 52, status: 'reviewer A pending' },
];

export function GithubPane() {
  return (
    <section className="panel github-pane">
      <header className="panel-header">
        <div>
          <span className="section-kicker">GitHub</span>
          <strong>Issues · Pull Requests · Batch</strong>
        </div>
        <span className="header-chip">mock GitHub state</span>
      </header>
      <div className="github-columns">
        <section>
          <header className="sub-header">
            <span>Mock issues (3)</span>
          </header>
          <ul className="feed-list">
            {demoIssues.map((issue) => (
              <li key={issue}>
                <span className="status-dot" />
                {issue}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <header className="sub-header">
            <span>Mock pull requests (3)</span>
          </header>
          <ul className="feed-list">
            {demoPullRequests.map((pullRequest) => (
              <li key={pullRequest}>
                <span className="status-dot cyan" />
                {pullRequest}
              </li>
            ))}
          </ul>
        </section>
      </div>
      <div className="batch-panel">
        <header className="sub-header">
          <span>Demo Batch: UI Draft (3 items)</span>
          <strong>Manual merge gate</strong>
        </header>
        <div className="batch-list">
          {demoBatchRows.map((row) => (
            <article className="batch-row" key={row.id}>
              <span>{row.id}</span>
              <strong>{row.label}</strong>
              <div className="progress-track" aria-label={`${row.label} ${row.progress}%`}>
                <span style={{ width: `${row.progress}%` }} />
              </div>
              <em>{row.progress}% · {row.status}</em>
            </article>
          ))}
        </div>
      </div>
      <footer className="queue-footer">
        <span>mock harness state · 3/3 files read</span>
        <button>Edit queue</button>
      </footer>
    </section>
  );
}
