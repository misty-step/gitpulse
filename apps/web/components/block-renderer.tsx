"use client";

import type { UiBlock } from "@gitpulse/schemas";

export function BlockRenderer({ block }: { block: UiBlock }) {
  if (block.type === "metric_grid") {
    return (
      <section className="card" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>{block.title}</h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            gap: 12,
          }}
        >
          {block.metrics.map((metric) => (
            <article
              key={metric.label}
              style={{
                background: "var(--surface-muted)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: 12,
              }}
            >
              <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 12 }}>{metric.label}</p>
              <p style={{ margin: "6px 0", fontSize: 22, fontWeight: 600 }}>{metric.value}</p>
              {metric.description ? (
                <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 12 }}>{metric.description}</p>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    );
  }

  if (block.type === "repo_breakdown") {
    return (
      <section className="card" style={{ padding: 16, overflowX: "auto" }}>
        <h3 style={{ marginTop: 0 }}>{block.title}</h3>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--text-muted)" }}>
              <th>Repository</th>
              <th>Commits</th>
              <th>Opened PRs</th>
              <th>Merged PRs</th>
              <th>Reviews</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row) => (
              <tr key={row.repo} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ padding: "10px 0", fontFamily: "var(--mono)" }}>{row.repo}</td>
                <td>{row.commits}</td>
                <td>{row.openedPrs}</td>
                <td>{row.mergedPrs}</td>
                <td>{row.reviews}</td>
                <td>{row.totalEvents}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    );
  }

  if (block.type === "event_feed") {
    return (
      <section className="card" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>{block.title}</h3>
        <div style={{ display: "grid", gap: 10 }}>
          {block.events.map((event) => (
            <article
              key={`${event.url}-${event.timestamp}`}
              style={{
                display: "grid",
                gap: 3,
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: 10,
                background: "var(--surface-muted)",
              }}
            >
              <strong>{event.label}</strong>
              <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 13 }}>
                {event.actor} · {event.repo} · {formatTimestamp(event.timestamp)}
              </p>
              <a href={event.url} target="_blank" rel="noreferrer">
                Open source
              </a>
            </article>
          ))}
        </div>
      </section>
    );
  }

  if (block.type === "insight_list") {
    return (
      <section className="card" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>{block.title}</h3>
        <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 8 }}>
          {block.insights.map((insight, index) => (
            <li key={`${index}-${insight}`}>{insight}</li>
          ))}
        </ul>
      </section>
    );
  }

  return null;
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
