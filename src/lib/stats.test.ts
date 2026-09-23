/**
 * The stats page's non-React half: the heatmap grid, the heat levels, and the gym
 * breakdown's ordering and scaling.
 *
 * Dates are fixed literals rather than "now", so the 26-week window is asserted
 * exactly. 2026-09-16 is a Wednesday, so the current column (Mon 14 – Sun 20)
 * still contains days that are "planned" — the window always ends with the week
 * holding today, which is why a Sunday pin would show nothing ahead.
 */
import { describe, expect, it } from 'vitest'
import type { ClimberDailyActivityRow, ClimberGymStatsRow } from '../types'
import {
  HEAT_LEVEL_CLASSES,
  activityByDate,
  buildHeatmap,
  gymShare,
  heatLevel,
  heatmapStartDate,
  namedSessions,
  rankGymStats,
} from './stats'

const today = new Date(2026, 8, 16) // Wednesday 16 September 2026, local midnight.

function activityRow(overrides: Partial<ClimberDailyActivityRow>): ClimberDailyActivityRow {
  return {
    user_id: 'me',
    climb_date: '2026-09-16',
    week_start: '2026-09-14',
    iso_dow: 3,
    sessions: 1,
    exact_sessions: 1,
    duration_minutes: 60,
    exact_minutes: 60,
    notes: 0,
    ...overrides,
  }
}

function gymRow(overrides: Partial<ClimberGymStatsRow>): ClimberGymStatsRow {
  return {
    user_id: 'me',
    gym_name: 'BHive',
    region: 'Luzon',
    is_named_gym: true,
    sessions: 1,
    days: 1,
    first_visit: '2026-09-09',
    last_visit: '2026-09-09',
    duration_minutes: 60,
    exact_minutes: 60,
    ...overrides,
  }
}

describe('heatLevel', () => {
  it('steps 0…4 with the session count, saturating at four', () => {
    expect([0, 1, 2, 3, 4, 9].map(heatLevel)).toEqual([0, 1, 2, 3, 4, 4])
    expect(heatLevel(-1)).toBe(0)
  })

  it('has one distinct class per level, so two levels never look alike', () => {
    // The light theme collapses several emerald shades onto each other, which is
    // why the ramp is 900 → 600; a repeated class would make levels invisible.
    expect(HEAT_LEVEL_CLASSES).toHaveLength(5)
    expect(new Set(HEAT_LEVEL_CLASSES).size).toBe(5)
  })
})

describe('activityByDate', () => {
  it('sums rows that land on the same day', () => {
    const map = activityByDate([
      activityRow({ climb_date: '2026-09-16', sessions: 2, exact_minutes: 60 }),
      activityRow({ climb_date: '2026-09-16', sessions: 1, exact_minutes: 30 }),
      activityRow({ climb_date: '2026-09-09', sessions: 1, exact_minutes: 120 }),
    ])

    expect(map.get('2026-09-16')).toEqual({ sessions: 3, exactMinutes: 90 })
    expect(map.get('2026-09-09')).toEqual({ sessions: 1, exactMinutes: 120 })
    expect(map.get('2026-09-15')).toBeUndefined()
  })
})

describe('buildHeatmap', () => {
  const map = activityByDate([
    activityRow({ climb_date: '2026-09-16', sessions: 2, exact_minutes: 60 }),
    activityRow({ climb_date: '2026-09-19', sessions: 1, exact_minutes: 60 }),
  ])
  const weeks = buildHeatmap(today, map)

  it('ends with the current week and starts 26 weeks earlier', () => {
    expect(heatmapStartDate(today)).toBe('2026-03-23')
    expect(weeks).toHaveLength(26)
    expect(weeks[0].weekStart).toBe('2026-03-23')
    expect(weeks[weeks.length - 1].weekStart).toBe('2026-09-14')
    // Every column is a Monday-first week of seven days.
    expect(weeks.every((week) => week.days.length === 7)).toBe(true)
    expect(weeks[0].days[0].date).toBe('2026-03-23')
    expect(weeks[weeks.length - 1].days[6].date).toBe('2026-09-20')
  })

  it('carries each day’s counts and flags days after today as planned', () => {
    const last = weeks[weeks.length - 1]
    const day = (date: string) => last.days.find((entry) => entry.date === date)

    expect(day('2026-09-16')).toEqual({
      date: '2026-09-16',
      sessions: 2,
      exactMinutes: 60,
      planned: false,
    })
    // Today itself is never "planned"; yesterday and tomorrow straddle the line.
    expect(day('2026-09-16')?.planned).toBe(false)
    expect(day('2026-09-15')?.planned).toBe(false)
    expect(day('2026-09-17')).toEqual({
      date: '2026-09-17',
      sessions: 0,
      exactMinutes: 0,
      planned: true,
    })
    // A plan already posted for Saturday still counts, and is still "planned".
    expect(day('2026-09-19')).toEqual({
      date: '2026-09-19',
      sessions: 1,
      exactMinutes: 60,
      planned: true,
    })
  })

  it('honours a shorter window', () => {
    const short = buildHeatmap(today, new Map(), 2)
    expect(short.map((week) => week.weekStart)).toEqual(['2026-09-07', '2026-09-14'])
  })
})

describe('rankGymStats', () => {
  it('sorts named gyms by sessions, alphabetically on a tie, unnamed last', () => {
    const ranked = rankGymStats([
      gymRow({ gym_name: 'Not sure yet', is_named_gym: false, sessions: 9, region: 'Other' }),
      gymRow({ gym_name: 'Boulder Space', sessions: 2 }),
      gymRow({ gym_name: 'BHive', sessions: 3 }),
      gymRow({ gym_name: 'Edge Climb', sessions: 2 }),
    ])

    expect(ranked.map((row) => row.gym_name)).toEqual([
      'BHive',
      'Boulder Space',
      'Edge Climb',
      'Not sure yet',
    ])
  })

  it('does not mutate the rows it was given', () => {
    const rows = [gymRow({ gym_name: 'Boulder Space', sessions: 1 }), gymRow({ sessions: 2 })]
    rankGymStats(rows)
    expect(rows.map((row) => row.gym_name)).toEqual(['Boulder Space', 'BHive'])
  })
})

describe('gymShare', () => {
  it('scales to the busiest bar and refuses to overflow or vanish', () => {
    expect(gymShare(4, 4)).toBe(100)
    expect(gymShare(3, 4)).toBe(75)
    expect(gymShare(1, 4)).toBe(25)
    expect(gymShare(9, 4)).toBe(100)
    expect(gymShare(1, 1000)).toBe(4)
    expect(gymShare(0, 4)).toBe(0)
    expect(gymShare(1, 0)).toBe(0)
  })
})

describe('namedSessions', () => {
  it('counts gyms only, ignoring the unnamed bucket', () => {
    expect(
      namedSessions([
        gymRow({ sessions: 3 }),
        gymRow({ gym_name: 'Not sure yet', is_named_gym: false, sessions: 4 }),
      ]),
    ).toBe(3)
  })
})
