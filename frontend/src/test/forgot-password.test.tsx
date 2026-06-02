// src/test/forgot-password.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "./helpers";
import ForgotPasswordPage from "@/app/[locale]/(auth)/forgot-password/page";

// ── Mocks ─────────────────────────────────────────────────────────────────────
const mockPost = vi.fn();
vi.mock("@/lib/api", () => ({
  default: { post: (...args: any[]) => mockPost(...args) },
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
}));

// ─────────────────────────────────────────────────────────────────────────────

describe("ForgotPasswordPage", () => {
  beforeEach(() => vi.clearAllMocks());

  // ── Rendering ───────────────────────────────────────────────────────────────

  it("renders the email input and submit button", () => {
    render(<ForgotPasswordPage />);
    expect(
      screen.getByLabelText(/auth\.forgotPassword\.email/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /auth\.forgotPassword\.submit/i }),
    ).toBeInTheDocument();
  });

  it("renders DocuMind brand", () => {
    render(<ForgotPasswordPage />);
    expect(screen.getByText("DocuMind")).toBeInTheDocument();
  });

  it("renders a link back to login", () => {
    render(<ForgotPasswordPage />);
    const loginLink = screen.getByRole("link", {
      name: /auth\.forgotPassword\.signIn/i,
    });
    expect(loginLink).toHaveAttribute("href", "/en/login");
  });

  it("does NOT show the success screen before submission", () => {
    render(<ForgotPasswordPage />);
    // The success state shows a CheckCircle and a different heading
    expect(
      screen.queryByText(/auth\.forgotPassword\.sent$/i),
    ).not.toBeInTheDocument();
  });

  // ── Submission — always shows success (even on API error, by design) ────────

  it("shows the success state after submitting a valid email", async () => {
    mockPost.mockResolvedValueOnce({ data: {} });
    render(<ForgotPasswordPage />);

    await userEvent.type(
      screen.getByLabelText(/auth\.forgotPassword\.email/i),
      "alice@test.com",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /auth\.forgotPassword\.submit/i }),
    );

    await waitFor(() => {
      // Title changes to "sent"
      expect(
        screen.getByText(/auth\.forgotPassword\.sent$/i),
      ).toBeInTheDocument();
    });
  });

  it("calls api.post /auth/forgot-password with the correct email", async () => {
    mockPost.mockResolvedValueOnce({ data: {} });
    render(<ForgotPasswordPage />);

    await userEvent.type(
      screen.getByLabelText(/auth\.forgotPassword\.email/i),
      "alice@test.com",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /auth\.forgotPassword\.submit/i }),
    );

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith("/auth/forgot-password", {
        email: "alice@test.com",
      });
    });
  });

  it("still shows success state even when the API call fails (by design)", async () => {
    mockPost.mockRejectedValueOnce(new Error("Network error"));

    // Prevent Vitest from treating the caught rejection as unhandled
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<ForgotPasswordPage />);
    await userEvent.type(
      screen.getByLabelText(/auth\.forgotPassword\.email/i),
      "nonexistent@test.com",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /auth\.forgotPassword\.submit/i }),
    );
    await waitFor(() => {
      expect(
        screen.getByText(/auth\.forgotPassword\.sent$/i),
      ).toBeInTheDocument();
    });

    spy.mockRestore();
  });

  // ── Loading state ───────────────────────────────────────────────────────────

  it("disables the submit button while loading", async () => {
    mockPost.mockReturnValueOnce(new Promise(() => {}));
    render(<ForgotPasswordPage />);

    const emailInput = screen.getByLabelText(/auth\.forgotPassword\.email/i);
    const submitBtn = screen.getByRole("button", {
      name: /auth\.forgotPassword\.submit/i,
    });

    await userEvent.type(emailInput, "alice@test.com");
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(submitBtn).toBeDisabled();
    });
  });

  // ── Success state UI ────────────────────────────────────────────────────────

  it("shows a back-to-login link on the success screen", async () => {
    mockPost.mockResolvedValueOnce({ data: {} });
    render(<ForgotPasswordPage />);

    await userEvent.type(
      screen.getByLabelText(/auth\.forgotPassword\.email/i),
      "alice@test.com",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /auth\.forgotPassword\.submit/i }),
    );

    await waitFor(() => {
      const backLink = screen.getByRole("link", {
        name: /auth\.forgotPassword\.back/i,
      });
      expect(backLink).toHaveAttribute("href", "/en/login");
    });
  });

  it("hides the form after submission", async () => {
    mockPost.mockResolvedValueOnce({ data: {} });
    render(<ForgotPasswordPage />);

    await userEvent.type(
      screen.getByLabelText(/auth\.forgotPassword\.email/i),
      "alice@test.com",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /auth\.forgotPassword\.submit/i }),
    );

    await waitFor(() => {
      expect(
        screen.queryByLabelText(/auth\.forgotPassword\.email/i),
      ).not.toBeInTheDocument();
    });
  });
});
