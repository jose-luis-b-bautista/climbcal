/**
 * Comment threads: a session's comments and a climber's wall.
 *
 * One component for both - the two threads differ only in wording, so the layout
 * (and the mobile behaviour) is written once. The thread is deliberately flat:
 * comments are a hairline list, not a stack of cards, and the composer is a soft
 * field, so a thread inside a session card does not read as boxes within boxes.
 *
 * Sizing: the toggle is a 40px row on a phone, the Post button 40px there and
 * compact on a mouse, and the textarea is 13px - `index.css` still forces 16px on
 * touch pointers, which is what stops iOS zooming when it is focused.
 *
 * The thread is **collapsed by default** and only queries when opened, so a page
 * with thirty session cards still makes one comments request per opened card
 * instead of thirty. The parent's batched count seeds the badge and is kept in
 * step locally after a post or a delete.
 */
import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react'
import { COMMENT_MAX_LENGTH, useComments, type CommentKind } from '../hooks/useComments'
import { formatRelativeTime } from '../lib/date'
import { displayNameOf } from '../lib/format'
import type { CommentEntry } from '../types'
import {
  Avatar,
  ErrorBanner,
  Notice,
  cx,
} from './ui'

/** The migration this feature needs; the file name matches `supabase/migrations/`. */
export const COMMENTS_MIGRATION = '20261110000000_comments.sql'

/** Speech bubble, drawn inline so the toggle needs no icon dependency. */
function CommentIcon({ className }: { className?: string }) {
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
      <path d="M21 12a8 8 0 0 1-8 8H8l-5 3v-5.5A8 8 0 0 1 11 5h2a8 8 0 0 1 8 7Z" />
    </svg>
  )
}

interface CommentThreadProps {
  kind: CommentKind
  /** The session, or the climber whose wall this is. */
  targetId: string
  /** Owner of the session / wall - may delete any comment on it. */
  ownerId: string
  viewerId: string | null
  /** Count from the page's batched query; kept in step after posting/deleting. */
  count?: number
  /** Wall pages open straight into the thread - that is why you went there. */
  defaultOpen?: boolean
  label?: string
  placeholder?: string
  emptyHint?: string
  /** False on a wall the viewer may not write to (private, not a friend). */
  canComment?: boolean
  /**
   * `inline` grows the thread under the toggle; `sheet` opens it in a dialog
   * (bottom sheet on phones, centred card on desktop). The week grid's columns
   * are ~150px wide, so its cards use `sheet` - a thread written inline there
   * would squeeze the composer and stretch the column.
   */
  display?: 'inline' | 'sheet'
  /**
   * Extra control rendered on the toggle's row, after the toggle and before the
   * panel - the session card puts its Edit button here, so both actions stay
   * left-aligned while the opened panel still spans the whole card.
   */
  action?: ReactNode
}

/** One comment: who, when, what - with a two-tap delete for the allowed people. */
function CommentItem({
  comment,
  canDelete,
  confirming,
  busy,
  onAskDelete,
  onDelete,
}: {
  comment: CommentEntry
  canDelete: boolean
  confirming: boolean
  busy: boolean
  onAskDelete: () => void
  onDelete: () => void
}) {
  const name = displayNameOf(comment.author)

  return (
    <li className="flex min-w-0 gap-2.5 py-2 first:pt-0 last:pb-0">
      <Avatar profile={comment.author} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="truncate text-xs font-medium text-zinc-200">{name}</span>
          <time dateTime={comment.created_at} className="text-[11px] text-zinc-500">
            {formatRelativeTime(comment.created_at)}
          </time>
          {canDelete ? (
            <button
              type="button"
              onClick={confirming ? onDelete : onAskDelete}
              disabled={busy}
              // Two taps: a stray thumb on a phone must not delete a message.
              className={cx(
                'ml-auto min-h-8 shrink-0 rounded-md px-1.5 text-[11px] font-medium transition disabled:opacity-50',
                confirming
                  ? 'bg-red-950/60 text-red-200 hover:bg-red-950'
                  : 'text-zinc-500 hover:text-red-300',
              )}
              aria-label={
                confirming ? `Confirm delete comment by ${name}` : `Delete comment by ${name}`
              }
            >
              {busy ? 'Deleting…' : confirming ? 'Delete?' : 'Delete'}
            </button>
          ) : null}
        </div>
        <p className="mt-0.5 text-[13px] leading-relaxed break-words whitespace-pre-wrap text-zinc-300">
          {comment.body}
        </p>
      </div>
    </li>
  )
}

