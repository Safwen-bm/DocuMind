import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "./helpers";
import { ShareModal } from "@/app/[locale]/(dashboard)/workspace/[workspaceId]/documents/[docId]/_components/ShareModal";
import { shareApi } from "@/lib/share.api";

vi.mock("@/lib/share.api", () => ({
  shareApi: {
    getLinks: vi.fn(),
    createLink: vi.fn(),
    revokeLink: vi.fn(),
  },
}));

Object.assign(navigator, {
  clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
});

Object.defineProperty(window, "location", {
  value: { origin: "http://localhost:3001" },
  writable: true,
});

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  documentId: "doc-1",
  documentTitle: "My Shared Document",
};

const makeLink = (overrides = {}) => ({
  id: "link-1",
  token: "abc123",
  documentId: "doc-1",
  permission: "READ" as const,
  expiresAt: null,
  dateCreation: new Date().toISOString(),
  url: "http://localhost:3001/share/abc123",
  ...overrides,
});

describe("ShareModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(shareApi.getLinks).mockResolvedValue([]);
  });

  it("renders nothing when open is false", () => {
    render(<ShareModal {...defaultProps} open={false} />);
    expect(screen.queryByText("dashboard.share.title")).toBeNull();
  });

  it("renders the modal when open is true", async () => {
    render(<ShareModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("dashboard.share.title")).toBeInTheDocument();
    });
  });

  it("shows the document title in the header", async () => {
    render(<ShareModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("My Shared Document")).toBeInTheDocument();
    });
  });

  it("calls onClose when backdrop is clicked", async () => {
    const onClose = vi.fn();
    render(<ShareModal {...defaultProps} onClose={onClose} />);
    await waitFor(() => screen.getByText("dashboard.share.title"));
    fireEvent.click(document.querySelector(".fixed.inset-0")!);
    expect(onClose).toHaveBeenCalledOnce();
  });

  // READ is the only permission now — verify the badge is present
  it("shows READ permission badge", async () => {
    render(<ShareModal {...defaultProps} />);
    await waitFor(() => screen.getByText("dashboard.share.title"));
    expect(
      screen.getByText("dashboard.share.permissionRead"),
    ).toBeInTheDocument();
  });

  it("shows never expiry selected by default", async () => {
    render(<ShareModal {...defaultProps} />);
    await waitFor(() => screen.getByText("dashboard.share.title"));
    const neverBtn = screen
      .getByText("dashboard.share.never")
      .closest("button")!;
    expect(neverBtn.className).toContain("border-primary");
  });

  it("switches expiry to 7 days when clicked", async () => {
    render(<ShareModal {...defaultProps} />);
    await waitFor(() => screen.getByText("dashboard.share.title"));
    const sevenBtn = screen.getByText("7j").closest("button")!;
    fireEvent.click(sevenBtn);
    expect(sevenBtn.className).toContain("border-primary");
  });

  it("shows empty links message when no links exist", async () => {
    vi.mocked(shareApi.getLinks).mockResolvedValue([]);
    render(<ShareModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("dashboard.share.noLinks")).toBeInTheDocument();
    });
  });

  it("renders existing READ link", async () => {
    vi.mocked(shareApi.getLinks).mockResolvedValue([
      makeLink({ permission: "READ" }),
    ]);
    render(<ShareModal {...defaultProps} />);
    await waitFor(() => {
      expect(
        screen.getAllByText("dashboard.share.permissionRead").length,
      ).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows neverExpires for links with no expiry", async () => {
    vi.mocked(shareApi.getLinks).mockResolvedValue([
      makeLink({ expiresAt: null }),
    ]);
    render(<ShareModal {...defaultProps} />);
    await waitFor(() => {
      expect(
        screen.getByText("dashboard.share.neverExpires"),
      ).toBeInTheDocument();
    });
  });

  it("calls shareApi.createLink with READ and no expiry by default", async () => {
    vi.mocked(shareApi.createLink).mockResolvedValue(makeLink() as any);
    render(<ShareModal {...defaultProps} />);
    await waitFor(() => screen.getByText("dashboard.share.title"));

    fireEvent.click(
      screen.getByText("dashboard.share.generate").closest("button")!,
    );

    await waitFor(() => {
      expect(shareApi.createLink).toHaveBeenCalledWith(
        "doc-1",
        "READ",
        undefined,
      );
    });
  });

  it("calls shareApi.createLink with expiry days when 30j selected", async () => {
    vi.mocked(shareApi.createLink).mockResolvedValue(makeLink() as any);
    render(<ShareModal {...defaultProps} />);
    await waitFor(() => screen.getByText("dashboard.share.title"));

    fireEvent.click(screen.getByText("30j").closest("button")!);
    fireEvent.click(
      screen.getByText("dashboard.share.generate").closest("button")!,
    );

    await waitFor(() => {
      expect(shareApi.createLink).toHaveBeenCalledWith("doc-1", "READ", 30);
    });
  });

  it("copies URL to clipboard after creating a link", async () => {
    vi.mocked(shareApi.createLink).mockResolvedValue({
      ...makeLink(),
      url: "http://localhost:3001/share/abc123",
    } as any);
    render(<ShareModal {...defaultProps} />);
    await waitFor(() => screen.getByText("dashboard.share.title"));

    fireEvent.click(
      screen.getByText("dashboard.share.generate").closest("button")!,
    );

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        "http://localhost:3001/share/abc123",
      );
    });
  });

  it("calls shareApi.revokeLink when trash button is clicked", async () => {
    vi.mocked(shareApi.getLinks).mockResolvedValue([
      makeLink({ id: "link-to-delete" }),
    ]);
    vi.mocked(shareApi.revokeLink).mockResolvedValue({} as any);

    render(<ShareModal {...defaultProps} />);
    await waitFor(() => screen.getByText("dashboard.share.neverExpires"));

    const trashBtn = Array.from(document.querySelectorAll("button")).find(
      (btn) => btn.querySelector(".lucide-trash-2"),
    )!;
    expect(trashBtn).toBeDefined();
    fireEvent.click(trashBtn);

    await waitFor(() => {
      expect(shareApi.revokeLink).toHaveBeenCalledWith("link-to-delete");
    });
  });
});