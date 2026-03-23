import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import App from "./App";

vi.mock("./api", () => ({
  fetchFiles: vi.fn().mockResolvedValue([]),
  fetchSkills: vi.fn().mockResolvedValue([]),
  setBaseUrl: vi.fn(),
  getBaseUrl: vi.fn(() => ""),
}));

vi.mock("./components/FileTree", () => ({
  FileTree: () => <div>file-tree</div>,
}));

vi.mock("./components/FileViewer", () => ({
  FileViewer: () => <div>file-viewer</div>,
}));

vi.mock("./components/Dashboard", () => ({
  Dashboard: () => <div>dashboard-view</div>,
}));

vi.mock("./components/SearchPanel", () => ({
  SearchPanel: () => null,
}));

vi.mock("./components/Connections", () => ({
  Connections: () => <div>connections-view</div>,
}));

vi.mock("./components/Changelog", () => ({
  Changelog: () => <div>changelog-view</div>,
}));

vi.mock("./components/SkillsPage", () => ({
  SkillsPage: () => <div>skills-view</div>,
}));

vi.mock("./components/Timeline", () => ({
  Timeline: () => <div>timeline-view</div>,
}));

vi.mock("./components/MemoryCalendar", () => ({
  MemoryCalendar: () => <div>calendar-view</div>,
}));

vi.mock("./components/AgentStatus", () => ({
  AgentStatusPage: () => <div>agent-status-view</div>,
}));

vi.mock("./components/SettingsPage", () => ({
  SettingsPage: () => <div>settings-view</div>,
}));

vi.mock("./components/Tags", () => ({
  Tags: () => <div>tags-view</div>,
}));

vi.mock("./components/CronManager", () => ({
  CronManager: () => <div>cron-view</div>,
}));

vi.mock("./hooks/useWebSocket", () => ({
  useWebSocket: vi.fn(),
}));

vi.mock("./hooks/useTheme", () => ({
  useTheme: () => ({ theme: "dark", toggle: vi.fn() }),
}));

vi.mock("./hooks/useSensitive", () => ({
  SensitiveProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useSensitiveState: () => ({ hidden: true, toggle: vi.fn() }),
}));

vi.mock("./hooks/useConnections", () => ({
  useConnections: () => ({
    active: { id: "local", url: "", isLocal: true, name: "Local" },
    statuses: { local: true },
    activeId: "local",
    connections: [{ id: "local", isLocal: true, name: "Local", url: "" }],
    switchTo: vi.fn(),
    addConnection: vi.fn(),
    updateConnection: vi.fn(),
    removeConnection: vi.fn(),
    checkStatuses: vi.fn(),
  }),
}));

vi.mock("./hooks/useAgents", () => ({
  useAgents: () => ({
    agents: [{ id: "default", name: "Default Agent", emoji: "🤖", workspace: "/tmp" }],
    selectedAgentId: "default",
    selectAgent: vi.fn(),
  }),
}));

vi.mock("./hooks/useZoom", () => ({
  useZoom: () => ({ zoom: 100, setZoom: vi.fn(), ZOOM_LEVELS: [100] }),
}));

vi.mock("./themes", () => ({
  useMarkdownTheme: () => ({
    current: { id: "default", name: "Default" },
    setTheme: vi.fn(),
    themes: [{ id: "default", name: "Default" }],
  }),
}));

vi.mock("./hooks/useResizableSidebar", () => ({
  useResizableSidebar: () => ({
    width: 240,
    onMouseDown: vi.fn(),
    onTouchStart: vi.fn(),
  }),
}));

vi.mock("./plugins/registry", () => ({
  pluginRegistry: {
    subscribe: () => () => {},
    getSnapshot: () => 0,
    getAll: () => [],
    isEnabled: () => false,
    enable: vi.fn(),
    disable: vi.fn(),
  },
}));

describe("App calendar navigation", () => {
  beforeEach(() => {
    window.history.pushState(null, "", "#/calendar");
  });

  it("restores the calendar view from the hash", async () => {
    render(<App />);

    expect(await screen.findByText("calendar-view")).toBeInTheDocument();
  });

  it("activates the calendar view from the sidebar button", async () => {
    window.history.pushState(null, "", "/");
    const user = userEvent.setup();

    render(<App />);
    await user.click(screen.getByRole("button", { name: /calendar/i }));

    expect(await screen.findByText("calendar-view")).toBeInTheDocument();
    expect(window.location.hash).toBe("#/calendar");
  });
});