/**
 * The thread in a dialog shell, for narrow hosts (the week grid's columns are
 * ~150px wide). Same shape as the session dialog: bottom sheet on a phone,
 * centred card from `sm` up, dismissed by ×, the backdrop or Escape.
 */
function CommentSheet({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const titleId = useId()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
      // The backdrop dismisses; the sheet stops the click from reaching it.
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[85svh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-zinc-800 bg-zinc-900 p-4 shadow-xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-base font-semibold text-zinc-100">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 text-xl leading-none text-zinc-400 hover:text-zinc-100"
            aria-label="Close comments"
            autoFocus
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** The thread itself: toggle, list, composer - shared by sessions and walls. */
function CommentThread({
  kind,
  targetId,
  ownerId,
  viewerId,
  count = 0,
  defaultOpen = false,
  label = 'Comments',
  placeholder,
  emptyHint,
  canComment = true,
  display = 'inline',
  action,
}: CommentThreadProps) {
  const [open, setOpen] = useState(defaultOpen)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  // Delete is a two-tap action, so the id waiting for confirmation is tracked.
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  // Comments posted or deleted here, on top of the page's batched count. Derived
  // in render, so a new count from a reload simply wins.
  const [delta, setDelta] = useState(0)
  const localCount = Math.max(0, count + delta)
  const panelId = useId()
  const inputId = useId()

  // Nothing is requested until the thread is opened: a collapsed card is free.
  const { comments, loading, error, missingTable, post, remove } = useComments({
    kind,
    targetId,
    enabled: open,
  })

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const body = draft.trim()
    if (!body || busy) return

    setBusy(true)
    setActionError(null)
    try {
      await post(body)
      setDraft('')
      setDelta((current) => current + 1)
    } catch (failure) {
      setActionError(
        failure instanceof Error ? failure.message : 'Could not post that comment.',
      )
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    setActionError(null)
    try {
      await remove(id)
      setConfirmingId(null)
      setDelta((current) => current - 1)
    } catch (failure) {
      setActionError(
        failure instanceof Error ? failure.message : 'Could not delete that comment.',
      )
    } finally {
      setDeletingId(null)
    }
  }

  // The toggle adapts to the space it is given: `sheet` mode keeps it to the
  // icon and count (the week grid's cards are ~150px wide, where a word plus a
  // badge would widen the column), `inline` mode spells the label out.
  const toggle = (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={display === 'inline' ? panelId : undefined}
      aria-label={localCount > 0 ? `${label} (${localCount})` : label}
      title={display === 'sheet' ? label : undefined}
      onClick={() => setOpen((current) => !current)}
      className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-2 text-xs font-medium whitespace-nowrap text-zinc-400 transition hover:bg-zinc-800/60 hover:text-zinc-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-600 sm:min-h-9"
    >
      <CommentIcon className="h-4 w-4 shrink-0" />
      <span className={display === 'sheet' ? 'sr-only' : undefined}>{label}</span>
      {localCount > 0 ? (
        <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[11px] leading-none text-zinc-300">
          {localCount}
        </span>
      ) : null}
    </button>
  )

  const panelContent = (
    <>
      {missingTable ? (
        <Notice>
          Comments are not in the database yet. Run{' '}
          <code className="break-all">supabase/migrations/{COMMENTS_MIGRATION}</code> - with the
          CLI that is{' '}
          <code className="break-all">npx supabase@latest db push --include-all --remote</code> -
          then refresh.
        </Notice>
      ) : null}

      {error && !missingTable ? <ErrorBanner message={error} /> : null}

      {loading ? (
        <p className="text-xs text-zinc-500">Loading…</p>
      ) : !missingTable && comments.length === 0 ? (
        <p className="text-xs text-zinc-500">{emptyHint}</p>
      ) : null}

      {comments.length > 0 ? (
        // Capped and scrollable so a busy thread cannot push the week away on
        // a phone; `overscroll-contain` stops the page scrolling with it.
        <ul className="max-h-64 divide-y divide-zinc-800/50 overflow-y-auto overscroll-contain pr-0.5 sm:max-h-80">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              canDelete={
                Boolean(viewerId) && (viewerId === comment.user_id || viewerId === ownerId)
              }
              confirming={confirmingId === comment.id}
              busy={deletingId === comment.id}
              onAskDelete={() => setConfirmingId(comment.id)}
              onDelete={() => void handleDelete(comment.id)}
            />
          ))}
        </ul>
      ) : null}

      {actionError ? (
        <ErrorBanner message={actionError} onDismiss={() => setActionError(null)} />
      ) : null}

      {canComment ? (
        <form
          onSubmit={handleSubmit}
          className="flex items-end gap-2 border-t border-zinc-800/50 pt-2"
        >
          <div className="min-w-0 flex-1">
            <label className="sr-only" htmlFor={inputId}>
              {label}
            </label>
            <textarea
              id={inputId}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={2}
              maxLength={COMMENT_MAX_LENGTH}
              placeholder={placeholder}
              className="w-full resize-none rounded-md bg-zinc-950/50 px-2 py-1.5 text-[13px] leading-snug text-zinc-100 outline-none placeholder:text-zinc-500 focus:ring-1 focus:ring-emerald-600"
            />
            {draft.length > 0 ? (
              <p className="mt-0.5 text-right text-[10px] text-zinc-500">
                {draft.length}/{COMMENT_MAX_LENGTH}
              </p>
            ) : null}
          </div>
          <button
            type="submit"
            disabled={busy || draft.trim().length === 0}
            className="min-h-10 shrink-0 rounded-md bg-emerald-600 px-2.5 text-xs font-semibold text-white transition hover:bg-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-0 sm:py-1.5"
          >
            {busy ? 'Posting…' : 'Post'}
          </button>
        </form>
      ) : (
        <p className="text-xs text-zinc-500">
          Only this climber and their friends can leave a note.
        </p>
      )}
    </>
  )

  // Comments first, then the host's extra action (Edit), both flush left. The
  // `-ml-2` cancels the toggle's own padding so its label lines up with the card
  // text above; the panel below is a sibling, never a flex item, so it always
  // spans the card.
  const actionsRow = (
    <div className="-ml-2 flex flex-wrap items-center gap-2">
      {toggle}
      {action}
    </div>
  )

  if (display === 'sheet') {
    return (
      <>
        {actionsRow}
        {open ? (
          <CommentSheet title={label} onClose={() => setOpen(false)}>
            <div id={panelId} className="space-y-2">
              {panelContent}
            </div>
          </CommentSheet>
        ) : null}
      </>
    )
  }

  return (
    <>
      {actionsRow}
      <div id={panelId} hidden={!open} className="mt-2 w-full min-w-0 space-y-2">
        {panelContent}
      </div>
    </>
  )
}

