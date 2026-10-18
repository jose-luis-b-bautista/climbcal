/* oxlint-disable react/only-export-components, react-refresh/only-export-components */
// Exports the pure SVG builder alongside the component so the theme palettes
// can be asserted without a canvas (see WeekSessionImage.test.ts).
import { useState } from 'react'
import type { ClimbEntry } from '../types'
import { gymNameOf } from '../lib/format'
import { formatTimeWindow, formatDuration, formatShortDate, DAY_NAMES } from '../lib/date'
import type { Theme } from '../hooks/useTheme'
import { primaryButtonClass } from './ui'

const CANVAS_WIDTH = 1080
const CANVAS_HEIGHT = 1920
const PADDING = 60
const HEADER_HEIGHT = 240
const CARD_HEIGHT = 190
const CARD_SPACING = 26
const DAY_LABEL_HEIGHT = 76

/**
 * The image mirrors the app's own token pairs (see src/index.css): in light mode
 * the page goes zinc-950 light and cards go white, in dark mode the reverse.
 */
interface Palette {
  page: string
  headerFrom: string
  headerTo: string
  headerText: string
  headerMuted: string
  divider: string
  dayBg: string
  dayBorder: string
  dayName: string
  dayDate: string
  cardBg: string
  cardBorder: string
  gym: string
  time: string
  meta: string
  footerBg: string
  footerBorder: string
  footerText: string
  footerMuted: string
}

const PALETTES: Record<Theme, Palette> = {
  dark: {
    page: '#09090b',
    headerFrom: '#14532d',
    headerTo: '#065f46',
    headerText: '#ffffff',
    headerMuted: '#a1a1aa',
    divider: '#27272a',
    dayBg: '#18181b',
    dayBorder: '#27272a',
    dayName: '#ffffff',
    dayDate: '#71717a',
    cardBg: '#18181b',
    cardBorder: '#10b981',
    gym: '#e4e4e7',
    time: '#10b981',
    meta: '#a1a1aa',
    footerBg: '#18181b',
    footerBorder: '#27272a',
    footerText: '#a1a1aa',
    footerMuted: '#71717a',
  },
  light: {
    page: '#fafafa',
    headerFrom: '#ecfdf5',
    headerTo: '#d1fae5',
    headerText: '#064e3b',
    headerMuted: '#047857',
    divider: '#e4e4e7',
    dayBg: '#ffffff',
    dayBorder: '#e4e4e7',
    dayName: '#18181b',
    dayDate: '#71717a',
    cardBg: '#ecfdf5',
    cardBorder: '#34d399',
    gym: '#18181b',
    time: '#065f46',
    meta: '#52525b',
    footerBg: '#ffffff',
    footerBorder: '#e4e4e7',
    footerText: '#52525b',
    footerMuted: '#71717a',
  },
}

