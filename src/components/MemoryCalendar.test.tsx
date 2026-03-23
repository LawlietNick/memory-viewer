import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryCalendar, buildMonthCells, groupEntriesByDate } from "./MemoryCalendar";
import { LocaleContext } from "../hooks/useLocale";
import type { TimelineEntry } from "../api";

const fetchTimelineMock = vi.fn();

vi.mock("../api", () => ({
  fetchTimeline: () => fetchTimelineMock(),
}));

const localeValue = {
  locale: "en" as const,
  setLocale: () => {},
  toggleLocale: () => {},
  t: (key: string) => key,
};

const helperEntries: TimelineEntry[] = [
  {
    date: "2025-03-05",
    path: "memory/2025-03-05-evening.md",
    title: "Evening notes",
    preview: "Wrapped the day with a calm summary.",
    tags: [],
    charCount: 100,
  },
  {
    date: "2025-03-05",
    path: "memory/2025-03-05-morning.md",
    title: "Morning notes",
    preview: "Started with planning and coffee.",
    tags: [],
    charCount: 120,
  },
  {
    date: "2025-03-12",
    path: "memory/2025-03-12.md",
    title: "Ship log",
    preview: "Implemented the calendar view.",
    tags: [],
    charCount: 140,
  },
];

function createCurrentMonthEntries(): TimelineEntry[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  return [
    {
      date: `${year}-${month}-05`,
      path: `memory/${year}-${month}-05-evening.md`,
      title: "Evening notes",
      preview: "Wrapped the day with a calm summary.",
      tags: [],
      charCount: 100,
    },
    {
      date: `${year}-${month}-05`,
      path: `memory/${year}-${month}-05-morning.md`,
      title: "Morning notes",
      preview: "Started with planning and coffee.",
      tags: [],
      charCount: 120,
    },
    {
      date: `${year}-${month}-12`,
      path: `memory/${year}-${month}-12.md`,
      title: "Ship log",
      preview: "Implemented the calendar view.",
      tags: [],
      charCount: 140,
    },
  ];
}

describe("MemoryCalendar helpers", () => {
  it("groups entries by day and counts duplicates", () => {
    const grouped = groupEntriesByDate(helperEntries);

    expect(grouped.get("2025-03-05")?.count).toBe(2);
    expect(grouped.get("2025-03-05")?.entries.map((entry) => entry.title)).toEqual([
      "Evening notes",
      "Morning notes",
    ]);
  });

  it("builds month cells with leading and trailing blanks", () => {
    const grouped = groupEntriesByDate(helperEntries);
    const cells = buildMonthCells(new Date(2025, 2, 1), grouped);

    expect(cells).toHaveLength(42);
    expect(cells.slice(0, 6).every((cell) => cell.date === null)).toBe(true);
    expect(cells[6].date).toBe("2025-03-01");
    expect(cells[10].day?.count).toBe(2);
  });
});

describe("MemoryCalendar interactions", () => {
  const currentEntries = createCurrentMonthEntries();
  const repeatedDate = currentEntries[0].date;

  beforeEach(() => {
    fetchTimelineMock.mockResolvedValue(currentEntries);
  });

  afterEach(() => {
    fetchTimelineMock.mockReset();
  });

  it("defaults to the current month", async () => {
    render(
      <LocaleContext.Provider value={localeValue}>
        <MemoryCalendar onOpenFile={() => {}} />
      </LocaleContext.Provider>
    );

    const monthKey = `month.${String(new Date().getMonth() + 1).padStart(2, "0")}`;
    const year = new Date().getFullYear();
    expect(screen.getByText(`${monthKey} ${year}`)).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: `${repeatedDate} 2 calendar.memories` })).toBeInTheDocument();
  });

  it("shows a hover preview and opens a day popover", async () => {
    const user = userEvent.setup();

    render(
      <LocaleContext.Provider value={localeValue}>
        <MemoryCalendar onOpenFile={() => {}} />
      </LocaleContext.Provider>
    );

    const dayButton = await screen.findByRole("button", { name: `${repeatedDate} 2 calendar.memories` });
    await user.hover(dayButton);

    const preview = await screen.findByTestId("calendar-hover-preview");
    expect(preview).toBeInTheDocument();
    expect(within(preview).getByText("Evening notes")).toBeInTheDocument();

    await user.click(dayButton);

    const popover = await screen.findByTestId("calendar-day-popover");
    expect(popover).toBeInTheDocument();
    expect(within(popover).getByText("Morning notes")).toBeInTheDocument();
  });

  it("opens the selected memory from the day popover", async () => {
    const user = userEvent.setup();
    const onOpenFile = vi.fn();

    render(
      <LocaleContext.Provider value={localeValue}>
        <MemoryCalendar onOpenFile={onOpenFile} />
      </LocaleContext.Provider>
    );

    const dayButton = await screen.findByRole("button", { name: `${repeatedDate} 2 calendar.memories` });
    await user.click(dayButton);
    const popover = await screen.findByTestId("calendar-day-popover");
    await user.click(within(popover).getByText("Morning notes"));

    expect(onOpenFile).toHaveBeenCalledWith(`memory/${repeatedDate}-morning.md`);
  });

  it("does nothing when an empty day is clicked", async () => {
    const user = userEvent.setup();
    const onOpenFile = vi.fn();

    render(
      <LocaleContext.Provider value={localeValue}>
        <MemoryCalendar onOpenFile={onOpenFile} />
      </LocaleContext.Provider>
    );

    const emptyDay = await screen.findByRole("button", { name: `${repeatedDate.slice(0, 8)}01` });
    await user.click(emptyDay);

    await waitFor(() => {
      expect(screen.queryByTestId("calendar-day-popover")).not.toBeInTheDocument();
    });
    expect(onOpenFile).not.toHaveBeenCalled();
  });
});
