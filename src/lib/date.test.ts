import { describe, expect, it } from 'vitest'
import {
  addDays,
  addMonths,
  addWeeks,
  clockMinutes,
  compareClimbsByTime,
  endOfMonth,
  formatDuration,
  formatMonthLabel,
  formatTimeWindow,
  formatWeekRange,
  isSameMonth,
  isToday,
  monthDays,
  parseISODate,
  parseISOMonth,
  resolveWeekStart,
  startOfMonth,
  startOfWeek,
  toISODate,
  toISOMonth,
  trimTime,
  weekDays,
  windowMinutes,
} from './date'

describe('toISODate', () => {
  it('formats local dates without shifting to UTC', () => {
    expect(toISODate(new Date(2026, 8, 16))).toBe('2026-09-16')
    expect(toISODate(new Date(2026, 0, 1, 23, 30))).toBe('2026-01-01')
    expect(toISODate(new Date(2026, 11, 31, 0, 5))).toBe('2026-12-31')
  })
})

describe('parseISODate', () => {
  it('round-trips a date string', () => {
    expect(toISODate(parseISODate('2026-09-14'))).toBe('2026-09-14')
  })

  it('parses to local midnight', () => {
    const parsed = parseISODate('2026-09-14')
    expect([parsed.getHours(), parsed.getMinutes(), parsed.getDate()]).toEqual([0, 0, 14])
  })
})

describe('startOfWeek', () => {
  it('returns the Monday of the containing week', () => {
    expect(toISODate(startOfWeek(new Date(2026, 8, 14)))).toBe('2026-09-14') // Monday
    expect(toISODate(startOfWeek(new Date(2026, 8, 16)))).toBe('2026-09-14') // Wednesday
    expect(toISODate(startOfWeek(new Date(2026, 8, 20)))).toBe('2026-09-14') // Sunday
  })

  it('drops the time of day', () => {
    const monday = startOfWeek(new Date(2026, 8, 16, 22, 45, 30))
    expect([monday.getHours(), monday.getMinutes(), monday.getSeconds()]).toEqual([0, 0, 0])
  })
})

describe('weekDays', () => {
  it('returns Mon → Sun', () => {
    const days = weekDays(new Date(2026, 8, 14)).map((day) => toISODate(day))
    expect(days).toEqual([
      '2026-09-14',
      '2026-09-15',
      '2026-09-16',
      '2026-09-17',
      '2026-09-18',
      '2026-09-19',
      '2026-09-20',
    ])
  })
})

describe('addDays / addWeeks', () => {
  it('moves forward and backward across month boundaries', () => {
    expect(toISODate(addDays(new Date(2026, 8, 30), 2))).toBe('2026-10-02')
    expect(toISODate(addDays(new Date(2026, 9, 2), -2))).toBe('2026-09-30')
    expect(toISODate(addWeeks(new Date(2026, 8, 14), 1))).toBe('2026-09-21')
    expect(toISODate(addWeeks(new Date(2026, 8, 14), -1))).toBe('2026-09-07')
  })
})

describe('time helpers', () => {
  it('trims Postgres seconds and formats a window', () => {
    expect(trimTime('18:30:00')).toBe('18:30')
    expect(formatTimeWindow('18:30:00', '21:00:00')).toBe('18:30 – 21:00')
  })

  it('formats durations in hours and minutes', () => {
    expect(formatDuration('18:30', '21:00')).toBe('2h 30m')
    expect(formatDuration('07:00:00', '09:00:00')).toBe('2h')
    expect(formatDuration('07:00:00', '07:25:00')).toBe('25m')
    expect(formatDuration('09:00:00', '08:00:00')).toBe('0m')
  })

  it('formats slot windows, including mixed ones', () => {
    expect(formatTimeWindow(null, null, 'Opening', 'Before Dinner')).toBe('Opening – Before Dinner')
    expect(formatTimeWindow(null, '21:00:00', 'Opening', null)).toBe('Opening – 21:00')
    expect(formatTimeWindow('18:30:00', null, null, 'Closing')).toBe('18:30 – Closing')
  })

  it('puts clock times and slots on one canonical scale', () => {
    expect(clockMinutes('07:15:00')).toBe(435)
    expect(clockMinutes(null)).toBeNull()
    expect(clockMinutes('not a time')).toBeNull()

    expect(windowMinutes('07:15:00', null)).toBe(435)
    expect(windowMinutes(null, 'Before Lunch')).toBe(630)
    expect(windowMinutes(null, 'Brunch')).toBeNull()
    expect(windowMinutes(null, null)).toBeNull()
  })
})

describe('formatWeekRange', () => {
  it('collapses the month for a Mon–Sun week', () => {
    const label = formatWeekRange(new Date(2026, 8, 14))
    expect(label).toContain('14')
    expect(label).toContain('20')
    expect(label).toContain('2026')
  })

  it('mentions both months when a week spans them', () => {
    const label = formatWeekRange(new Date(2026, 8, 28))
    expect(label).toContain('Sep')
    expect(label).toContain('Oct')
  })
})

