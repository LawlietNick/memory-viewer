import { useEffect, useMemo, useRef, useState } from "react";
import { CaretLeft, CaretRight, Calendar as CalendarIcon, Clock } from "@phosphor-icons/react";
import { fetchTimeline, type TimelineEntry } from "../api";
import { useLocale } from "../hooks/useLocale";

interface Props {
  onOpenFile: (path: string) => void;
}

interface CalendarDay {
  date: string;
  entries: TimelineEntry[];
  count: number;
}

interface MonthCell {
  key: string;
  dayNumber: number | null;
  date: string | null;
  day: CalendarDay | null;
}

interface HoverPreviewState {
  day: CalendarDay;
  x: number;
  y: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function groupEntriesByDate(entries: TimelineEntry[]): Map<string, CalendarDay> {
  const grouped = new Map<string, CalendarDay>();

  for (const entry of entries) {
    const existing = grouped.get(entry.date);
    if (existing) {
      existing.entries.push(entry);
      existing.count += 1;
      continue;
    }
    grouped.set(entry.date, { date: entry.date, entries: [entry], count: 1 });
  }

  return grouped;
}

export function buildMonthCells(month: Date, grouped: Map<string, CalendarDay>): MonthCell[] {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1);
  const leading = firstDay.getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: MonthCell[] = [];

  for (let i = 0; i < leading; i++) {
    cells.push({ key: `empty-start-${i}`, dayNumber: null, date: null, day: null });
  }

  for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber++) {
    const date = formatDateKey(new Date(year, monthIndex, dayNumber));
    cells.push({
      key: date,
      dayNumber,
      date,
      day: grouped.get(date) || null,
    });
  }

  const trailing = (7 - (cells.length % 7)) % 7;
  for (let i = 0; i < trailing; i++) {
    cells.push({ key: `empty-end-${i}`, dayNumber: null, date: null, day: null });
  }

  return cells;
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function sameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function fmtDayCount(count: number, t: (key: string) => string) {
  return `${count} ${count === 1 ? t("calendar.memory") : t("calendar.memories")}`;
}

function formatMonthLabel(month: Date, locale: string, t: (key: string) => string) {
  const year = month.getFullYear();
  const monthLabel = t(`month.${String(month.getMonth() + 1).padStart(2, "0")}`);
  return locale.startsWith("zh") ? `${year}年 ${monthLabel}` : `${monthLabel} ${year}`;
}

