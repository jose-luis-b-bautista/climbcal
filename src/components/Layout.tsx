import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useFriends } from '../hooks/useFriends'
import { ThemeToggle } from './ThemeToggle'
import { Avatar, cx, ghostButtonClass } from './ui'

const NAV_ITEMS = [
  { to: '/week', label: 'Week' },
  { to: '/friends', label: 'Friends' },
  { to: '/feed', label: 'Feed' },
  { to: '/stats', label: 'Stats' },
  { to: '/settings', label: 'Settings' },
]

/** App shell for every signed-in page. */
export function Layout() {
  const { profile, signOut } = useAuth()
  const { incoming } = useFriends()
  const pendingCount = incoming.length

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-6xl flex-col px-4 pb-12 pt-5 sm:px-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xl" aria-hidden="true">
            🧗
          </span>
          <span className="text-lg font-semibold tracking-tight text-zinc-100">climbcal
            <span className="text-xs font-semibold tracking-tight text-zinc-100"> (alpha)</span>
          </span>
        </div>

        <nav className="order-3 flex w-full items-center gap-1 sm:order-2 sm:w-auto">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cx(
                  'relative rounded-lg px-3 py-1.5 text-sm font-medium transition',
                  isActive
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200',
                )
              }
            >
              {item.label}
              {item.to === '/friends' && pendingCount > 0 ? (
                <span className="ml-1.5 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {pendingCount}
                </span>
              ) : null}
            </NavLink>
          ))}
        </nav>

        <div className="order-2 flex items-center gap-2 sm:order-3">
          <ThemeToggle />
          <Avatar profile={profile} size="sm" />
          <span className="hidden text-sm text-zinc-300 sm:inline">
            {profile?.username ? `@${profile.username}` : 'climber'}
          </span>
          <button type="button" className={ghostButtonClass} onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
