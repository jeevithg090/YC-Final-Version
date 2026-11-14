import {
  calculateDaysRemaining,
  findNextEvent,
  formatDaysRemaining,
  getInitialMonthIndex,
  getMonthIndex,
  type CalendarMonth,
} from '../academicCalendar';

// Local-time dates so tests are independent of the machine's time zone.
const date = (year: number, month: number, day: number) => new Date(year, month - 1, day, 15, 30);

describe('getMonthIndex', () => {
  it('maps month names case-insensitively', () => {
    expect(getMonthIndex('January')).toBe(0);
    expect(getMonthIndex('december')).toBe(11);
    expect(getMonthIndex(' August ')).toBe(7);
  });

  it('returns -1 for unknown names', () => {
    expect(getMonthIndex('Smarch')).toBe(-1);
  });
});

describe('calculateDaysRemaining', () => {
  it('counts whole days ignoring the time of day', () => {
    expect(calculateDaysRemaining('20', 'August', date(2026, 8, 15))).toBe(5);
    expect(calculateDaysRemaining('15', 'August', date(2026, 8, 15))).toBe(0);
    expect(calculateDaysRemaining('10', 'August', date(2026, 8, 15))).toBe(-5);
  });

  it('uses the first number in ranges like "15-17"', () => {
    expect(calculateDaysRemaining('17-19', 'August', date(2026, 8, 15))).toBe(2);
  });

  it('places January-June events in the next year during July-December', () => {
    expect(calculateDaysRemaining('1', 'January', date(2026, 12, 31))).toBe(1);
  });

  it('keeps January-June events in the current year during January-June', () => {
    expect(calculateDaysRemaining('10', 'March', date(2027, 3, 1))).toBe(9);
  });

  it('is not thrown off by daylight-saving transitions', () => {
    // Spans the March DST change in time zones that observe it.
    expect(calculateDaysRemaining('31', 'March', date(2027, 3, 1))).toBe(30);
  });

  it('returns null for unparseable input', () => {
    expect(calculateDaysRemaining('TBA', 'August', date(2026, 8, 1))).toBeNull();
    expect(calculateDaysRemaining('12', 'Smarch', date(2026, 8, 1))).toBeNull();
  });
});

describe('formatDaysRemaining', () => {
  it.each([
    [-5, '5 days ago'],
    [-1, '1 day ago'],
    [0, 'Today'],
    [1, '1 day to go'],
    [12, '12 days to go'],
  ])('formats %i as "%s"', (days, label) => {
    expect(formatDaysRemaining(days)).toBe(label);
  });
});

describe('findNextEvent / getInitialMonthIndex', () => {
  const months: CalendarMonth[] = [
    { name: 'July', events: [{ date: '20', day: 'Mon', event: 'Orientation' }] },
    {
      name: 'August',
      events: [
        { date: '1', day: 'Fri', event: 'Classes begin' },
        { date: '25', day: 'Mon', event: 'Mid-terms' },
      ],
    },
    { name: 'January', events: [{ date: '5', day: 'Mon', event: 'Even semester' }] },
  ];

  it('returns the soonest event on or after today', () => {
    const next = findNextEvent(months, date(2026, 8, 10));
    expect(next).toEqual({
      event: { date: '25', day: 'Mon', event: 'Mid-terms' },
      monthName: 'August',
      daysRemaining: 15,
    });
    expect(getInitialMonthIndex(months, date(2026, 8, 10))).toBe(1);
  });

  it('includes events happening today', () => {
    expect(findNextEvent(months, date(2026, 8, 25))?.daysRemaining).toBe(0);
  });

  it('rolls over into the next calendar year', () => {
    expect(findNextEvent(months, date(2026, 9, 1))?.event.event).toBe('Even semester');
    expect(getInitialMonthIndex(months, date(2026, 9, 1))).toBe(2);
  });

  it('handles empty calendars', () => {
    expect(findNextEvent([], date(2026, 8, 1))).toBeNull();
    expect(getInitialMonthIndex([], date(2026, 8, 1))).toBe(0);
  });
});
