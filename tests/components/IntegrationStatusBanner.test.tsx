/**
 * @jest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { IntegrationStatusBanner } from "@/components/IntegrationStatusBanner";
import { useQuery, useAction } from "convex/react";
import { useIntegrationStatus } from "@/hooks/useIntegrationStatus";

jest.mock("@/convex/_generated/api", () => ({
  api: {
    sync: { getStatus: { getStatusForUser: "sync.getStatusForUser" } },
    actions: {
      sync: { requestSync: { requestManualSync: "actions.sync.requestManualSync" } },
    },
    integrations: { getStatus: "integrations.getStatus" },
  },
}));

jest.mock("convex/react", () => ({
  useQuery: jest.fn(),
  useAction: jest.fn(),
}));

jest.mock("@/hooks/useIntegrationStatus", () => ({
  useIntegrationStatus: jest.fn(),
}));

jest.mock("next/link", () => {
  const React = require("react");
  const MockLink = ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => React.createElement("a", { href }, children);
  MockLink.displayName = "MockLink";
  return MockLink;
});

const mockUseQuery = useQuery as jest.Mock;
const mockUseAction = useAction as jest.Mock;
const mockUseIntegrationStatus = useIntegrationStatus as jest.Mock;

const staleIntegrationStatus = {
  kind: "stale_events",
  staleSince: Date.now() - 86_400_000,
  lastEventTs: Date.now() - 86_400_000,
};

describe("IntegrationStatusBanner recovery states", () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
    mockUseAction.mockReset();
    mockUseIntegrationStatus.mockReset();
    mockUseAction.mockReturnValue(jest.fn());
    mockUseIntegrationStatus.mockReturnValue({
      status: staleIntegrationStatus,
      isLoading: false,
    });
  });

  it("shows recovering spinner when sync state is recovering", () => {
    mockUseQuery.mockReturnValue([
      {
        installationId: 1,
        state: "recovering",
        canSyncNow: false,
      },
    ]);

    render(<IntegrationStatusBanner />);

    expect(screen.getByText(/Recovering data/i)).toBeInTheDocument();
    expect(screen.queryByText(/Sync Now/i)).not.toBeInTheDocument();
  });

  it("shows Sync Now button when stale but not recovering", () => {
    mockUseQuery.mockReturnValue([
      {
        installationId: 1,
        state: "idle",
        canSyncNow: true,
      },
    ]);

    render(<IntegrationStatusBanner />);

    expect(screen.getByText("Sync Now")).toBeInTheDocument();
    expect(screen.queryByText(/Recovering data/i)).not.toBeInTheDocument();
  });

  it("hides CTA when sync is already in progress", () => {
    mockUseQuery.mockReturnValue([
      {
        installationId: 1,
        state: "syncing",
        canSyncNow: false,
      },
    ]);

    render(<IntegrationStatusBanner />);

    expect(screen.queryByText(/Recovering data/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sync Now/i)).not.toBeInTheDocument();
  });
});
