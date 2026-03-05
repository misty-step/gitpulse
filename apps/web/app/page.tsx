import { AgentShell } from "@/components/agent-shell";

export default function Page() {
  return (
    <main>
      <header style={{ marginBottom: 24 }}>
        <p style={{ color: "var(--text-muted)", margin: 0 }}>GitPulse v2</p>
        <h1 style={{ margin: "4px 0 8px", fontSize: 34, letterSpacing: -0.6 }}>
          Agentic Git Intelligence
        </h1>
        <p style={{ color: "var(--text-muted)", margin: 0, maxWidth: 760 }}>
          Ask one question, across arbitrary windows, repos, orgs, and contributors. The agent resolves activity,
          computes deterministic metrics, and responds with citation-backed analysis.
        </p>
      </header>
      <AgentShell />
    </main>
  );
}
