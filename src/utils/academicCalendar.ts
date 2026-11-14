/**
 * Pure helpers for academic-calendar data (no React / Firebase dependencies).
 *
 * Calendar JSON files live in `src/data/calendars/` and follow the
 * {@link AcademicCalendarData} shape.
 */

export interface CalendarEvent {
  /** Day-of-month text, e.g. `"15"` or `"15-17"` (the first number is used). */
  date: string;
  /** Day-of-week label, e.g. `"Mon"`. */
  day: string;
  event: string;
}

export interface CalendarMonth {
  /** Full English month name, e.g. `"August"`. */
  name: string;
  events: CalendarEvent[];
}

export interface AcademicCalendarData {
  months: CalendarMonth[];
}

export interface UpcomingEvent {
  event: CalendarEvent;
  monthName: string;
  daysRemaining: number;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Index (0-11) of a full English month name, or -1 if it is not recognised. */
export function getMonthIndex(monthName: string): number {
  return MONTH_NAMES.findIndex((name) => name.toLowerCase() === monthName.trim().toLowerCase());
}

/**
 * Whole days from `today` until the event. Negative for past events.
 *
 * The academic year runs July-June, so a January-June event seen from
 * July-December is treated as belonging to the following calendar year.
 * Returns `null` when the date or month cannot be parsed.
 */
export function calculateDaysRemaining(dateString: string, monthName: string, today: Date = new Date()): number | null {
  const dayMatch = dateString.match(/(\d+)/);
  const eventMonthIdx = getMonthIndex(monthName);
  if (!dayMatch || eventMonthIdx === -1) return null;

  const day = parseInt(dayMatch[1], 10);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  let eventYear = start.getFullYear();
  if (eventMonthIdx < 6 && start.getMonth() >= 6) {
    eventYear += 1;
  }
  const eventDate = new Date(eventYear, eventMonthIdx, day);

  // Round (not floor) so daylight-saving shifts never cause an off-by-one.
  return Math.round((eventDate.getTime() - start.getTime()) / MS_PER_DAY);
}

/** Human-friendly countdown label. */
export function formatDaysRemaining(days: number): string {
  if (days < -1) return `${Math.abs(days)} days ago`;
  if (days === -1) return '1 day ago';
  if (days === 0) return 'Today';
  if (days === 1) return '1 day to go';
  return `${days} days to go`;
}

/** The soonest event happening today or later, or `null` if there is none. */
export function findNextEvent(months: CalendarMonth[], today: Date = new Date()): UpcomingEvent | null {
  let next: UpcomingEvent | null = null;
  for (const month of months) {
    for (const event of month.events) {
      const days = calculateDaysRemaining(event.date, month.name, today);
      if (days !== null && days >= 0 && (next === null || days < next.daysRemaining)) {
        next = { event, monthName: month.name, daysRemaining: days };
      }
    }
  }
  return next;
}

/** Index of the month containing the next upcoming event (0 if there is none). */
export function getInitialMonthIndex(months: CalendarMonth[], today: Date = new Date()): number {
  const next = findNextEvent(months, today);
  if (!next) return 0;
  return Math.max(
    0,
    months.findIndex((month) => month.name === next.monthName),
  );
}
