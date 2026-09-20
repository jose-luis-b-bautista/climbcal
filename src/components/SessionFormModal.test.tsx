/**
 * The session dialog is where gyms get picked, so the dropdown has to stay
 * separated by island region — with an "Other" group that carries the free-text
 * option, so a one-off gym is always reachable.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OTHER_REGION_LABEL } from '../lib/format'
import type { Climb, Gym } from '../types'
import { SessionFormModal } from './SessionFormModal'

// Records the row the dialog would write, so the time/slot split is assertable.
const { insertSpy } = vi.hoisted(() => ({ insertSpy: vi.fn() }))

beforeEach(() => {
  insertSpy.mockClear()
})

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      insert: async (values: unknown) => {
        insertSpy(values)
        return { error: null }
      },
      update: () => ({ eq: async () => ({ error: null }) }),
      delete: () => ({ eq: async () => ({ error: null }) }),
    }),
  },
}))

const timestamp = '2026-09-01T10:00:00.000Z'

function makeGym(name: string, region: string | null = null): Gym {
  return {
    id: name,
    name,
    city: null,
    region,
    created_by: null,
    created_at: timestamp,
  }
}

const regionalGyms = [
  makeGym('Boulder Space', 'Luzon'),
  makeGym('Boulder24', 'Mindanao'),
  makeGym('Hotel Wall', null),
]

/** An existing session stored as a flexible window instead of clock times. */
const slotClimb: Climb = {
  id: 'climb-slot',
  user_id: '11111111-1111-1111-1111-111111111111',
  climb_date: '2026-09-16',
  start_time: null,
  end_time: null,
  start_slot: 'Before Dinner',
  end_slot: 'Closing',
  gym_id: 'Boulder Space',
  custom_gym_name: null,
  note: null,
  created_at: timestamp,
  updated_at: timestamp,
}

function renderModal(gyms: Gym[] = regionalGyms) {
  return render(
    <SessionFormModal
      userId="11111111-1111-1111-1111-111111111111"
      gyms={gyms}
      defaultDate="2026-09-16"
      onClose={() => undefined}
      onSaved={() => undefined}
    />,
  )
}

function gymSelect() {
  return screen.getByLabelText('Gym')
}

function optgroupLabels(select: HTMLElement) {
  return [...select.querySelectorAll('optgroup')].map((group) => group.getAttribute('label'))
}

function otherGroup(select: HTMLElement) {
  return select.querySelector(`optgroup[label="${OTHER_REGION_LABEL}"]`) as HTMLElement
}

describe('<SessionFormModal />', () => {
  it('separates the gym dropdown by region and keeps an Other escape hatch', () => {
    renderModal()

    const select = gymSelect()
    expect(optgroupLabels(select)).toEqual(['Luzon', 'Mindanao', OTHER_REGION_LABEL])
    expect(within(select).getByRole('option', { name: 'Boulder Space' })).toBeTruthy()
    expect(within(select).getByRole('option', { name: 'Boulder24' })).toBeTruthy()

    // Untagged gyms and the free-text option share the Other group.
    expect(within(otherGroup(select)).getByRole('option', { name: 'Hotel Wall' })).toBeTruthy()
    expect(
      within(otherGroup(select)).getByRole('option', { name: 'Other (type it in)' }),
    ).toBeTruthy()
  })

  it('still offers the Other group when every gym has a region', () => {
    renderModal(regionalGyms.filter((gym) => gym.region))

    const select = gymSelect()
    expect(optgroupLabels(select)).toEqual(['Luzon', 'Mindanao', OTHER_REGION_LABEL])
    expect(
      within(otherGroup(select)).getByRole('option', { name: 'Other (type it in)' }),
    ).toBeTruthy()
  })

  it('falls back to a single Other group when the gym list is empty', () => {
    renderModal([])

    expect(optgroupLabels(gymSelect())).toEqual([OTHER_REGION_LABEL])
  })

  it('reveals the free-text gym name field when Other is picked', () => {
    renderModal()

    const select = gymSelect()
    expect(screen.queryByLabelText(/Gym name/)).toBeNull()

    const otherOption = within(select).getByRole('option', {
      name: 'Other (type it in)',
    }) as HTMLOptionElement
    fireEvent.change(select, { target: { value: otherOption.value } })

    expect(screen.getByLabelText(/Gym name/)).toBeTruthy()
  })

  it('records a flexible window as slot labels with no clock times', async () => {
    renderModal()

    fireEvent.change(screen.getByLabelText('From'), { target: { value: 'Opening' } })
    fireEvent.change(screen.getByLabelText('To'), { target: { value: 'Before Lunch' } })

    // Both ends are slots, so neither clock input is on screen.
    expect(screen.queryByLabelText('From time')).toBeNull()
    expect(screen.queryByLabelText('To time')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Add session' }))

    await waitFor(() => expect(insertSpy).toHaveBeenCalledTimes(1))
    expect(insertSpy.mock.calls[0][0]).toMatchObject({
      start_time: null,
      end_time: null,
      start_slot: 'Opening',
      end_slot: 'Before Lunch',
    })
  })

  it('rejects a slot window that ends before it starts', async () => {
    renderModal()

    fireEvent.change(screen.getByLabelText('From'), { target: { value: 'After Dinner' } })
    fireEvent.change(screen.getByLabelText('To'), { target: { value: 'Opening' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add session' }))

    expect(await screen.findByText('The end has to come after the start.')).toBeTruthy()
    expect(insertSpy).not.toHaveBeenCalled()
  })

  it('mixes an exact start with a slot end', async () => {
    renderModal()

    fireEvent.change(screen.getByLabelText('To'), { target: { value: 'Closing' } })
    expect(screen.getByLabelText('From time')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Add session' }))

    await waitFor(() => expect(insertSpy).toHaveBeenCalledTimes(1))
    expect(insertSpy.mock.calls[0][0]).toMatchObject({
      start_time: '18:00',
      end_time: null,
      start_slot: null,
      end_slot: 'Closing',
    })
  })

  it('brings the clock input back when Exact time is picked again', () => {
    renderModal()

    fireEvent.change(screen.getByLabelText('From'), { target: { value: 'Opening' } })
    expect(screen.queryByLabelText('From time')).toBeNull()

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '__exact__' } })
    expect(screen.getByLabelText('From time')).toBeTruthy()
  })

  it('restores a stored slot window when editing', () => {
    render(
      <SessionFormModal
        userId="11111111-1111-1111-1111-111111111111"
        gyms={regionalGyms}
        defaultDate="2026-09-16"
        initial={slotClimb}
        onClose={() => undefined}
        onSaved={() => undefined}
        onDeleted={() => undefined}
      />,
    )

    expect((screen.getByLabelText('From') as HTMLSelectElement).value).toBe('Before Dinner')
    expect((screen.getByLabelText('To') as HTMLSelectElement).value).toBe('Closing')
    expect(screen.queryByLabelText('From time')).toBeNull()
  })
})
