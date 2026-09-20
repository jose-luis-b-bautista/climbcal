/**
 * The session dialog is where gyms get picked, so the dropdown has to stay
 * separated by island region — with an "Other" group that carries the free-text
 * option, so a one-off gym is always reachable.
 */
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { OTHER_REGION_LABEL } from '../lib/format'
import type { Gym } from '../types'
import { SessionFormModal } from './SessionFormModal'

vi.mock('../lib/supabase', () => ({ supabase: {} }))

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
})
