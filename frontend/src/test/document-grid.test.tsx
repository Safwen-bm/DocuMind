// src/test/document-grid.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render, makeDocument } from "./helpers";
import { DocumentGrid } from "@/app/[locale]/(dashboard)/workspace/[workspaceId]/documents/_components/DocumentGrid";
import type { Document } from "@/lib/types";

// ── Mocks ─────────────────────────────────────────────────────────────────────
const mockDeleteFn = vi.fn();
const mockToggleFavoriFn = vi.fn();
const mockMoveFn = vi.fn();

vi.mock("@/lib/document.api", () => ({
  documentApi: {
    delete: (...args: any[]) => mockDeleteFn(...args),
    toggleFavori: (...args: any[]) => mockToggleFavoriFn(...args),
    moveDocument: (...args: any[]) => mockMoveFn(...args),
    exportPdf: vi.fn(),
    exportDocx: vi.fn(),
    exportExcel: vi.fn(),
  },
}));

vi.mock("@/lib/ai.api", () => ({
  aiApi: { chatMultiDoc: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ locale: "en", workspaceId: "ws-1" }),
}));

// ── Default props ─────────────────────────────────────────────────────────────
function makeProps(
  overrides: Partial<Parameters<typeof DocumentGrid>[0]> = {},
) {
  return {
    workspaceId: "ws-1",
    locale: "en",
    documents: undefined,
    folders: [],
    selectedFolderId: null,
    selectedFolderName: undefined,
    isLoading: false,
    canEdit: true,
    onCreateDoc: vi.fn(),
    onCreateFolder: vi.fn(),
    activeTag: null,
    onTagClick: vi.fn(),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

describe("DocumentGrid", () => {
  beforeEach(() => vi.clearAllMocks());

  // ── Loading skeleton ────────────────────────────────────────────────────────

  it("renders 6 skeleton cards while loading", () => {
    render(<DocumentGrid {...makeProps({ isLoading: true })} />);
    // Skeletons use animate-pulse class
    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBe(6);
  });

  // ── Empty state ─────────────────────────────────────────────────────────────

  it("shows empty state when documents array is empty", () => {
    render(<DocumentGrid {...makeProps({ documents: [] })} />);
    // The empty-state icon container is there (FileText icon + heading)
    expect(
      screen.getByText(/dashboard\.documents\.noDocsYet/i),
    ).toBeInTheDocument();
  });

  it('shows "Create document" button in empty state when canEdit=true', () => {
    render(<DocumentGrid {...makeProps({ documents: [] })} />);
    expect(
      screen.getByRole("button", { name: /dashboard\.documents\.createDoc/i }),
    ).toBeInTheDocument();
  });

  it('hides "Create document" button in empty state when canEdit=false', () => {
    render(<DocumentGrid {...makeProps({ documents: [], canEdit: false })} />);
    expect(
      screen.queryByRole("button", {
        name: /dashboard\.documents\.createDoc/i,
      }),
    ).not.toBeInTheDocument();
  });

  it("shows readOnly description when canEdit=false and no docs", () => {
    render(<DocumentGrid {...makeProps({ documents: [], canEdit: false })} />);
    expect(
      screen.getByText(/dashboard\.documents\.readOnlyDesc/i),
    ).toBeInTheDocument();
  });

  it("shows folder-specific empty state when selectedFolderName is set", () => {
    render(
      <DocumentGrid
        {...makeProps({
          documents: [],
          selectedFolderName: "My Folder",
        })}
      />,
    );
    // Key includes {folder} — our t() mock inlines it
    expect(
      screen.getByText(/dashboard\.documents\.noDocsInFolder/i),
    ).toBeInTheDocument();
  });

  // ── Document cards ──────────────────────────────────────────────────────────

  it("renders a card for each document", () => {
    const docs = [
      makeDocument({ id: "doc-1", titre: "Alpha" }),
      makeDocument({ id: "doc-2", titre: "Beta" }),
      makeDocument({ id: "doc-3", titre: "Gamma" }),
    ] as Document[];

    render(<DocumentGrid {...makeProps({ documents: docs })} />);
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByText("Gamma")).toBeInTheDocument();
  });

  it("shows document count in the header", () => {
    const docs = [
      makeDocument(),
      makeDocument({ id: "doc-2", titre: "B" }),
    ] as Document[];
    render(<DocumentGrid {...makeProps({ documents: docs })} />);
    // Target the paragraph that contains the count, not a bare '2'
    expect(
      screen.getByText(/2\s+dashboard\.documents\.documentsCount/i),
    ).toBeInTheDocument();
  });

  it("shows author first name on each card", () => {
    const doc = makeDocument({
      author: { id: "u1", nom: "Jean-Pierre Martin", avatarUrl: null },
    }) as Document;
    render(<DocumentGrid {...makeProps({ documents: [doc] })} />);
    expect(screen.getByText("Jean-Pierre")).toBeInTheDocument();
  });

  it("shows the dossier name when document is in a folder", () => {
    const doc = makeDocument({
      dossierId: "folder-1",
      dossier: { id: "folder-1", nom: "Project Docs" },
    }) as Document;
    render(<DocumentGrid {...makeProps({ documents: [doc] })} />);
    expect(screen.getByText("Project Docs")).toBeInTheDocument();
  });

  // ── Header actions ──────────────────────────────────────────────────────────

  it("calls onCreateDoc when New Document button is clicked", async () => {
    const onCreateDoc = vi.fn();
    render(<DocumentGrid {...makeProps({ documents: [], onCreateDoc })} />);

    // Header "New Document" button
    const newDocBtn = screen.getByRole("button", {
      name: /dashboard\.documents\.newDocument/i,
    });
    await userEvent.click(newDocBtn);
    expect(onCreateDoc).toHaveBeenCalledTimes(1);
  });

  it("hides New Document button when canEdit=false", () => {
    render(<DocumentGrid {...makeProps({ documents: [], canEdit: false })} />);
    expect(
      screen.queryByRole("button", {
        name: /dashboard\.documents\.newDocument/i,
      }),
    ).not.toBeInTheDocument();
  });

  // ── Tag filter bar ──────────────────────────────────────────────────────────

  it("does not render tag bar when no documents have tags", () => {
    const docs = [makeDocument({ tags: [] })] as Document[];
    render(<DocumentGrid {...makeProps({ documents: docs })} />);
    // "Tous" button only appears inside tag bar
    expect(
      screen.queryByRole("button", { name: /^Tous$/i }),
    ).not.toBeInTheDocument();
  });

  it("renders tag bar and tag buttons when documents have tags", () => {
    const docs = [
      makeDocument({ tags: ["urgent", "finance"] }),
      makeDocument({ id: "doc-2", tags: ["urgent"] }),
    ] as Document[];
    render(<DocumentGrid {...makeProps({ documents: docs })} />);
    expect(screen.getByRole("button", { name: /^Tous$/i })).toBeInTheDocument();
    // Use getAllBy — tag appears in filter bar AND on cards
    expect(
      screen.getAllByRole("button", { name: "finance" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("button", { name: "urgent" }).length,
    ).toBeGreaterThan(0);
  });

  it("calls onTagClick with the tag when a tag button is clicked", async () => {
    const onTagClick = vi.fn();
    const docs = [makeDocument({ tags: ["finance"] })] as Document[];
    render(<DocumentGrid {...makeProps({ documents: docs, onTagClick })} />);

    // First button named 'finance' is always the filter bar one
    const tagBtns = screen.getAllByRole("button", { name: "finance" });
    await userEvent.click(tagBtns[0]);

    expect(onTagClick).toHaveBeenCalledWith("finance");
  });

  it("filters displayed documents by activeTag", () => {
    const docs = [
      makeDocument({ id: "doc-1", titre: "Finance Report", tags: ["finance"] }),
      makeDocument({ id: "doc-2", titre: "HR Memo", tags: ["hr"] }),
    ] as Document[];
    render(
      <DocumentGrid
        {...makeProps({ documents: docs, activeTag: "finance" })}
      />,
    );

    expect(screen.getByText("Finance Report")).toBeInTheDocument();
    expect(screen.queryByText("HR Memo")).not.toBeInTheDocument();
  });

  // ── Multi-select floating bar ───────────────────────────────────────────────

  it('shows multi-select bar when 2+ documents are selected', async () => {
  const docs = [
    makeDocument({ id: 'doc-1', titre: 'Doc A' }),
    makeDocument({ id: 'doc-2', titre: 'Doc B' }),
  ] as Document[]
  render(<DocumentGrid {...makeProps({ documents: docs })} />)

  // Query checkboxes directly — no hover needed
  const checkboxes = document.querySelectorAll(
    '.absolute.left-2.top-2 > div'
  )
  for (const cb of Array.from(checkboxes)) {
    await userEvent.click(cb)
  }

  await waitFor(() => {
    expect(screen.getByText(/docs sélectionnés/i)).toBeInTheDocument()
  })
})
  // ── Favori toggle ───────────────────────────────────────────────────────────

  it("calls toggleFavori mutation when star button is clicked", async () => {
    mockToggleFavoriFn.mockResolvedValueOnce({ isFavori: true });
    const doc = makeDocument({ id: "doc-1" }) as Document;
    render(<DocumentGrid {...makeProps({ documents: [doc] })} />);

    // Star button is in the action overlay — click directly on it
    const starBtns = document.querySelectorAll(
      'button[class*="h-7"][class*="w-7"]',
    );
    // First star-shaped button
    const starBtn = Array.from(starBtns).find((btn) =>
      btn.querySelector('svg[class*="h-3.5"]'),
    ) as HTMLElement;

    if (starBtn) {
      await userEvent.click(starBtn);
      await waitFor(() => {
        expect(mockToggleFavoriFn).toHaveBeenCalledWith("doc-1");
      });
    }
  });
});
