import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FileViewer } from "./FileViewer";
import { LocaleContext } from "../hooks/useLocale";

const fetchFileMock = vi.fn();
const saveFileMock = vi.fn();
const resolveWikilinkMock = vi.fn();

vi.mock("../api", () => ({
  fetchFile: (...args: unknown[]) => fetchFileMock(...args),
  saveFile: (...args: unknown[]) => saveFileMock(...args),
  resolveWikilink: (...args: unknown[]) => resolveWikilinkMock(...args),
}));

vi.mock("./MarkdownEditor", () => ({
  MarkdownEditor: ({
    value,
    onChange,
    onScrollRatioChange,
  }: {
    value: string;
    onChange: (value: string) => void;
    onScrollRatioChange?: (ratio: number) => void;
  }) => (
    <div data-testid="mock-markdown-editor">
      <textarea
        data-testid="markdown-editor-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button type="button" onClick={() => onScrollRatioChange?.(0.7)}>
        report-scroll
      </button>
    </div>
  ),
}));

vi.mock("../plugins/PluginSlot", () => ({
  PluginSlot: () => null,
}));

vi.mock("./SensitiveMask", () => ({
  SensitiveText: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../themes", () => ({
  useMarkdownTheme: () => ({
    current: { id: "default", name: "Default" },
    setTheme: vi.fn(),
    themes: [{ id: "default", name: "Default" }],
  }),
}));

vi.mock("../themes/apply", () => ({
  applyThemeStyles: vi.fn(),
  cleanInlineStyles: vi.fn(),
}));

vi.mock("beautiful-mermaid", () => ({
  renderMermaid: vi.fn().mockResolvedValue("<svg />"),
  THEMES: { "github-dark": {}, "github-light": {} },
}));

vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn().mockResolvedValue({ svg: "<svg />" }),
  },
}));

vi.mock("shiki", () => ({
  createHighlighter: vi.fn().mockResolvedValue({
    getLoadedLanguages: () => [],
    codeToHtml: () => "<pre>mock code</pre>",
  }),
}));

const localeValue = {
  locale: "en" as const,
  setLocale: () => {},
  toggleLocale: () => {},
  t: (key: string) => {
    const map: Record<string, string> = {
      "file.edit": "Edit",
      "file.save": "Save",
      "file.cancel": "Cancel",
      "file.loading": "Loading…",
      "file.words": "words",
      "file.showPreview": "Show Preview",
      "file.hidePreview": "Hide Preview",
      "file.editorTab": "Editor",
      "file.previewTab": "Preview",
      "file.livePreview": "Live Preview",
      "file.copy": "Copy",
      "file.failedToLoad": "Failed to load",
      "file.discardChanges": "Discard unsaved changes?",
      "file.saved": "Saved",
      "file.saveFailed": "Save failed",
      "file.reloaded": "Reloaded from server",
    };
    return map[key] ?? key;
  },
};

function renderViewer() {
  return render(
    <LocaleContext.Provider value={localeValue}>
      <FileViewer filePath="memory/2026-03-24.md" />
    </LocaleContext.Provider>
  );
}

describe("FileViewer split preview editing", () => {
  beforeEach(() => {
    fetchFileMock.mockResolvedValue({
      content: "# Original heading\n\nInitial body text.",
      mtime: new Date("2026-03-24T10:00:00Z").toISOString(),
      size: 64,
    });
    saveFileMock.mockResolvedValue({ ok: true, mtime: new Date("2026-03-24T10:01:00Z").toISOString() });
    resolveWikilinkMock.mockResolvedValue({ found: false, path: null });
    localStorage.clear();
    window.confirm = vi.fn(() => true);
  });

  it("shows editor and live preview side by side on wider screens", async () => {
    window.innerWidth = 1400;
    renderViewer();

    await screen.findByText("Original heading");
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(await screen.findByTestId("mock-markdown-editor")).toBeInTheDocument();
    expect(screen.getByTestId("file-edit-preview")).toBeInTheDocument();
    expect(screen.getByText("Live Preview")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hide Preview" })).toBeInTheDocument();
  });

  it("updates the rendered preview immediately while typing", async () => {
    window.innerWidth = 1400;
    renderViewer();

    await screen.findByText("Original heading");
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    const input = await screen.findByTestId("markdown-editor-input");

    await userEvent.clear(input);
    await userEvent.type(input, "# Updated preview{enter}{enter}Fresh content");

    expect(await screen.findByText("Updated preview")).toBeInTheDocument();
    expect(screen.getByText("Fresh content")).toBeInTheDocument();
  });

  it("uses editor and preview tabs on narrow screens", async () => {
    window.innerWidth = 700;
    renderViewer();

    await screen.findByText("Original heading");
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(screen.getByRole("button", { name: "Editor" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Preview" })).toBeInTheDocument();
    expect(screen.queryByTestId("file-edit-preview")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Preview" }));

    expect(await screen.findByTestId("file-edit-preview")).toBeInTheDocument();
    expect(screen.getByText("Original heading")).toBeInTheDocument();
  });

  it("can hide and restore the desktop preview", async () => {
    window.innerWidth = 1400;
    renderViewer();

    await screen.findByText("Original heading");
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));

    await userEvent.click(await screen.findByRole("button", { name: "Hide Preview" }));
    await waitFor(() => {
      expect(screen.queryByTestId("file-edit-preview")).not.toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: "Show Preview" }));
    expect(await screen.findByTestId("file-edit-preview")).toBeInTheDocument();
  });
});
