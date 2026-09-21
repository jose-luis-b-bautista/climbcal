/* oxlint-disable react/only-export-components, react-refresh/only-export-components */
// Shared design primitives: components plus the class tokens they use, kept
// together on purpose (this module is not a route/feature component).
import type { ReactNode, SelectHTMLAttributes } from 'react'
import { initialsOf } from '../lib/format'
import type { Profile } from '../types'

/** Tiny classname joiner (avoids pulling in clsx for a handful of cases). */
export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ')
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cx(
        'inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-emerald-400',
        className,
      )}
    />
  )
}

export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-20 text-sm text-zinc-400">
      <Spinner />
      {label}
    </div>
  )
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        'rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 shadow-sm shadow-black/20',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function SectionHeading({
  title,
  hint,
  action,
}: {
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">{title}</h2>
        {hint ? <p className="text-sm text-zinc-400">{hint}</p> : null}
      </div>
      {action}
    </div>
  )
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 px-4 py-8 text-center">
      <p className="text-sm font-medium text-zinc-300">{title}</p>
      {hint ? <p className="mt-1 text-sm text-zinc-500">{hint}</p> : null}
    </div>
  )
}

export function ErrorBanner({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3 rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">
      <span>{message}</span>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded px-1 text-red-300 hover:text-red-100"
          aria-label="Dismiss error"
        >
          ×
        </button>
      ) : null}
    </div>
  )
}

export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'success' }) {
  return (
    <div
      className={cx(
        'rounded-lg border px-3 py-2 text-sm',
        tone === 'success'
          ? 'border-emerald-900/60 bg-emerald-950/40 text-emerald-200'
          : 'border-sky-900/60 bg-sky-950/40 text-sky-200',
      )}
    >
      {children}
    </div>
  )
}

export function Avatar({ profile, size = 'md' }: { profile: Profile | null | undefined; size?: 'sm' | 'md' }) {
  const dimension = size === 'sm' ? 'h-7 w-7 text-[11px]' : 'h-9 w-9 text-xs'
  return (
    <span
      aria-hidden="true"
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-emerald-900/70 font-semibold text-emerald-100',
        dimension,
      )}
    >
      {initialsOf(profile)}
    </span>
  )
}

export function VisibilityBadge({ visibility }: { visibility: Profile['visibility'] }) {
  const isPublic = visibility === 'public'
  return (
    <span
      className={cx(
        'rounded-full border px-2 py-0.5 text-[11px] font-medium',
        isPublic
          ? 'border-emerald-800 bg-emerald-950/60 text-emerald-300'
          : 'border-zinc-700 bg-zinc-800/60 text-zinc-400',
      )}
    >
      {isPublic ? 'Public' : 'Private'}
    </span>
  )
}

/** Form field wrapper with a consistent label/input look. */
export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string
  htmlFor?: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block" htmlFor={htmlFor}>
      <span className="mb-1 block text-sm font-medium text-zinc-300">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-zinc-500">{hint}</span> : null}
    </label>
  )
}

export const inputClass =
  'w-full rounded-lg border border-zinc-700 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-900/50'

/** `<select>` flavour of {@link inputClass}: the browser arrow is turned off (it
 * sits hard against the right edge), so `Select` can place its own chevron. */
export const selectClass = cx(inputClass, 'appearance-none pr-9')

/**
 * Muted aside that only shows from `sm` up: on a phone the friend nudges and
 * per-day counts crowd the cards, so the small print is desktop-only.
 */
export const subTextClass = 'hidden text-xs text-zinc-500 sm:block'

/** Chevron for {@link Select}; `currentColor` keeps it in step with the theme. */
function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

/**
 * Dropdown with a consistently placed chevron. Props (`id`, `value`, `onChange`,
 * …) go straight to the `<select>`, so label association and tests are unchanged.
 */
export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select {...props} className={cx(selectClass, className)}>
        {children}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
    </div>
  )
}

export const primaryButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-60'

export const secondaryButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-600 disabled:cursor-not-allowed disabled:opacity-60'

export const dangerButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-red-900/70 bg-red-950/40 px-3 py-2 text-sm font-medium text-red-200 transition hover:bg-red-950/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-800 disabled:cursor-not-allowed disabled:opacity-60'

export const ghostButtonClass =
  'inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-600'