/** Gym and profile names are free text - keep `&`/`<` from breaking the SVG. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function generateWeekSessionSVG(
  sessions: ClimbEntry[],
  weekTitle: string,
  displayName: string,
  theme: Theme,
): string {
  const palette = PALETTES[theme]
  const pathData: string[] = []
  const content: string[] = []

  // Background
  pathData.push(`<rect width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" fill="${palette.page}" />`)

  // Header gradient
  pathData.push(`<defs><linearGradient id="headerGradient" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:${palette.headerFrom};stop-opacity:1" /><stop offset="100%" style="stop-color:${palette.headerTo};stop-opacity:1" /></linearGradient></defs>`)

  // Header block
  pathData.push(`<rect x="0" y="0" width="${CANVAS_WIDTH}" height="${HEADER_HEIGHT}" fill="url(#headerGradient)" />`)
  pathData.push(`<text x="${PADDING}" y="98" font-family="system-ui, -apple-system, sans-serif" font-size="52" font-weight="bold" fill="${palette.headerText}">${escapeXml(displayName)}'s Week</text>`)
  pathData.push(`<text x="${PADDING}" y="154" font-family="system-ui, -apple-system, sans-serif" font-size="32" fill="${palette.headerMuted}">${escapeXml(weekTitle)}</text>`)

  // Group sessions by day
  const byDay = new Map<string, ClimbEntry[]>()
  sessions.forEach((session) => {
    const dayKey = session.climb_date
    const existing = byDay.get(dayKey) ?? []
    existing.push(session)
    byDay.set(dayKey, existing)
  })

  // Lay the days out from 0 so the block can be measured before it is scaled.
  const dayBlocks = [...byDay.keys()]
    .sort()
    .map((dayKey) => ({ dayKey, entries: byDay.get(dayKey) ?? [] }))

  const naturalHeight = dayBlocks.reduce(
    (total, block) => total + DAY_LABEL_HEIGHT + 24 + block.entries.length * (CARD_HEIGHT + CARD_SPACING) + 20,
    0,
  )

  const contentTop = HEADER_HEIGHT + 40
  const availableHeight = CANVAS_HEIGHT - 140 - contentTop
  // Shrink only when a busy week would otherwise overflow; otherwise spread the
  // leftover height evenly above, between and below the day groups.
  const scale = Math.min(1, availableHeight / Math.max(naturalHeight, 1))
  const gapCount = dayBlocks.length + 1
  const breathingRoom = scale === 1 ? Math.max(0, (availableHeight - naturalHeight) / gapCount) : 0

  let y = breathingRoom

  dayBlocks.forEach(({ dayKey, entries }) => {
    const dayDate = new Date(dayKey + 'T00:00:00')
    const dayName = DAY_NAMES[dayDate.getDay() === 0 ? 6 : dayDate.getDay() - 1]
    const dateLabel = formatShortDate(dayDate)

    // Day label strip
    content.push(`<rect x="${PADDING}" y="${y}" width="${CANVAS_WIDTH - PADDING * 2}" height="${DAY_LABEL_HEIGHT}" rx="16" fill="${palette.dayBg}" stroke="${palette.dayBorder}" stroke-width="2" />`)
    content.push(`<text x="${PADDING + 28}" y="${y + 38}" font-family="system-ui, -apple-system, sans-serif" font-size="30" font-weight="bold" fill="${palette.dayName}">${dayName}</text>`)
    content.push(`<text x="${PADDING + 28}" y="${y + 66}" font-family="system-ui, -apple-system, sans-serif" font-size="22" fill="${palette.dayDate}">${dateLabel}</text>`)
    y += DAY_LABEL_HEIGHT + 24

    // One card per climb - only the climb itself, nothing else.
    entries.forEach((session) => {
      const cardWidth = CANVAS_WIDTH - PADDING * 2
      const cardX = PADDING
      const cardY = y

      content.push(`<rect x="${cardX}" y="${cardY}" width="${cardWidth}" height="${CARD_HEIGHT}" rx="16" fill="${palette.cardBg}" stroke="${palette.cardBorder}" stroke-width="2" />`)

      // Gym name
      const gymName = gymNameOf(session)
      content.push(`<text x="${cardX + 40}" y="${cardY + 62}" font-family="system-ui, -apple-system, sans-serif" font-size="36" font-weight="bold" fill="${palette.gym}">${escapeXml(gymName)}</text>`)

      // Time window
      const timeWindow = formatTimeWindow(session.start_time, session.end_time, session.start_slot, session.end_slot)
      content.push(`<text x="${cardX + 40}" y="${cardY + 110}" font-family="system-ui, -apple-system, sans-serif" font-size="30" font-weight="bold" fill="${palette.time}">${timeWindow}</text>`)

      if (session.start_time && session.end_time) {
        const duration = formatDuration(session.start_time, session.end_time)
        content.push(`<text x="${cardX + 40}" y="${cardY + 146}" font-family="system-ui, -apple-system, sans-serif" font-size="22" fill="${palette.meta}">${duration}</text>`)
      }

      if (session.note) {
        const noteText = session.note.length > 40 ? session.note.substring(0, 37) + '...' : session.note
        content.push(`<text x="${cardX + 40}" y="${cardY + 174}" font-family="system-ui, -apple-system, sans-serif" font-size="20" fill="${palette.meta}">${escapeXml(noteText)}</text>`)
      }

      y += CARD_HEIGHT + CARD_SPACING
    })

    y += 20 + breathingRoom
  })

  const offsetX = (CANVAS_WIDTH - CANVAS_WIDTH * scale) / 2
  pathData.push(`<g transform="translate(${offsetX} ${contentTop}) scale(${scale})">${content.join('')}</g>`)

  // Footer
  pathData.push(`<rect x="0" y="${CANVAS_HEIGHT - 100}" width="${CANVAS_WIDTH}" height="100" fill="${palette.footerBg}" />`)
  pathData.push(`<line x1="0" y1="${CANVAS_HEIGHT - 100}" x2="${CANVAS_WIDTH}" y2="${CANVAS_HEIGHT - 100}" stroke="${palette.footerBorder}" stroke-width="2" />`)
  pathData.push(`<text x="${PADDING}" y="${CANVAS_HEIGHT - 60}" font-family="system-ui, -apple-system, sans-serif" font-size="24" fill="${palette.footerText}">climbcal.app • Share your weekly climbs</text>`)

  return `<svg width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}" xmlns="http://www.w3.org/2000/svg">${pathData.join('')}</svg>`
}

export interface WeekSessionImageProps {
  sessions: ClimbEntry[]
  weekTitle: string
  displayName: string
  userId: string
  /** Mirrors the app theme so the shared image matches what the user sees. */
  theme: Theme
}