function formatFullDate(date: string, locale: string) {
  const intlLocale = locale.startsWith("zh") ? "zh-CN" : locale === "fi" ? "fi-FI" : "en-US";
  return new Intl.DateTimeFormat(intlLocale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

function formatRelativeDay(date: string, t: (key: string) => string) {
  const todayKey = formatDateKey(new Date());
  if (date === todayKey) return t("sidebar.today");

  const yesterdayKey = formatDateKey(new Date(Date.now() - DAY_MS));
  if (date === yesterdayKey) return t("calendar.yesterday");

  return date;
}

export function MemoryCalendar({ onOpenFile }: Props) {
  const { t, locale } = useLocale();
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [popoverAnchor, setPopoverAnchor] = useState<DOMRect | null>(null);
  const [hoverPreview, setHoverPreview] = useState<HoverPreviewState | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const today = useMemo(() => new Date(), []);
  const [currentMonth, setCurrentMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await fetchTimeline();
        setEntries(data);
      } catch (error) {
        console.error("Calendar load failed:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!popoverRef.current) return;
      if (popoverRef.current.contains(event.target as Node)) return;
      setSelectedDate(null);
      setPopoverAnchor(null);
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const grouped = useMemo(() => groupEntriesByDate(entries), [entries]);
  const monthCells = useMemo(() => buildMonthCells(currentMonth, grouped), [currentMonth, grouped]);
  const selectedDay = selectedDate ? grouped.get(selectedDate) || null : null;
  const currentMonthHasEntries = monthCells.some((cell) => cell.day);

  const weekDays = locale.startsWith("zh")
    ? ["日", "一", "二", "三", "四", "五", "六"]
    : locale === "fi"
      ? ["Su", "Ma", "Ti", "Ke", "To", "Pe", "La"]
      : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const openDayPopover = (day: CalendarDay, target: HTMLElement) => {
    setSelectedDate(day.date);
    setPopoverAnchor(target.getBoundingClientRect());
    const dayDate = new Date(`${day.date}T00:00:00`);
    if (!sameMonth(currentMonth, dayDate)) {
      setCurrentMonth(new Date(dayDate.getFullYear(), dayDate.getMonth(), 1));
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <CalendarIcon className="w-7 h-7 text-emerald-400" />
            {t("calendar.title")}
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            {loading ? t("calendar.loading") : `${entries.length} ${t("timeline.entries")}`}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}
            className="p-2 rounded-lg transition-colors hover:bg-white/5"
            style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            aria-label={t("calendar.previousMonth")}
          >
            <CaretLeft className="w-4 h-4" />
          </button>
          <div
            className="px-4 py-2 rounded-lg min-w-44 text-center text-sm font-semibold"
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          >
            {formatMonthLabel(currentMonth, locale, t)}
          </div>
          <button
            type="button"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-2 rounded-lg transition-colors hover:bg-white/5"
            style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            aria-label={t("calendar.nextMonth")}
          >
            <CaretRight className="w-4 h-4" />
          </button>
          {!sameMonth(currentMonth, today) && (
            <button
              type="button"
              onClick={() => setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1))}
              className="px-3 py-2 rounded-lg text-sm transition-colors hover:bg-white/5"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            >
              {t("calendar.todayButton")}
            </button>
          )}
        </div>
      </div>

      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)" }}
      >
        <div className="grid grid-cols-7 border-b" style={{ borderColor: "var(--border)" }}>
          {weekDays.map((label) => (
            <div
              key={label}
              className="px-3 py-3 text-xs font-semibold uppercase tracking-wide"
              style={{ color: "var(--text-faint)", background: "var(--bg-secondary)" }}
            >
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {monthCells.map((cell) => {
            if (!cell.date || !cell.dayNumber) {
              return (
                <div
                  key={cell.key}
                  className="min-h-28 border-r border-b"
                  style={{ borderColor: "var(--border)", background: "var(--bg-secondary)", opacity: 0.35 }}
                />
              );
            }

            const isToday = cell.date === formatDateKey(today);
            const isSelected = selectedDate === cell.date;
            const hasEntries = Boolean(cell.day);

            return (
              <button
                key={cell.key}
                type="button"
                className="relative min-h-28 p-3 text-left border-r border-b transition-colors"
                style={{
                  borderColor: "var(--border)",
                  background: isSelected
                    ? "var(--bg-active)"
                    : hasEntries
                      ? "color-mix(in srgb, var(--bg-secondary) 84%, #22c55e 16%)"
                      : "var(--bg-primary)",
                  cursor: hasEntries ? "pointer" : "default",
                }}
                onMouseEnter={(event) => {
                  if (!cell.day) return;
                  const rect = event.currentTarget.getBoundingClientRect();
                  setHoverPreview({
                    day: cell.day,
                    x: rect.left + rect.width / 2,
                    y: rect.top - 10,
                  });
                }}
                onMouseLeave={() => setHoverPreview((current) => (current?.day.date === cell.date ? null : current))}
                onClick={(event) => {
                  if (!cell.day) return;
                  openDayPopover(cell.day, event.currentTarget);
                }}
                aria-label={hasEntries ? `${cell.date} ${fmtDayCount(cell.day!.count, t)}` : cell.date}
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className="inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold"
                    style={{
                      background: isToday ? "#22c55e" : "transparent",
                      color: isToday ? "#052e16" : "var(--text-primary)",
                      border: isToday ? "none" : "1px solid transparent",
                    }}
                  >
                    {cell.dayNumber}
                  </span>
                  {cell.day && (
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{ background: "rgba(34,197,94,0.16)", color: "#34d399" }}
                    >
                      {cell.day.count}
                    </span>
                  )}
                </div>

                {cell.day ? (
                  <div className="mt-5">
                    <div className="text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                      {fmtDayCount(cell.day.count, t)}
                    </div>
                    <div className="text-sm font-semibold line-clamp-2" style={{ color: "var(--text-primary)" }}>
                      {cell.day.entries[0]?.title}
                    </div>
                    <div className="text-xs mt-1 line-clamp-2" style={{ color: "var(--text-faint)" }}>
                      {cell.day.entries[0]?.preview}
                    </div>
                  </div>
                ) : (
                  <div className="mt-7 text-xs" style={{ color: "var(--text-faint)" }}>
                    {isToday ? t("calendar.todayHint") : ""}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {!loading && !currentMonthHasEntries && (
        <div className="text-center py-12" style={{ color: "var(--text-faint)" }}>
          <CalendarIcon size={40} className="mx-auto mb-3 opacity-30" />
          <p>{t("calendar.emptyMonth")}</p>
        </div>
      )}

      {hoverPreview && (
        <div
          data-testid="calendar-hover-preview"
          className="hidden md:block fixed w-80 rounded-xl p-3 pointer-events-none"
          style={{
            left: hoverPreview.x,
            top: hoverPreview.y,
            transform: "translate(-50%, -100%)",
            background: "var(--bg-secondary)",
            color: "var(--text-primary)",
            border: "1px solid var(--border)",
            boxShadow: "0 12px 40px rgba(0,0,0,0.28)",
            zIndex: 30,
          }}
        >
          <div className="text-xs font-semibold mb-2" style={{ color: "var(--text-faint)" }}>
            {formatFullDate(hoverPreview.day.date, locale)} · {fmtDayCount(hoverPreview.day.count, t)}
          </div>
          <div className="space-y-2">
            {hoverPreview.day.entries.slice(0, 2).map((entry) => (
              <div key={entry.path}>
                <div className="text-sm font-semibold truncate">{entry.title}</div>
                <div className="text-xs mt-0.5 line-clamp-2" style={{ color: "var(--text-muted)" }}>
                  {entry.preview}
                </div>
              </div>
            ))}
          </div>
          {hoverPreview.day.count > 2 && (
            <div className="text-xs mt-3" style={{ color: "var(--text-faint)" }}>
              +{hoverPreview.day.count - 2} {t("calendar.moreMemories")}
            </div>
          )}
        </div>
      )}

      {selectedDay && popoverAnchor && (
        <div
          ref={popoverRef}
          data-testid="calendar-day-popover"
          className="fixed w-[min(26rem,calc(100vw-2rem))] rounded-2xl p-4"
          style={{
            top: Math.min(popoverAnchor.bottom + 10, window.innerHeight - 24),
            left: Math.min(Math.max(popoverAnchor.left, 16), window.innerWidth - 432),
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            boxShadow: "0 16px 48px rgba(0,0,0,0.32)",
            zIndex: 40,
          }}
        >
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                {formatFullDate(selectedDay.date, locale)}
              </div>
              <div className="text-xs mt-1" style={{ color: "var(--text-faint)" }}>
                {fmtDayCount(selectedDay.count, t)} · {formatRelativeDay(selectedDay.date, t)}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedDate(null);
                setPopoverAnchor(null);
              }}
              className="text-xs px-2 py-1 rounded-md transition-colors hover:bg-white/5"
              style={{ color: "var(--text-muted)" }}
            >
              {t("file.cancel")}
            </button>
          </div>

          <div className="space-y-2 max-h-80 overflow-auto pr-1">
            {selectedDay.entries.map((entry) => (
              <button
                key={entry.path}
                type="button"
                onClick={() => {
                  setSelectedDate(null);
                  setPopoverAnchor(null);
                  onOpenFile(entry.path);
                }}
                className="w-full text-left rounded-xl p-3 transition-colors hover:bg-white/5"
                style={{ background: "var(--bg-tertiary)" }}
              >
                <div className="flex items-center gap-2 text-xs mb-1" style={{ color: "var(--text-faint)" }}>
                  <Clock className="w-3 h-3" />
                  {entry.path.split("/").pop()}
                </div>
                <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  {entry.title}
                </div>
                <div className="text-xs mt-1 line-clamp-2" style={{ color: "var(--text-muted)" }}>
                  {entry.preview}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
