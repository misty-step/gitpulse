export type IntegrationStatusKind =
  | "unauthenticated"
  | "missing_user"
  | "missing_installation"
  | "no_events"
  | "stale_events"
  | "healthy";

export interface IntegrationJobSummary {
  status: string;
  createdAt: number;
  progress?: number | null;
  blockedUntil?: number | null;
}

export interface IntegrationStatusMeta {
  installCount?: number;
  lastEventTs?: number | null;
  lastSyncedAt?: number | null;
  lastJob?: IntegrationJobSummary | null;
}

export type IntegrationStatus =
  | ({ kind: "unauthenticated" } & IntegrationStatusMeta)
  | ({ kind: "missing_user" } & IntegrationStatusMeta)
  | ({ kind: "missing_installation" } & IntegrationStatusMeta)
  | ({ kind: "no_events" } & IntegrationStatusMeta)
  | ({ kind: "stale_events"; staleSince: number } & IntegrationStatusMeta)
  | ({ kind: "healthy" } & IntegrationStatusMeta);

const ATTENTION_KINDS: IntegrationStatusKind[] = [
  "missing_installation",
  "no_events",
  "stale_events",
];

export function needsIntegrationAttention(status?: IntegrationStatus | null): boolean {
  if (!status) return false;
  return ATTENTION_KINDS.includes(status.kind);
}

export function formatTimestamp(ts?: number | null, locale?: Intl.LocalesArgument): string {
  if (!ts) return "Never";
  return new Date(ts).toLocaleString(locale ?? undefined);
}

export function getGithubInstallUrl(): string {
  return (
    process.env.NEXT_PUBLIC_GITHUB_APP_INSTALL_URL ||
    "https://github.com/apps/gitpulse/installations/new"
  );
}