/** Comments on one session (the week cards and the feed rows). */
export function SessionComments({
  climbId,
  ownerId,
  viewerId,
  count,
  defaultOpen = false,
  display = 'inline',
  action,
}: {
  climbId: string
  ownerId: string
  viewerId: string
  count?: number
  defaultOpen?: boolean
  /** `sheet` for narrow hosts (the week grid); `inline` everywhere else. */
  display?: 'inline' | 'sheet'
  /** Sits right after the toggle on the same left-aligned row (the Edit button). */
  action?: ReactNode
}) {
  return (
    <CommentThread
      kind="climb"
      targetId={climbId}
      ownerId={ownerId}
      viewerId={viewerId}
      count={count}
      defaultOpen={defaultOpen}
      display={display}
      action={action}
      label="Comments"
      placeholder="Place comment here…"
      emptyHint="No comments yet - say hi."
    />
  )
}

/**
 * Notes on a climber's wall (`/wall/<id>`). Opens immediately: the wall page
 * exists for this thread, so hiding it behind a tap would be backwards.
 */
export function WallComments({
  profileId,
  viewerId,
  canComment = true,
  defaultOpen = true,
}: {
  profileId: string
  viewerId: string
  canComment?: boolean
  defaultOpen?: boolean
}) {
  return (
    <CommentThread
      kind="profile"
      targetId={profileId}
      ownerId={profileId}
      viewerId={viewerId}
      defaultOpen={defaultOpen}
      label="Notes"
      placeholder="Leave a note for this climber…"
      emptyHint="No notes yet - be the first."
      canComment={canComment}
    />
  )
}
