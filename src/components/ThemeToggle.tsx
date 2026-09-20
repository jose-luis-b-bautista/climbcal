import { useTheme } from '../hooks/useTheme'
import { cx, ghostButtonClass } from './ui'

/**
 * Light/dark switch. Rendered in the app header and on the auth screens, so a
 * visitor can pick a theme before signing in.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme()
  const nextTheme = theme === 'dark' ? 'light' : 'dark'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cx(ghostButtonClass, className)}
      aria-label={`Switch to ${nextTheme} mode`}
      title={`Switch to ${nextTheme} mode`}
      data-theme={theme}
    >
      <span aria-hidden="true">{theme === 'dark' ? '☀️' : '🌙'}</span>
      <span className="hidden sm:inline">{nextTheme === 'dark' ? 'Dark' : 'Light'}</span>
    </button>
  )
}