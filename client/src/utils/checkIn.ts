const STORAGE_KEY = 'pinyin_checkin_dates';

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function loadDates(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x) => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x));
  } catch {
    return [];
  }
}

function saveDates(dates: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dates));
  } catch {
    /* ignore */
  }
}

export function getCheckInDateSet(): Set<string> {
  return new Set(loadDates());
}

/** Record today once; returns true if this call newly checked in. */
export function recordDailyCheckIn(): boolean {
  const today = toDateKey(new Date());
  const list = loadDates();
  if (list.includes(today)) return false;
  list.push(today);
  list.sort();
  saveDates(list);
  return true;
}

export function isCheckedInOn(key: string): boolean {
  return loadDates().includes(key);
}

export function countCheckInsInMonth(year: number, monthIndex: number): number {
  const prefix = `${year}-${String(monthIndex + 1).padStart(2, '0')}-`;
  return loadDates().filter((d) => d.startsWith(prefix)).length;
}

export type CalendarCell = {
  day: number | null;
  dateKey: string | null;
};

/** Month grid with Sunday as first column. */
export function buildMonthCalendar(year: number, monthIndex: number): CalendarCell[] {
  const first = new Date(year, monthIndex, 1);
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const startPad = first.getDay();
  const cells: CalendarCell[] = [];

  for (let i = 0; i < startPad; i++) {
    cells.push({ day: null, dateKey: null });
  }
  for (let d = 1; d <= lastDay; d++) {
    const key = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, dateKey: key });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ day: null, dateKey: null });
  }
  return cells;
}
