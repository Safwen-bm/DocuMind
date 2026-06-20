// src/test/usage-banner.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { render, makeUsage } from "./helpers";
import { UsageBanner } from "@/components/plans/UsageBanner";

// ── Mock plansApi ─────────────────────────────────────────────────────────────
// We mock useQuery directly so we control what "data" the component sees,
// without needing a real HTTP server.
const mockUseQuery = vi.fn();
vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: (...args: any[]) => mockUseQuery(...args),
  };
});

vi.mock("@/lib/plans.api", () => ({
  plansApi: { getUsage: vi.fn() },
}));

// ── PlanBadge (simple — just renders the plan string) ─────────────────────────
vi.mock("@/components/plans/PlanBadge", () => ({
  PlanBadge: ({ plan }: { plan: string }) => (
    <span data-testid="plan-badge">{plan}</span>
  ),
}));

// ─────────────────────────────────────────────────────────────────────────────

describe("UsageBanner", () => {
  beforeEach(() => vi.clearAllMocks());

  // ── Null states ─────────────────────────────────────────────────────────────

  it("renders nothing when data is undefined (loading)", () => {
    mockUseQuery.mockReturnValue({ data: undefined });
    const { container } = render(<UsageBanner workspaceId="ws-1" />);
    expect(container.querySelector("div > *")).toBeNull();
  });

  it("renders enterprise badge for ENTERPRISE plan", () => {
    mockUseQuery.mockReturnValue({ data: makeUsage({ plan: "ENTERPRISE" }) });
    render(<UsageBanner workspaceId="ws-1" />);
    expect(screen.getByText("Enterprise")).toBeInTheDocument();
    expect(screen.getByText("Unlimited")).toBeInTheDocument();
  });

  // ── FREE plan rendering ─────────────────────────────────────────────────────

  it("renders the banner for FREE plan", () => {
    mockUseQuery.mockReturnValue({ data: makeUsage() });
    render(<UsageBanner workspaceId="ws-1" />);
    expect(
      screen.getByText(/dashboard\.plans\.usage\.title/i),
    ).toBeInTheDocument();
  });

  it("shows the PlanBadge with the correct plan", () => {
    mockUseQuery.mockReturnValue({ data: makeUsage({ plan: "FREE" }) });
    render(<UsageBanner workspaceId="ws-1" />);
    expect(screen.getByTestId("plan-badge")).toHaveTextContent("FREE");
  });

  it("shows the PlanBadge as PRO for PRO plan", () => {
    mockUseQuery.mockReturnValue({ data: makeUsage({ plan: "PRO" }) });
    render(<UsageBanner workspaceId="ws-1" />);
    expect(screen.getByTestId("plan-badge")).toHaveTextContent("PRO");
  });

  // ── Usage bars ──────────────────────────────────────────────────────────────

  it("renders documents, members, and aiToday usage labels", () => {
    mockUseQuery.mockReturnValue({ data: makeUsage() });
    render(<UsageBanner workspaceId="ws-1" />);
    expect(
      screen.getByText(/dashboard\.plans\.usage\.documents/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/dashboard\.plans\.usage\.members/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/dashboard\.plans\.usage\.aiToday/i),
    ).toBeInTheDocument();
  });

  it("shows current/limit counts for documents", () => {
    mockUseQuery.mockReturnValue({
      data: makeUsage({
        documents: { current: 8, limit: 10, isUnlimited: false },
      }),
    });
    render(<UsageBanner workspaceId="ws-1" />);
    expect(screen.getByText("8 / 10")).toBeInTheDocument();
  });

  it("shows correct counts for members", () => {
    mockUseQuery.mockReturnValue({
      data: makeUsage({
        members: { current: 3, limit: 5, isUnlimited: false },
      }),
    });
    render(<UsageBanner workspaceId="ws-1" />);
    expect(screen.getByText("3 / 5")).toBeInTheDocument();
  });

  it("shows correct counts for aiToday", () => {
    mockUseQuery.mockReturnValue({
      data: makeUsage({
        aiToday: { current: 15, limit: 20, isUnlimited: false },
      }),
    });
    render(<UsageBanner workspaceId="ws-1" />);
    expect(screen.getByText("15 / 20")).toBeInTheDocument();
  });

  // ── Unlimited bars ──────────────────────────────────────────────────────────

  it("does not render a usage bar when isUnlimited is true", () => {
    mockUseQuery.mockReturnValue({
      data: makeUsage({
        documents: { current: 999, limit: 0, isUnlimited: true },
        members: { current: 999, limit: 0, isUnlimited: true },
        aiToday: { current: 999, limit: 0, isUnlimited: true },
      }),
    });
    render(<UsageBanner workspaceId="ws-1" />);
    // None of the count strings should appear
    expect(screen.queryByText(/\d+ \/ \d+/)).not.toBeInTheDocument();
  });

  // ── Warning colour thresholds ───────────────────────────────────────────────

  it("applies amber color class at ≥80% usage", () => {
    mockUseQuery.mockReturnValue({
      data: makeUsage({
        documents: { current: 8, limit: 10, isUnlimited: false }, // 80%
      }),
    });
    render(<UsageBanner workspaceId="ws-1" />);
    // The progress bar div gets bg-amber-500
    const amberBar = document.querySelector(".bg-amber-500");
    expect(amberBar).toBeInTheDocument();
  });

  it("applies destructive color class at 100% usage", () => {
    mockUseQuery.mockReturnValue({
      data: makeUsage({
        documents: { current: 10, limit: 10, isUnlimited: false }, // 100%
      }),
    });
    render(<UsageBanner workspaceId="ws-1" />);
    const redBar = document.querySelector(".bg-destructive");
    expect(redBar).toBeInTheDocument();
  });

  it("applies primary color class at <80% usage", () => {
    mockUseQuery.mockReturnValue({
      data: makeUsage({
        documents: { current: 4, limit: 10, isUnlimited: false }, // 40%
      }),
    });
    render(<UsageBanner workspaceId="ws-1" />);
    const primaryBar = document.querySelector(".bg-primary");
    expect(primaryBar).toBeInTheDocument();
  });

  // ── useQuery call ───────────────────────────────────────────────────────────

  it("passes the correct queryKey and workspaceId", () => {
    mockUseQuery.mockReturnValue({ data: undefined });
    render(<UsageBanner workspaceId="ws-99" />);

    const callArgs = mockUseQuery.mock.calls[0][0];
    expect(callArgs.queryKey).toEqual(["plan-usage", "ws-99"]);
  });
});
