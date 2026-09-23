import { describe, expect, it } from 'vitest'
import { groupByGym, indexByDate, uniqueClimbers } from './group'
import type { ClimbEntry, Profile } from '../types'

const stamp = '2026-09-01T00:00:00.000Z'

function climber(id: string, name: string, visibility: Profile['visibility'] = 'public'): Profile {
  return {
    id,
    username: id,
    display_name: name,
    visibility,
    created_at: stamp,
    updated_at: stamp,
  }
}

interface EntryOptions {
  date?: string
  /** `null` means the session has no clock time, only a slot. */
  start?: string | null
  /** Free-typed gym (slot 1). */
  gym?: string | null
  /** Free-typed gym (slot 2) — makes the session an "either". */
  gym2?: string | null
  /** Linked gym row (slot 1) instead of a typed name. */
  linkedGym?: string | null
  startSlot?: string | null
}

function entry(id: string, who: Profile, options: EntryOptions = {}): ClimbEntry {
  const linked = options.linkedGym ?? null
  return {
    id,
    user_id: who.id,
    climb_date: options.date ?? '2026-09-20',
    start_time: options.start === undefined ? '18:00:00' : options.start,
    end_time: '20:00:00',
    start_slot: options.startSlot ?? null,
    end_slot: null,
    gym_id: linked ? `gym-${linked}` : null,
    custom_gym_name: options.gym ?? null,
    gym_id_2: null,
    custom_gym_name_2: options.gym2 ?? null,
    note: null,
    created_at: stamp,
    updated_at: stamp,
    gym: linked ? { id: `gym-${linked}`, name: linked } : null,
    gym_2: null,
    climber: who,
  }
}

const luis = climber('u1', 'Luis')
const mara = climber('u2', 'Mara')
const nin = climber('u3', 'Nin')

describe('groupByGym', () => {
  const entries = [
    entry('a', luis, { gym: 'Boulder Space' }),
    entry('b', mara, { gym: 'BHive' }),
    entry('c', mara, { gym: 'BHive', start: '19:00:00' }),
    entry('d', nin, { gym: 'BHive', start: '07:00:00' }),
  ]

  it('groups by gym, busiest first, counting distinct climbers', () => {
    const groups = groupByGym(entries)

    expect(groups.map((group) => group.gymName)).toEqual(['BHive', 'Boulder Space'])

    // Mara has two sessions there, so the gym has three sessions but two climbers.
    const hive = groups[0]
    expect(hive.entries).toHaveLength(3)
    expect(hive.climberCount).toBe(2)

    // Sessions inside a group are ordered by start time.
    expect(hive.entries.map((row) => row.id)).toEqual(['d', 'b', 'c'])
    expect(groups[1].climberCount).toBe(1)
  })

  it('lists a two-gym session under both gyms', () => {
    const either = entry('either', mara, { gym: 'Boulder World', gym2: 'BHive' })
    const groups = groupByGym([either, entry('a', luis, { gym: 'Boulder Space' })])

    expect(groups.map((group) => group.gymName).sort()).toEqual([
      'BHive',
      'Boulder Space',
      'Boulder World',
    ])
    for (const name of ['BHive', 'Boulder World']) {
      const group = groups.find((candidate) => candidate.gymName === name)
      expect(group?.entries.map((row) => row.id)).toEqual(['either'])
    }
  })

  it('keeps sessions that named no gym in their own labelled bucket', () => {
    const groups = groupByGym([entry('none', luis, {})])
    expect(groups).toHaveLength(1)
    expect(groups[0].gymName).toBe('Not sure yet')
    expect(groups[0].entries.map((row) => row.id)).toEqual(['none'])
  })

  it('reads a linked gym row as the gym name', () => {
    const groups = groupByGym([entry('linked', luis, { linkedGym: 'Power Up TS' })])
    expect(groups[0].gymName).toBe('Power Up TS')
  })

  it('buckets everything under one gym when the feed is filtered to it', () => {
    const either = entry('either', mara, { gym: 'Boulder World', gym2: 'BHive' })
    const groups = groupByGym([either], { onlyGymName: 'BHive' })

    expect(groups).toHaveLength(1)
    expect(groups[0].gymName).toBe('BHive')
    expect(groups[0].entries.map((row) => row.id)).toEqual(['either'])
  })
})

describe('indexByDate', () => {
  it('keys by date ascending and sorts each day by start', () => {
    const byDate = indexByDate([
      entry('later', luis, { date: '2026-09-21', start: '18:00:00' }),
      entry('first', mara, { date: '2026-09-20', start: '07:00:00' }),
      entry('second', nin, { date: '2026-09-20', start: '19:00:00' }),
    ])

    expect([...byDate.keys()]).toEqual(['2026-09-20', '2026-09-21'])
    expect(byDate.get('2026-09-20')?.map((row) => row.id)).toEqual(['first', 'second'])
  })

  it('interleaves slot-based sessions with clock times', () => {
    const byDate = indexByDate([
      entry('evening', luis, { start: '19:00:00' }),
      entry('opening', mara, { start: null, startSlot: 'Opening' }),
    ])

    expect(byDate.get('2026-09-20')?.map((row) => row.id)).toEqual(['opening', 'evening'])
  })
})

describe('uniqueClimbers', () => {
  it('dedupes by climber, keeping first appearance order', () => {
    const climbers = uniqueClimbers([
      entry('a', mara, { gym: 'BHive' }),
      entry('b', luis, { gym: 'BHive' }),
      entry('c', mara, { gym: 'BHive', start: '19:00:00' }),
    ])

    expect(climbers.map((profile) => profile.id)).toEqual(['u2', 'u1'])
  })
})
