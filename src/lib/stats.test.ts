/**
 * The stats page's non-React half: the heatmap grid and its month blocks, the
 * gyms behind each day, the heat levels, and the gym breakdown's ordering and
 * scaling.
 *
 * Dates are fixed literals rather than "now", so the 13-week window is asserted
 * exactly. 2026-09-16 is a Wednesday, so the current column (Mon 14 – Sun 20)
 * still contains days that are "planned" - the window always ends with the week
 * holding today, which is why a Sunday pin would show nothing ahead.
 */
import { describe, expect, it } from 'vitest'
import type { ClimberDailyActivityRow, ClimberGymStatsRow } from '../types'
import {
  HEAT_LEVEL_CLASSES,
  HEATMAP_WEEKS,
  activityByDate,
  buildHeatmap,
  favouriteWeekday,
  groupHeatmapByMonth,
  gymShare,
  gymsByDate,
  heatLevel,
  heatmapStartDate,
  namedSessions,
  nextPlannedDay,
  rankGymStats,
  sessionsByRegion,
  weekStreak,
  type DayGymRow,
  type HeatmapWeek,
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

/** A `climb_gyms` row, narrowed to the columns the heatmap's hover uses. */
function dayGymRow(gym_name: string, climb_date = '2026-09-16'): DayGymRow {
  return { user_id: 'me', climb_date, gym_name }
}

/**
 * A grid ending with today's week (Mon 14 Sep) - five columns by default - with
 * one session on each given date. Anything after today comes back as planned,
 * which is exactly what the rhythm helpers have to ignore.
 */
function gridWith(dates: string[], weeks = 5): HeatmapWeek[] {
  const rows = dates.map((climb_date) => activityRow({ climb_date }))
  return buildHeatmap(today, activityByDate(rows), weeks)
}

describe('heatLevel', () => {
  it('is binary: any sessions at all is the one shaded state', () => {
    // Two sessions in one day are rare, so the grid answers "did I climb that
    // day?" - the exact count lives in the day's label, not in the shade.
    expect([0, 1, 2, 5, 9].map(heatLevel)).toEqual([0, 1, 1, 1, 1])
    expect(heatLevel(-1)).toBe(0)
  })

  it('has a distinct class per state, so shaded never looks empty', () => {
    expect(HEAT_LEVEL_CLASSES).toHaveLength(2)
    expect(new Set(HEAT_LEVEL_CLASSES).size).toBe(2)
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

  it('ends with the current week and starts 13 weeks earlier', () => {
    expect(heatmapStartDate(today)).toBe('2026-06-22')
    expect(weeks).toHaveLength(13)
    expect(weeks[0].weekStart).toBe('2026-06-22')
    expect(weeks[weeks.length - 1].weekStart).toBe('2026-09-14')
    // Every column is a Monday-first week of seven days.
    expect(weeks.every((week) => week.days.length === 7)).toBe(true)
    expect(weeks[0].days[0].date).toBe('2026-06-22')
    expect(weeks[weeks.length - 1].days[6].date).toBe('2026-09-20')
  })

  it('carries each day’s counts and flags days after today as planned', () => {
    const last = weeks[weeks.length - 1]
    const day = (date: string) => last.days.find((entry) => entry.date === date)

    expect(day('2026-09-16')).toEqual({
      date: '2026-09-16',
      sessions: 2,
      exactMinutes: 60,
      gyms: [],
      planned: false,
    })
    // Today itself is never "planned"; yesterday and tomorrow straddle the line.
    expect(day('2026-09-16')?.planned).toBe(false)
    expect(day('2026-09-15')?.planned).toBe(false)
    expect(day('2026-09-17')).toEqual({
      date: '2026-09-17',
      sessions: 0,
      exactMinutes: 0,
      gyms: [],
      planned: true,
    })
    // A plan already posted for Saturday still counts, and is still "planned".
    expect(day('2026-09-19')).toEqual({
      date: '2026-09-19',
      sessions: 1,
      exactMinutes: 60,
      gyms: [],
      planned: true,
    })
  })

  it('honours a shorter window', () => {
    const short = buildHeatmap(today, new Map(), 2)
    expect(short.map((week) => week.weekStart)).toEqual(['2026-09-07', '2026-09-14'])
  })

  it('attaches the gyms that belong to each day, and to no other', () => {
    const withGyms = buildHeatmap(today, map, HEATMAP_WEEKS, gymsByDate([
      dayGymRow('BHive', '2026-09-16'),
      dayGymRow('Boulder Space', '2026-09-16'),
      dayGymRow('BHive', '2026-09-19'),
    ]))
    const days = withGyms.flatMap((week) => week.days)
    const byDate = (date: string) => days.find((day) => day.date === date)

    expect(byDate('2026-09-16')?.gyms).toEqual(['BHive', 'Boulder Space'])
    // A planned day names its gym too - that is the whole point of the outline.
    expect(byDate('2026-09-19')?.gyms).toEqual(['BHive'])
    expect(byDate('2026-09-15')?.gyms).toEqual([])
  })
})

describe('gymsByDate', () => {
  it('keeps one entry per gym, sorted, so the label never shuffles', () => {
    const map = gymsByDate([
      // Two sessions at the same gym on one day arrive as two rows.
      dayGymRow('Boulder Space', '2026-09-16'),
      dayGymRow('BHive', '2026-09-16'),
      dayGymRow('BHive', '2026-09-16'),
      dayGymRow('Not sure yet', '2026-09-09'),
      dayGymRow('Edge Climb', '2026-09-09'),
    ])

    expect(map.get('2026-09-16')).toEqual(['BHive', 'Boulder Space'])
    // The unnamed bucket is a label like any other here - the breakdown keeps it,
    // so the tooltip does not silently claim a gym you never named.
    expect(map.get('2026-09-09')).toEqual(['Edge Climb', 'Not sure yet'])
    expect(map.get('2026-09-15')).toBeUndefined()
  })

  it('is empty for no rows at all', () => {
    expect(gymsByDate([]).size).toBe(0)
  })
})

describe('groupHeatmapByMonth', () => {
  const months = groupHeatmapByMonth(buildHeatmap(today, new Map()))

  it('splits the 13 columns at month boundaries, in order', () => {
    // Jun 22 – Sep 20: two June columns, four July, five August (Aug 31 included),
    // two September.
    expect(months.map((month) => month.month)).toEqual([
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
    ])
    expect(months.map((month) => month.label)).toEqual(['Jun', 'Jul', 'Aug', 'Sep'])
    expect(months.map((month) => month.weeks.length)).toEqual([2, 4, 5, 2])
  })

  it('keeps every column whole and in order, with no gaps or repeats', () => {
    const weekStarts = months.flatMap((month) => month.weeks.map((week) => week.weekStart))
    expect(weekStarts).toHaveLength(13)
    expect(new Set(weekStarts).size).toBe(13)
    expect(weekStarts[0]).toBe('2026-06-22')
    expect(weekStarts[weekStarts.length - 1]).toBe('2026-09-14')
    // A column belongs to the month its Monday is in, even when its days spill
    // over: Aug 31 – Sep 6 is still an August column.
    const august = months[2]
    expect(august.weeks[august.weeks.length - 1].weekStart).toBe('2026-08-31')
    expect(august.weeks[august.weeks.length - 1].days[6].date).toBe('2026-09-06')
  })

  it('emits nothing for an empty grid', () => {
    expect(groupHeatmapByMonth([])).toEqual([])
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

describe('weekStreak', () => {
  it('counts weeks in a row, not days, and only what has happened', () => {
    // Sep 14 (this week), Sep 7, Aug 31 - three weeks running.
    expect(weekStreak(gridWith(['2026-09-14', '2026-09-07', '2026-08-31']))).toEqual({
      current: 3,
      best: 3,
    })
    // A plan on Saturday is not a climb yet: it neither extends the streak nor
    // breaks it, so last week's session is still the latest one.
    expect(weekStreak(gridWith(['2026-09-07', '2026-09-19'])).current).toBe(1)
  })

  it('keeps a streak alive through a quiet current week', () => {
    // It is Wednesday, not Sunday - a week with nothing posted yet is not a gap.
    expect(weekStreak(gridWith(['2026-09-07', '2026-08-31']))).toEqual({ current: 2, best: 2 })
  })

  it('reports the longest run separately from the current one', () => {
    // Aug 17 + Aug 24 ran for two, a gap followed, then only last week.
    expect(weekStreak(gridWith(['2026-08-17', '2026-08-24', '2026-09-07']))).toEqual({
      current: 1,
      best: 2,
    })
  })

  it('is zero for a lapsed or empty history', () => {
    // Aug 17 is three weeks back, so the streak is over - but it still happened.
    expect(weekStreak(gridWith(['2026-08-17']))).toEqual({ current: 0, best: 1 })
    expect(weekStreak(gridWith([]))).toEqual({ current: 0, best: 0 })
    expect(weekStreak([])).toEqual({ current: 0, best: 0 })
  })
})

describe('favouriteWeekday', () => {
  it('tallies sessions per weekday and leaves plans out', () => {
    // Tue 15th, Wed 16th, Wed 9th … and a plan for Sat 19th that must not count.
    expect(
      favouriteWeekday(gridWith(['2026-09-15', '2026-09-16', '2026-09-09', '2026-09-19'])),
    ).toEqual({ isoDow: 3, sessions: 2, total: 3 })
  })

  it('counts sessions, so two on one day weigh twice', () => {
    const weeks = buildHeatmap(
      today,
      activityByDate([
        activityRow({ climb_date: '2026-09-16', sessions: 3 }),
        activityRow({ climb_date: '2026-09-15', sessions: 2 }),
      ]),
      5,
    )

    expect(favouriteWeekday(weeks)).toEqual({ isoDow: 3, sessions: 3, total: 5 })
  })

  it('breaks a tie towards the earlier day of the week', () => {
    // Mon 14th and Fri 11th, one session each.
    expect(favouriteWeekday(gridWith(['2026-09-14', '2026-09-11']))).toEqual({
      isoDow: 1,
      sessions: 1,
      total: 2,
    })
  })

  it('reports nothing when only plans exist', () => {
    expect(favouriteWeekday(gridWith(['2026-09-19']))).toEqual({
      isoDow: null,
      sessions: 0,
      total: 0,
    })
    expect(favouriteWeekday([])).toEqual({ isoDow: null, sessions: 0, total: 0 })
  })
})

describe('sessionsByRegion', () => {
  it('sums per region, biggest first, with the Other bucket last', () => {
    expect(
      sessionsByRegion([
        gymRow({ gym_name: 'BHive', region: 'Luzon', sessions: 3 }),
        gymRow({ gym_name: 'Boulder Space', region: 'Luzon', sessions: 2 }),
        gymRow({ gym_name: 'Block Point', region: 'Visayas', sessions: 4 }),
        // Four sessions, more than any region, but it is not a place.
        gymRow({ gym_name: 'Not sure yet', region: 'Other', is_named_gym: false, sessions: 6 }),
      ]),
    ).toEqual([
      { region: 'Luzon', sessions: 5 },
      { region: 'Visayas', sessions: 4 },
      { region: 'Other', sessions: 6 },
    ])
  })

  it('is empty without rows', () => {
    expect(sessionsByRegion([])).toEqual([])
  })
})

describe('nextPlannedDay', () => {
  it('finds the soonest day still to come, ignoring what has happened', () => {
    const weeks = buildHeatmap(
      today,
      activityByDate([
        activityRow({ climb_date: '2026-09-16' }),
        activityRow({ climb_date: '2026-09-19' }),
        activityRow({ climb_date: '2026-09-17' }),
      ]),
      5,
    )

    expect(nextPlannedDay(weeks)?.date).toBe('2026-09-17')
  })

  it('is null when nothing is planned, or there is no grid', () => {
    const past = buildHeatmap(today, activityByDate([activityRow({ climb_date: '2026-09-16' })]))

    expect(nextPlannedDay(past)).toBeNull()
    expect(nextPlannedDay([])).toBeNull()
  })
})
