import { describe, expect, it } from 'vitest'
import {
  addDays,
  addWeeks,
  compareClimbsByTime,
  formatDuration,
  formatTimeWindow,
  formatWeekRange,
  isToday,
  parseISODate,
  startOfWeek,
  toISODate,
  trimTime,
  weekDays,
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
})

describe('isToday', () => {
  it('accepts both strings and dates', () => {
    const today = new Date()
    expect(isToday(today)).toBe(true)
    expect(isToday(toISODate(today))).toBe(true)
    expect(isToday(addDays(today, 1))).toBe(false)
  })
})