/** A generated image plus the theme it was drawn for. */
interface GeneratedImage {
  svg: string
  /** Null when the canvas is unavailable and only the SVG fallback can be saved. */
  blob: Blob | null
  theme: Theme
}

function svgToPngBlob(svgString: string, background: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // Probe the canvas first: jsdom (and browsers with canvas disabled) return
    // no context, so the caller can fall back to the SVG immediately.
    const canvas = document.createElement('canvas')
    canvas.width = CANVAS_WIDTH
    canvas.height = CANVAS_HEIGHT
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      reject(new Error('Could not create canvas context'))
      return
    }

    const img = new Image()
    img.crossOrigin = 'anonymous'
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)

    img.onload = () => {
      ctx.fillStyle = background
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
      ctx.drawImage(img, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
      URL.revokeObjectURL(url)
      canvas.toBlob((blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Canvas toBlob returned null'))
      }, 'image/png')
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load SVG image'))
    }

    img.src = url
  })
}

function copyImageToClipboard(blob: Blob): Promise<boolean> {
  try {
    void navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    return Promise.resolve(true)
  } catch {
    return Promise.resolve(false)
  }
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}


export function WeekSessionImage({
  sessions,
  weekTitle,
  displayName,
  userId,
  theme,
}: WeekSessionImageProps) {
  const [image, setImage] = useState<GeneratedImage | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [actionStatus, setActionStatus] = useState<'idle' | 'saved' | 'copied' | 'failed'>('idle')

  // Filter to only the current user's sessions
  const ownSessions = sessions.filter((s) => s.user_id === userId)

  // The blob remembers the theme it was drawn for, so toggling the theme simply
  // hides the stale options and the next click regenerates on the new palette.
  const currentImage = image?.theme === theme ? image : null

  const generateAndPresentOptions = async () => {
    setIsGenerating(true)
    setActionStatus('idle')
    setImage(null)

    try {
      const svg = generateWeekSessionSVG(ownSessions, weekTitle, displayName, theme)
      let blob: Blob | null = null
      try {
        blob = await svgToPngBlob(svg, PALETTES[theme].page)
      } catch {
        // Canvas can be unavailable (e.g. jsdom); fall back to the SVG file.
        blob = null
      }
      setImage({ svg, blob, theme })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSaveImage = () => {
    if (!currentImage) {
      setActionStatus('failed')
      return
    }
    if (currentImage.blob) {
      downloadBlob(currentImage.blob, 'week-session.png')
    } else {
      downloadBlob(new Blob([currentImage.svg], { type: 'image/svg+xml' }), 'week-session.svg')
    }
    setActionStatus('saved')
  }

  const handleCopyImage = async () => {
    if (!currentImage?.blob) {
      setActionStatus('failed')
      return
    }
    const success = await copyImageToClipboard(currentImage.blob)
    setActionStatus(success ? 'copied' : 'failed')
  }

  if (ownSessions.length === 0) {
    return null
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={generateAndPresentOptions}
        disabled={isGenerating}
        className={primaryButtonClass}
      >
        {isGenerating ? 'Generating...' : 'Share Week'}
      </button>

      {currentImage ? (
        <div className="flex flex-col gap-2">
          {currentImage.blob ? (
            <>
              <button
                type="button"
                onClick={handleSaveImage}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-sm transition-colors"
              >
                Save Image
              </button>
              <button
                type="button"
                onClick={handleCopyImage}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg font-medium text-sm transition-colors"
              >
                Copy Image
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleSaveImage}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-sm transition-colors"
            >
              Save SVG
            </button>
          )}
        </div>
      ) : null}

      {actionStatus === 'saved' ? (
        <p className="text-xs text-emerald-300">Saved to your device.</p>
      ) : null}

      {actionStatus === 'copied' ? (
        <p className="text-xs text-emerald-300">Copied to clipboard — paste into Instagram Stories.</p>
      ) : null}
    </div>
  )
}

export default WeekSessionImage
