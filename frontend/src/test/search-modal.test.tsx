import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "./helpers";
import { SearchModal } from "@/components/dashboard/SearchModal";
import { searchApi } from "@/lib/search.api";

// Keep a ref so individual tests can inspect calls
const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useParams: () => ({ locale: "en", workspaceId: "ws-1" }),
  usePathname: () => "/en/dashboard",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/search.api", () => ({
  searchApi: { search: vi.fn() },
}));

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  workspaceId: "ws-1",
};

const makeResult = (overrides = {}) => ({
  documentId: "doc-1",
  titre: "My Document",
  excerpt: "Some excerpt text",
  matchType: "fulltext" as const,
  workspaceId: "ws-1",
  workspaceNom: "My Workspace",
  dossierId: null,
  dossierNom: null,
  dateMiseAJour: new Date().toISOString(),
  score: 1,
  ...overrides,
});

describe("SearchModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing when open is false", () => {
    render(<SearchModal {...defaultProps} open={false} />);
    expect(
      screen.queryByPlaceholderText("dashboard.search.placeholder"),
    ).toBeNull();
  });

  it("renders search input when open is true", () => {
    render(<SearchModal {...defaultProps} />);
    expect(
      screen.getByPlaceholderText("dashboard.search.placeholder"),
    ).toBeInTheDocument();
  });

  it("shows empty state when query is empty", () => {
    render(<SearchModal {...defaultProps} />);
    expect(screen.getByText("dashboard.search.title")).toBeInTheDocument();
    expect(screen.getByText("dashboard.search.desc")).toBeInTheDocument();
  });

  it("shows fulltext and semantic hints in empty state", () => {
    render(<SearchModal {...defaultProps} />);
    expect(screen.getByText("dashboard.search.fulltext")).toBeInTheDocument();
    expect(screen.getByText("dashboard.search.semantic")).toBeInTheDocument();
  });

  it("clear button appears when query is typed", () => {
    render(<SearchModal {...defaultProps} />);
    const input = screen.getByPlaceholderText("dashboard.search.placeholder");
    fireEvent.change(input, { target: { value: "hello" } });
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("clears the input when clear button is clicked", () => {
    render(<SearchModal {...defaultProps} />);
    const input = screen.getByPlaceholderText(
      "dashboard.search.placeholder",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "hello" } });
    fireEvent.click(screen.getByRole("button"));
    expect(input.value).toBe("");
  });

  it("calls onClose when backdrop is clicked", () => {
    const onClose = vi.fn();
    render(<SearchModal {...defaultProps} onClose={onClose} />);
    fireEvent.click(document.querySelector(".fixed.inset-0")!);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when Escape key is pressed", () => {
    const onClose = vi.fn();
    render(<SearchModal {...defaultProps} onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not call API immediately on input — debounces", () => {
    render(<SearchModal {...defaultProps} />);
    fireEvent.change(
      screen.getByPlaceholderText("dashboard.search.placeholder"),
      { target: { value: "hello" } },
    );
    expect(searchApi.search).not.toHaveBeenCalled();
  });

  it("calls search API after 350ms debounce", async () => {
    vi.mocked(searchApi.search).mockResolvedValue([]);
    render(<SearchModal {...defaultProps} />);
    fireEvent.change(
      screen.getByPlaceholderText("dashboard.search.placeholder"),
      { target: { value: "hello" } },
    );
    // advanceTimersByTimeAsync flushes both timers AND the resulting promises
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });
    expect(searchApi.search).toHaveBeenCalledWith("ws-1", "hello");
  });

  it("does not search when query is less than 2 characters", async () => {
    vi.mocked(searchApi.search).mockResolvedValue([]);
    render(<SearchModal {...defaultProps} />);
    fireEvent.change(
      screen.getByPlaceholderText("dashboard.search.placeholder"),
      { target: { value: "h" } },
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });
    expect(searchApi.search).not.toHaveBeenCalled();
  });

  it("shows no-results message when API returns empty array", async () => {
    vi.mocked(searchApi.search).mockResolvedValue([]);
    render(<SearchModal {...defaultProps} />);
    fireEvent.change(
      screen.getByPlaceholderText("dashboard.search.placeholder"),
      { target: { value: "xyz" } },
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });
    expect(screen.getByText("dashboard.search.noResults")).toBeInTheDocument();
  });

  it("renders result title when API returns data", async () => {
    vi.mocked(searchApi.search).mockResolvedValue([
      makeResult({ titre: "Alpha Doc" }),
    ]);
    render(<SearchModal {...defaultProps} />);
    fireEvent.change(
      screen.getByPlaceholderText("dashboard.search.placeholder"),
      { target: { value: "alpha" } },
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });
    // highlightMatch splits the title into <mark>Alpha</mark> + " Doc"
    // so we query the result button by its accessible name instead
    expect(
      screen.getByRole("button", { name: /alpha doc/i }),
    ).toBeInTheDocument();
  });

  it("renders excerpt when result has one", async () => {
    vi.mocked(searchApi.search).mockResolvedValue([
      makeResult({ excerpt: "This is the excerpt" }),
    ]);
    render(<SearchModal {...defaultProps} />);
    fireEvent.change(
      screen.getByPlaceholderText("dashboard.search.placeholder"),
      { target: { value: "alpha" } },
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });
    expect(screen.getByText("This is the excerpt")).toBeInTheDocument();
  });

  it("shows AI badge for semantic match results", async () => {
    vi.mocked(searchApi.search).mockResolvedValue([
      makeResult({ matchType: "semantic" }),
    ]);
    render(<SearchModal {...defaultProps} />);
    fireEvent.change(
      screen.getByPlaceholderText("dashboard.search.placeholder"),
      { target: { value: "alpha" } },
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });
    expect(screen.getByText("dashboard.search.aiBadge")).toBeInTheDocument();
  });

  it("navigates to document when result is clicked", async () => {
    vi.mocked(searchApi.search).mockResolvedValue([
      makeResult({ documentId: "doc-42", workspaceId: "ws-1" }),
    ]);
    render(<SearchModal {...defaultProps} />);
    fireEvent.change(
      screen.getByPlaceholderText("dashboard.search.placeholder"),
      { target: { value: "alpha" } },
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });
    fireEvent.click(screen.getByText("My Document"));
    expect(mockPush).toHaveBeenCalledWith(
      "/en/workspace/ws-1/documents/doc-42",
    );
  });
});