describe('compareClimbsByTime', () => {
  it('sorts by date then start time', () => {
    const rows = [
      { climb_date: '2026-09-16', start_time: '18:00:00' },
      { climb_date: '2026-09-15', start_time: '20:00:00' },
      { climb_date: '2026-09-16', start_time: '07:00:00' },
    ]
    expect(rows.slice().sort(compareClimbsByTime)).toEqual([
      { climb_date: '2026-09-15', start_time: '20:00:00' },
      { climb_date: '2026-09-16', start_time: '07:00:00' },
      { climb_date: '2026-09-16', start_time: '18:00:00' },
    ])
  })

  it('interleaves slot-based starts with exact times', () => {
    const rows = [
      { climb_date: '2026-09-16', start_time: '18:00:00', start_slot: null },
      { climb_date: '2026-09-16', start_time: null, start_slot: 'Opening' },
      { climb_date: '2026-09-16', start_time: null, start_slot: 'After Dinner' },
      { climb_date: '2026-09-15', start_time: null, start_slot: 'Closing' },
    ]

    expect(
      rows
        .slice()
        .sort(compareClimbsByTime)
        .map((row) => row.start_time ?? row.start_slot),
    ).toEqual(['Closing', 'Opening', '18:00:00', 'After Dinner'])
  })
})

describe('isToday', () => {
  it('accepts both strings and dates', () => {
    const today = new Date()
    expect(isToday(today)).toBe(true)
    expect(isToday(toISODate(today))).toBe(true)
    expect(isToday(addDays(today, 1))).toBe(false)
  })
})

describe('month helpers', () => {
  it('keys a month as YYYY-MM and parses it back', () => {
    expect(toISOMonth(new Date(2026, 8, 20))).toBe('2026-09')
    expect(toISOMonth(new Date(2026, 11, 1))).toBe('2026-12')

    const september = parseISOMonth('2026-09')
    expect(september && toISODate(september)).toBe('2026-09-01')
    expect(parseISOMonth('nope')).toBeNull()
    expect(parseISOMonth('2026-13')).toBeNull()
  })

  it('finds the first and last day of the month', () => {
    expect(toISODate(startOfMonth(new Date(2026, 8, 20)))).toBe('2026-09-01')
    expect(toISODate(endOfMonth(new Date(2026, 8, 20)))).toBe('2026-09-30')
    // February in a leap year.
    expect(toISODate(endOfMonth(new Date(2028, 1, 5)))).toBe('2028-02-29')
  })

  it('shifts whole months and clamps the day', () => {
    expect(toISODate(addMonths(new Date(2026, 8, 20), 1))).toBe('2026-10-20')
    expect(toISODate(addMonths(new Date(2026, 0, 15), -1))).toBe('2025-12-15')
    expect(toISODate(addMonths(new Date(2026, 0, 31), 1))).toBe('2026-02-28')
  })

  it('builds a complete Mon-first grid for the month', () => {
    const days = monthDays(new Date(2026, 8, 20)).map(toISODate)

    // Whole weeks only: Sep 1 2026 is a Tuesday, so the grid starts on Aug 31
    // and ends on Oct 4.
    expect(days.length % 7).toBe(0)
    expect(days[0]).toBe('2026-08-31')
    expect(days[days.length - 1]).toBe('2026-10-04')

    // Every day of the month appears exactly once.
    expect(new Set(days).size).toBe(days.length)
    expect(days).toContain('2026-09-01')
    expect(days).toContain('2026-09-30')
  })

  it('labels a month and compares months', () => {
    const label = formatMonthLabel(new Date(2026, 8, 1))
    expect(label).toContain('2026')
    expect(label.length).toBeGreaterThan('2026'.length)

    expect(isSameMonth(new Date(2026, 8, 1), new Date(2026, 8, 30))).toBe(true)
    expect(isSameMonth(new Date(2026, 8, 30), new Date(2026, 9, 1))).toBe(false)
  })
})

describe('resolveWeekStart', () => {
  it('resolves a ?week= param to the Monday of the week it belongs to', () => {
    expect(toISODate(resolveWeekStart('2026-09-16'))).toBe('2026-09-14')
    // Already a Monday stays put.
    expect(toISODate(resolveWeekStart('2026-09-14'))).toBe('2026-09-14')
  })

  it('falls back to the week containing the given day', () => {
    // 2026-09-20 is a Sunday, so its week starts on the 14th.
    expect(toISODate(resolveWeekStart(null, new Date(2026, 8, 20)))).toBe('2026-09-14')
    expect(toISODate(resolveWeekStart('not-a-date', new Date(2026, 8, 20)))).toBe('2026-09-14')
  })
})
