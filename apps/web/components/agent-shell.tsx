"use client";

import { useMemo, useState } from "react";

import type { AgentAnswer, UiBlock } from "@gitpulse/schemas";

import { BlockRenderer } from "./block-renderer";

type ScopeFields = {
  from: string;
  to: string;
  repos: string;
  orgs: string;
  contributors: string;
};

const DEFAULT_SCOPE: ScopeFields = {
  from: isoDaysAgo(7),
  to: new Date().toISOString(),
  repos: "",
  orgs: "",
  contributors: "",
};

export function AgentShell() {
  const [question, setQuestion] = useState("What did we ship this week and where are we blocked?");
  const [scope, setScope] = useState<ScopeFields>(DEFAULT_SCOPE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<AgentAnswer | null>(null);

  const canSubmit = useMemo(() => question.trim().length > 0 && !loading, [question, loading]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question,
          window: {
            from: new Date(scope.from).toISOString(),
            to: new Date(scope.to).toISOString(),
          },
          scope: {
            repos: csv(scope.repos),
            orgs: csv(scope.orgs),
            contributors: csv(scope.contributors),
          },
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? `Request failed: ${response.status}`);
      }

      const payload = (await response.json()) as AgentAnswer;
      setAnswer(payload);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <form className="card" onSubmit={handleSubmit} style={{ padding: 16, display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Question</span>
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            rows={3}
            style={inputStyle({ minHeight: 92 })}
            placeholder="What changed this sprint across overmind + volume?"
          />
        </label>

        <div
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          <Field
            label="From"
            value={scope.from}
            onChange={(value) => setScope((current) => ({ ...current, from: value }))}
            placeholder="2026-02-01T00:00:00Z"
          />
          <Field
            label="To"
            value={scope.to}
            onChange={(value) => setScope((current) => ({ ...current, to: value }))}
            placeholder="2026-03-01T00:00:00Z"
          />
          <Field
            label="Repos (csv)"
            value={scope.repos}
            onChange={(value) => setScope((current) => ({ ...current, repos: value }))}
            placeholder="misty-step/gitpulse,misty-step/overmind"
          />
          <Field
            label="Orgs (csv)"
            value={scope.orgs}
            onChange={(value) => setScope((current) => ({ ...current, orgs: value }))}
            placeholder="misty-step"
          />
          <Field
            label="Contributors (csv)"
            value={scope.contributors}
            onChange={(value) => setScope((current) => ({ ...current, contributors: value }))}
            placeholder="phaedrus"
          />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
            Uses deterministic GitHub metrics + optional OpenRouter analysis.
          </span>
          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              border: "1px solid var(--accent)",
              background: canSubmit ? "var(--accent)" : "var(--surface-muted)",
              color: canSubmit ? "#05130f" : "var(--text-muted)",
              borderRadius: 10,
              padding: "9px 14px",
              fontWeight: 600,
            }}
          >
            {loading ? "Thinking…" : "Run Agent"}
          </button>
        </div>
      </form>

      {error ? (
        <section className="card" style={{ padding: 16, borderColor: "var(--danger)", color: "var(--danger)" }}>
          {error}
        </section>
      ) : null}

      {answer ? (
        <>
          <section className="card" style={{ padding: 16 }}>
            <h2 style={{ marginTop: 0 }}>Answer</h2>
            <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontFamily: "var(--sans)" }}>{answer.answer}</pre>
          </section>

          <div style={{ display: "grid", gap: 12 }}>
            {answer.blocks.map((block, index) => (
              <BlockRenderer key={blockKey(block, index)} block={block} />
            ))}
          </div>

          <section className="card" style={{ padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>Citations</h3>
            <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 7 }}>
              {answer.citations.slice(0, 25).map((citation) => (
                <li key={citation.url}>
                  <a href={citation.url} target="_blank" rel="noreferrer">
                    {citation.label}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </div>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label style={{ display: "grid", gap: 5 }}>
      <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{props.label}</span>
      <input
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        placeholder={props.placeholder}
        style={inputStyle()}
      />
    </label>
  );
}

function inputStyle(overrides?: React.CSSProperties): React.CSSProperties {
  return {
    width: "100%",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--surface-muted)",
    color: "var(--text)",
    padding: "10px 11px",
    ...overrides,
  };
}

function csv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isoDaysAgo(days: number): string {
  const now = new Date();
  const then = new Date(now);
  then.setUTCDate(now.getUTCDate() - days);
  return then.toISOString();
}

function blockKey(block: UiBlock, index: number): string {
  switch (block.type) {
    case "metric_grid":
    case "event_feed":
    case "repo_breakdown":
    case "insight_list":
      return `${block.type}:${block.title}:${index}`;
  }
}
