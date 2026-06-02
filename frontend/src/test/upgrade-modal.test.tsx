// src/test/upgrade-modal.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "./helpers";
import { UpgradeModal } from "@/components/plans/UpgradeModal";
import { usePlansStore } from "@/store/plans.store";
import type { Plan, PlanLimitCode } from "@/lib/types";

// ── Mocks ─────────────────────────────────────────────────────────────────────
const mockCreateCheckout = vi.fn();
vi.mock("@/lib/plans.api", () => ({
  plansApi: {
    createCheckout: (...args: any[]) => mockCreateCheckout(...args),
  },
}));

const mockUseParams = vi.fn(() => ({ locale: "en", workspaceId: "ws-1" }));
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useParams: () => mockUseParams(), // delegates to the vi.fn()
}));

// Capture window.location.href assignments
const originalLocation = window.location;
beforeEach(() => {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { href: "" },
  });
});
afterEach(() => {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: originalLocation,
  });
});

// ── Explicit type — avoids Parameters<> extraction which TS can't resolve ─────
interface OpenModalArgs {
  code?: PlanLimitCode;
  currentPlan?: Plan;
  workspaceId?: string | null;
  message?: string;
}

function openModal(overrides: OpenModalArgs = {}) {
  act(() => {
    // ← wrap the store mutation
    usePlansStore.getState().openUpgradeModal({
      code: overrides.code ?? "PLAN_LIMIT_DOCUMENTS",
      currentPlan: overrides.currentPlan ?? "FREE",
      workspaceId:
        overrides.workspaceId !== undefined ? overrides.workspaceId : "ws-1",
      message: overrides.message ?? "You hit the limit",
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────

describe("UpgradeModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePlansStore.getState().closeUpgradeModal();
  });

  // ── Visibility ──────────────────────────────────────────────────────────────

  it("is not visible when the store is closed", () => {
    render(<UpgradeModal />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("becomes visible when the store is opened", () => {
    render(<UpgradeModal />);
    openModal();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  // ── Content ─────────────────────────────────────────────────────────────────

  it("renders PRO and ENTERPRISE plan cards", () => {
    render(<UpgradeModal />);
    openModal();
    expect(
      screen.getByText(/dashboard\.plans\.upgrade\.pro\.name/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/dashboard\.plans\.upgrade\.enterprise\.name/i),
    ).toBeInTheDocument();
  });

  it("renders the limit-specific title using the code", () => {
    render(<UpgradeModal />);
    openModal({ code: "PLAN_LIMIT_DOCUMENTS" });
    expect(
      screen.getByText(
        /dashboard\.plans\.upgrade\.limits\.PLAN_LIMIT_DOCUMENTS\.title/i,
      ),
    ).toBeInTheDocument();
  });

  it("renders PRO and ENTERPRISE feature lists from t.raw()", () => {
    render(<UpgradeModal />);
    openModal();
    expect(screen.getByText("3 workspaces")).toBeInTheDocument();
    expect(screen.getByText("Unlimited workspaces")).toBeInTheDocument();
  });

  it('renders a "View pricing" button', () => {
    render(<UpgradeModal />);
    openModal();
    expect(
      screen.getByRole("button", {
        name: /dashboard\.plans\.upgrade\.viewPricing/i,
      }),
    ).toBeInTheDocument();
  });

  // ── Closing ─────────────────────────────────────────────────────────────────

  it('closes when "Maybe later" button is clicked', async () => {
    render(<UpgradeModal />);
    openModal();
    await userEvent.click(
      screen.getByRole("button", {
        name: /dashboard\.plans\.upgrade\.maybeLater/i,
      }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  // ── Upgrade actions ─────────────────────────────────────────────────────────

  it("calls plansApi.createCheckout with PRO and the correct workspace id", async () => {
    mockCreateCheckout.mockResolvedValueOnce({
      url: "https://stripe.com/checkout/pro",
    });
    render(<UpgradeModal />);
    openModal({ workspaceId: "ws-42" });
    await userEvent.click(
      screen.getByRole("button", {
        name: /dashboard\.plans\.upgrade\.pro\.cta/i,
      }),
    );
    await waitFor(() => {
      expect(mockCreateCheckout).toHaveBeenCalledWith("ws-42", "PRO");
    });
  });

  it("redirects to Stripe URL after successful PRO checkout", async () => {
    mockCreateCheckout.mockResolvedValueOnce({
      url: "https://stripe.com/checkout/pro",
    });
    render(<UpgradeModal />);
    openModal();
    await userEvent.click(
      screen.getByRole("button", {
        name: /dashboard\.plans\.upgrade\.pro\.cta/i,
      }),
    );
    await waitFor(() => {
      expect(window.location.href).toBe("https://stripe.com/checkout/pro");
    });
  });

  it("calls plansApi.createCheckout with ENTERPRISE when that button is clicked", async () => {
    mockCreateCheckout.mockResolvedValueOnce({
      url: "https://stripe.com/checkout/ent",
    });
    render(<UpgradeModal />);
    openModal();
    await userEvent.click(
      screen.getByRole("button", {
        name: /dashboard\.plans\.upgrade\.enterprise\.cta/i,
      }),
    );
    await waitFor(() => {
      expect(mockCreateCheckout).toHaveBeenCalledWith("ws-1", "ENTERPRISE");
    });
  });

  // ── Current plan state ──────────────────────────────────────────────────────

  it('disables PRO button and shows "currentPlan" label when already on PRO', () => {
    render(<UpgradeModal />);
    openModal({ currentPlan: "PRO" });
    const proBtn = screen.getByRole("button", {
      name: /dashboard\.plans\.upgrade\.currentPlan/i,
    });
    expect(proBtn).toBeDisabled();
  });

  it('shows "redirecting" label and disables button while checkout is in flight', async () => {
    mockCreateCheckout.mockReturnValueOnce(new Promise(() => {}));
    render(<UpgradeModal />);
    openModal();
    await userEvent.click(
      screen.getByRole("button", {
        name: /dashboard\.plans\.upgrade\.pro\.cta/i,
      }),
    );
    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: /dashboard\.plans\.upgrade\.redirecting/i,
        }),
      ).toBeDisabled();
    });
  });

  // ── No workspace id edge case ───────────────────────────────────────────────

  it("redirects to /pricing when workspaceId is null", async () => {
    // Override BEFORE render so the hook picks it up
    mockUseParams.mockReturnValue({ locale: "en" } as any); // no workspaceId

    render(<UpgradeModal />);
    openModal({ workspaceId: null });
    await userEvent.click(
      screen.getByRole("button", {
        name: /dashboard\.plans\.upgrade\.pro\.cta/i,
      }),
    );
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/en/pricing");
    });

    // Restore default for other tests
    mockUseParams.mockReturnValue({ locale: "en", workspaceId: "ws-1" });
  });
});
