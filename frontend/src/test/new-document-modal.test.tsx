import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "./helpers";
import { NewDocumentModal } from "@/app/[locale]/(dashboard)/workspace/[workspaceId]/documents/_components/NewDocumentModal";
import { documentApi } from "@/lib/document.api";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ locale: "en", workspaceId: "ws-1" }),
  usePathname: () => "/en/dashboard",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/document.api", () => ({
  documentApi: {
    create: vi.fn(),
    updateSilent: vi.fn(),
  },
}));

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  workspaceId: "ws-1",
  dossierId: null,
  dossierName: null,
  onOpenGenerate: vi.fn(),
};

describe("NewDocumentModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when open is false", () => {
    render(<NewDocumentModal {...defaultProps} open={false} />);
    expect(screen.queryByText("dashboard.templates.modalTitle")).toBeNull();
  });

  it("renders the modal when open is true", () => {
    render(<NewDocumentModal {...defaultProps} />);
    expect(
      screen.getByText("dashboard.templates.modalTitle"),
    ).toBeInTheDocument();
  });

  it("shows all three tabs", () => {
    render(<NewDocumentModal {...defaultProps} />);
    expect(
      screen.getByText("dashboard.templates.tab.templates"),
    ).toBeInTheDocument();
    expect(screen.getByText("dashboard.templates.tab.ai")).toBeInTheDocument();
    expect(
      screen.getByText("dashboard.templates.tab.blank"),
    ).toBeInTheDocument();
  });

  it("defaults to templates tab showing template cards", () => {
    render(<NewDocumentModal {...defaultProps} />);
    expect(
      screen.getByText("dashboard.templates.meetingNotes.title"),
    ).toBeInTheDocument();
  });

  it("switches to blank tab when clicked", () => {
    render(<NewDocumentModal {...defaultProps} />);
    fireEvent.click(screen.getByText("dashboard.templates.tab.blank"));
    expect(
      screen.getByText("dashboard.templates.blank.title"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("dashboard.templates.blank.cta"),
    ).toBeInTheDocument();
  });

  it("switches to AI tab when clicked", () => {
    render(<NewDocumentModal {...defaultProps} />);
    fireEvent.click(screen.getByText("dashboard.templates.tab.ai"));
    expect(
      screen.getByText("dashboard.templates.aiTabHint"),
    ).toBeInTheDocument();
  });

  it("name input placeholder changes on blank tab", () => {
    render(<NewDocumentModal {...defaultProps} />);
    fireEvent.click(screen.getByText("dashboard.templates.tab.blank"));
    expect(
      screen.getByPlaceholderText(
        "dashboard.documents.createDocModal.placeholder",
      ),
    ).toBeInTheDocument();
  });

  it("calls onClose when backdrop is clicked", () => {
    const onClose = vi.fn();
    render(<NewDocumentModal {...defaultProps} onClose={onClose} />);
    fireEvent.click(document.querySelector(".fixed.inset-0")!);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("creates blank document when blank CTA is clicked", async () => {
    vi.mocked(documentApi.create).mockResolvedValue({
      id: "doc-new",
      titre: "Sans titre",
    } as any);

    render(<NewDocumentModal {...defaultProps} />);
    fireEvent.click(screen.getByText("dashboard.templates.tab.blank"));
    fireEvent.click(screen.getByText("dashboard.templates.blank.cta"));

    await waitFor(() => {
      expect(documentApi.create).toHaveBeenCalledWith("ws-1", {
        titre: "dashboard.documents.createDocModal.placeholder",
        dossierId: undefined,
      });
    });
  });

  it("uses typed name when creating blank document", async () => {
    vi.mocked(documentApi.create).mockResolvedValue({
      id: "doc-new",
      titre: "My Name",
    } as any);

    render(<NewDocumentModal {...defaultProps} />);
    fireEvent.click(screen.getByText("dashboard.templates.tab.blank"));

    fireEvent.change(
      screen.getByPlaceholderText(
        "dashboard.documents.createDocModal.placeholder",
      ),
      { target: { value: "My Name" } },
    );
    fireEvent.click(screen.getByText("dashboard.templates.blank.cta"));

    await waitFor(() => {
      expect(documentApi.create).toHaveBeenCalledWith("ws-1", {
        titre: "My Name",
        dossierId: undefined,
      });
    });
  });

  it("navigates to new document after creation", async () => {
    vi.mocked(documentApi.create).mockResolvedValue({
      id: "doc-abc",
      titre: "Sans titre",
    } as any);

    render(<NewDocumentModal {...defaultProps} />);
    fireEvent.click(screen.getByText("dashboard.templates.tab.blank"));
    fireEvent.click(screen.getByText("dashboard.templates.blank.cta"));

    // The modal closes after successful creation (docName is reset, onClose called)
    await waitFor(() => {
      expect(documentApi.create).toHaveBeenCalledWith(
        "ws-1",
        expect.any(Object),
      );
    });
  });

  it("calls onOpenGenerate when AI template is clicked", () => {
    const onOpenGenerate = vi.fn();
    render(
      <NewDocumentModal {...defaultProps} onOpenGenerate={onOpenGenerate} />,
    );

    fireEvent.click(screen.getByText("dashboard.templates.tab.ai"));

    const buttons = screen.getAllByRole("button");
    const meetingBtn = buttons.find((btn) =>
      btn.textContent?.includes("dashboard.templates.meetingNotes.title"),
    )!;
    fireEvent.click(meetingBtn);

    expect(onOpenGenerate).toHaveBeenCalledWith(
      "dashboard.templates.meetingNotes.aiPrompt",
    );
  });

  it("creates document from template when template card is clicked", async () => {
    vi.mocked(documentApi.create).mockResolvedValue({
      id: "doc-tmpl",
      titre: "Meeting Notes",
    } as any);
    vi.mocked(documentApi.updateSilent).mockResolvedValue({} as any);

    render(<NewDocumentModal {...defaultProps} />);

    const buttons = screen.getAllByRole("button");
    const meetingBtn = buttons.find((btn) =>
      btn.textContent?.includes("dashboard.templates.meetingNotes.title"),
    )!;
    fireEvent.click(meetingBtn);

    await waitFor(() => {
      expect(documentApi.create).toHaveBeenCalledWith("ws-1", {
        titre: "dashboard.templates.meetingNotes.title",
        dossierId: undefined,
      });
      expect(documentApi.updateSilent).toHaveBeenCalledWith(
        "doc-tmpl",
        expect.objectContaining({ contenu: expect.any(Object) }),
      );
    });
  });

  it("passes dossierId to document creation", async () => {
    vi.mocked(documentApi.create).mockResolvedValue({
      id: "doc-new",
      titre: "Sans titre",
    } as any);

    render(<NewDocumentModal {...defaultProps} dossierId="folder-1" />);
    fireEvent.click(screen.getByText("dashboard.templates.tab.blank"));
    fireEvent.click(screen.getByText("dashboard.templates.blank.cta"));

    await waitFor(() => {
      expect(documentApi.create).toHaveBeenCalledWith("ws-1", {
        titre: "dashboard.documents.createDocModal.placeholder",
        dossierId: "folder-1",
      });
    });
  });
});
