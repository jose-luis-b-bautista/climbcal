import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { THEME_STORAGE_KEY, ThemeProvider } from '../hooks/useTheme'
import { ThemeToggle } from './ThemeToggle'

function renderToggle() {
  return render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  )
}

function isDark() {
  return document.documentElement.classList.contains('dark')
}

describe('<ThemeToggle />', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.classList.remove('dark')
  })

  it('honours a saved preference on first render', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light')
    renderToggle()
    expect(isDark()).toBe(false)
    expect(screen.getByRole('button', { name: 'Switch to dark mode' })).toBeTruthy()

    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    renderToggle()
    expect(isDark()).toBe(true)
    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toBeTruthy()
  })

  it('flips the document class and stores the new choice when clicked', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    renderToggle()
    expect(isDark()).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Switch to light mode' }))

    expect(isDark()).toBe(false)
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')

    fireEvent.click(screen.getByRole('button', { name: 'Switch to dark mode' }))

    expect(isDark()).toBe(true)
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  })

  it('keeps the browser chrome colour in step with the theme', () => {
    const meta = document.createElement('meta')
    meta.setAttribute('name', 'theme-color')
    meta.setAttribute('content', '#09090b')
    document.head.append(meta)

    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    renderToggle()
    expect(meta.getAttribute('content')).toBe('#09090b')

    fireEvent.click(screen.getByRole('button', { name: 'Switch to light mode' }))
    expect(meta.getAttribute('content')).toBe('#fafafa')

    meta.remove()
  })
})