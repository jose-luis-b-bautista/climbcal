import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { RouteAnalytics } from './RouteAnalytics'

describe('<RouteAnalytics />', () => {
  it('renders nothing and lives off the router context alone', () => {
    // It reads the current route, so mounting it outside a Router would throw.
    // This renders it the way main.tsx does, which is what keeps that honest.
    const { container } = render(
      <MemoryRouter initialEntries={['/feed']}>
        <RouteAnalytics />
      </MemoryRouter>,
    )

    expect(container.innerHTML).toBe('')
  })
})
