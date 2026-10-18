/* oxlint-disable react/only-export-components, react-refresh/only-export-components */
// Exports the pure SVG builder alongside the component so the theme palettes
// can be asserted without a canvas (see WeekSessionImage.test.ts).
import { useState } from 'react'
import type { ClimbEntry } from '../types'
import { gymNameOf } from '../lib/format'
import { formatTimeWindow, formatDuration, formatShortDate, DAY_NAMES } from '../lib/date'
import type { Theme } from '../hooks/useTheme'
import { primaryButtonClass, secondaryButtonClass } from './ui'

const CANVAS_WIDTH = 1080
const CANVAS_HEIGHT = 1920
const PADDING = 60
const FONT_FAMILY = 'system-ui, -apple-system, sans-serif'

/**
 * Instagram Stories draws its own chrome over the canvas: the profile row and
 * close button on top, the reply bar and reactions on the bottom. Both bands
 * are roughly 250px tall at this resolution, so the header text and everything
 * else that must stay readable live inside the middle of the canvas.
 */
const TOP_SAFE_INSET = 250
const BOTTOM_SAFE_INSET = 250

const HEADER_TEXT_TOP = 88 // title baseline below the top safe inset
const HEADER_TEXT_GAP = 52 // title -> week range baseline
const HEADER_BOTTOM_PADDING = 48 // week range -> header block edge
const HEADER_HEIGHT = TOP_SAFE_INSET + HEADER_TEXT_TOP + HEADER_TEXT_GAP + HEADER_BOTTOM_PADDING
const HEADER_CONTENT_GAP = 64 // header block -> first day strip

const CARD_HEIGHT = 190
const CARD_SPACING = 26
const DAY_LABEL_HEIGHT = 76
const DAY_BLOCK_GAP = 24

const FOOTER_HEIGHT = 72
const FOOTER_GAP = 20 // footer -> bottom safe inset
const CONTENT_FOOTER_GAP = 32 // content -> footer
const MAX_DAY_GAP = 72 // cap on the spread between day groups

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

const SVG_NS = 'http://www.w3.org/2000/svg'

/**
 * Build SVG nodes through the DOM instead of pasting strings together.
 * Attributes and text go through the browser's own serializer, so free text
 * such as gym names or display names can contain `&`, `<` or quotes without
 * breaking the document - no manual escaping required.
 */
function svgNode(
  tag: string,
  attributes: Record<string, string | number> = {},
  text?: string,
): SVGElement {
  const element = document.createElementNS(SVG_NS, tag) as SVGElement
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, String(value))
  }
  if (text !== undefined) element.textContent = text
  return element
}

export function generateWeekSessionSVG(
  sessions: ClimbEntry[],
  weekTitle: string,
  displayName: string,
  theme: Theme,
): string {
  const palette = PALETTES[theme]
  const root = svgNode('svg', {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    viewBox: `0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`,
  })

  // No background rect: the page stays transparent so the image can be pasted
  // over any photo in Instagram Stories.

  // Header gradient
  const gradient = svgNode('linearGradient', {
    id: 'headerGradient',
    x1: '0%',
    y1: '0%',
    x2: '0%',
    y2: '100%',
  })
  gradient.append(
    svgNode('stop', { offset: '0%', style: `stop-color:${palette.headerFrom};stop-opacity:1` }),
    svgNode('stop', { offset: '100%', style: `stop-color:${palette.headerTo};stop-opacity:1` }),
  )
  const defs = svgNode('defs')
  defs.appendChild(gradient)
  root.appendChild(defs)

  // Header block. The gradient runs to the top edge for a full-bleed look, but
  // the text baselines start below the top safe inset so Instagram's profile
  // row cannot cover them.
  root.appendChild(
    svgNode('rect', {
      x: 0,
      y: 0,
      width: CANVAS_WIDTH,
      height: HEADER_HEIGHT,
      fill: 'url(#headerGradient)',
    }),
  )
  root.appendChild(
    svgNode(
      'text',
      {
        x: PADDING,
        y: TOP_SAFE_INSET + HEADER_TEXT_TOP,
        'font-family': FONT_FAMILY,
        'font-size': 52,
        'font-weight': 'bold',
        fill: palette.headerText,
      },
      `${displayName}'s Week`,
    ),
  )
  root.appendChild(
    svgNode(
      'text',
      {
        x: PADDING,
        y: TOP_SAFE_INSET + HEADER_TEXT_TOP + HEADER_TEXT_GAP,
        'font-family': FONT_FAMILY,
        'font-size': 32,
        fill: palette.headerMuted,
      },
      weekTitle,
    ),
  )

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
    (total, block) =>
      total +
      DAY_LABEL_HEIGHT +
      DAY_BLOCK_GAP +
      block.entries.length * (CARD_HEIGHT + CARD_SPACING) +
      DAY_BLOCK_GAP,
    0,
  )

  const contentTop = HEADER_HEIGHT + HEADER_CONTENT_GAP
  const footerTop = CANVAS_HEIGHT - BOTTOM_SAFE_INSET - FOOTER_GAP - FOOTER_HEIGHT
  const availableHeight = footerTop - CONTENT_FOOTER_GAP - contentTop
  // Shrink only when a busy week would otherwise overflow. Content is anchored
  // right below the header - leftover height is shared between the day groups
  // (capped) instead of pushing the first group halfway down the canvas.
  const scale = Math.min(1, availableHeight / Math.max(naturalHeight, 1))
  const gapCount = Math.max(1, dayBlocks.length)
  const breathingRoom =
    scale === 1
      ? Math.min(MAX_DAY_GAP, Math.max(0, (availableHeight - naturalHeight) / gapCount))
      : 0
  const contentGroup = svgNode('g')

  let y = 0

  dayBlocks.forEach(({ dayKey, entries }) => {
    const dayDate = new Date(dayKey + 'T00:00:00')
    const dayName = DAY_NAMES[dayDate.getDay() === 0 ? 6 : dayDate.getDay() - 1]
    const dateLabel = formatShortDate(dayDate)

    // Day label strip
    contentGroup.appendChild(
      svgNode('rect', {
        x: PADDING,
        y,
        width: CANVAS_WIDTH - PADDING * 2,
        height: DAY_LABEL_HEIGHT,
        rx: 16,
        fill: palette.dayBg,
        stroke: palette.dayBorder,
        'stroke-width': 2,
      }),
    )
    contentGroup.appendChild(
      svgNode(
        'text',
        {
          x: PADDING + 28,
          y: y + 38,
          'font-family': FONT_FAMILY,
          'font-size': 30,
          'font-weight': 'bold',
          fill: palette.dayName,
        },
        dayName,
      ),
    )
    contentGroup.appendChild(
      svgNode(
        'text',
        {
          x: PADDING + 28,
          y: y + 66,
          'font-family': FONT_FAMILY,
          'font-size': 22,
          fill: palette.dayDate,
        },
        dateLabel,
      ),
    )
    y += DAY_LABEL_HEIGHT + DAY_BLOCK_GAP

    // One card per climb - only the climb itself, nothing else.
    entries.forEach((session) => {
      const cardWidth = CANVAS_WIDTH - PADDING * 2
      const cardX = PADDING
      const cardY = y

      contentGroup.appendChild(
        svgNode('rect', {
          x: cardX,
          y: cardY,
          width: cardWidth,
          height: CARD_HEIGHT,
          rx: 16,
          fill: palette.cardBg,
          stroke: palette.cardBorder,
          'stroke-width': 2,
        }),
      )

      // Gym name
      const gymName = gymNameOf(session)
      contentGroup.appendChild(
        svgNode(
          'text',
          {
            x: cardX + 40,
            y: cardY + 62,
            'font-family': FONT_FAMILY,
            'font-size': 36,
            'font-weight': 'bold',
            fill: palette.gym,
          },
          gymName,
        ),
      )

      // Time window
      const timeWindow = formatTimeWindow(session.start_time, session.end_time, session.start_slot, session.end_slot)
      contentGroup.appendChild(
        svgNode(
          'text',
          {
            x: cardX + 40,
            y: cardY + 110,
            'font-family': FONT_FAMILY,
            'font-size': 30,
            'font-weight': 'bold',
            fill: palette.time,
          },
          timeWindow,
        ),
      )

      if (session.start_time && session.end_time) {
        const duration = formatDuration(session.start_time, session.end_time)
        contentGroup.appendChild(
          svgNode(
            'text',
            {
              x: cardX + 40,
              y: cardY + 146,
              'font-family': FONT_FAMILY,
              'font-size': 22,
              fill: palette.meta,
            },
            duration,
          ),
        )
      }

      if (session.note) {
        const noteText = session.note.length > 40 ? session.note.substring(0, 37) + '...' : session.note
        contentGroup.appendChild(
          svgNode(
            'text',
            {
              x: cardX + 40,
              y: cardY + 174,
              'font-family': FONT_FAMILY,
              'font-size': 20,
              fill: palette.meta,
            },
            noteText,
          ),
        )
      }

      y += CARD_HEIGHT + CARD_SPACING
    })

    y += DAY_BLOCK_GAP + breathingRoom
  })

  const offsetX = (CANVAS_WIDTH - CANVAS_WIDTH * scale) / 2
  contentGroup.setAttribute('transform', `translate(${offsetX} ${contentTop}) scale(${scale})`)
  root.appendChild(contentGroup)

  // Footer sits above the bottom safe inset so Instagram's reply bar cannot
  // cover it.
  root.appendChild(
    svgNode('rect', {
      x: 0,
      y: footerTop,
      width: CANVAS_WIDTH,
      height: FOOTER_HEIGHT,
      fill: palette.footerBg,
    }),
  )
  root.appendChild(
    svgNode('line', {
      x1: 0,
      y1: footerTop,
      x2: CANVAS_WIDTH,
      y2: footerTop,
      stroke: palette.footerBorder,
      'stroke-width': 2,
    }),
  )
  root.appendChild(
    svgNode(
      'text',
      {
        x: PADDING,
        y: footerTop + FOOTER_HEIGHT / 2 + 8,
        'font-family': FONT_FAMILY,
        'font-size': 24,
        fill: palette.footerText,
      },
      'climbcal.app • Share your weekly climbs',
    ),
  )

  return new XMLSerializer().serializeToString(root)
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
  /** Opaque PNG for saving/sharing; null when the canvas is unavailable. */
  blob: Blob | null
  /** Transparent PNG for pasting over a story photo; null when unavailable. */
  transparentBlob: Blob | null
  theme: Theme
}

/**
 * Rasterize the SVG at story resolution. Passing a background keeps the PNG
 * opaque for saving/sharing; omitting it preserves the alpha channel so the
 * clipboard copy can be pasted over any story photo.
 */
function svgToPngBlob(svgString: string, background?: string): Promise<Blob> {
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
      if (background) {
        ctx.fillStyle = background
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
      }
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

function canCopyImage(): boolean {
  return typeof ClipboardItem !== 'undefined' && typeof navigator.clipboard?.write === 'function'
}

function copyImageToClipboard(blob: Blob): Promise<boolean> {
  if (!canCopyImage()) return Promise.resolve(false)
  try {
    void navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    return Promise.resolve(true)
  } catch {
    return Promise.resolve(false)
  }
}

/**
 * iOS never lets a web page write to the Photos library directly. The only route
 * into Photos is the system share sheet ("Save Image"), so prefer it whenever
 * the browser can share files and keep the download as the desktop fallback.
 */
function pngFile(blob: Blob): File {
  return new File([blob], 'climbcal-week.png', { type: 'image/png' })
}

function canShareImage(blob: Blob): boolean {
  if (typeof navigator.canShare !== 'function' || typeof navigator.share !== 'function') return false
  try {
    return navigator.canShare({ files: [pngFile(blob)] })
  } catch {
    return false
  }
}

/** iOS/iPadOS: the only OS where the share sheet is the route into Photos. */
function isAppleMobile(): boolean {
  const userAgent = navigator.userAgent
  // iPadOS 13+ reports a desktop Mac UA, so the touch check keeps iPads in.
  return /iPad|iPhone|iPod/.test(userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

type ShareResult = 'shared' | 'cancelled' | 'unsupported'

async function shareImage(blob: Blob): Promise<ShareResult> {
  const file = pngFile(blob)
  if (!canShareImage(blob)) return 'unsupported'
  try {
    // Must stay inside the click handler: Safari drops the user gesture otherwise.
    await navigator.share({ files: [file], title: 'My climbing week' })
    return 'shared'
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return 'cancelled'
    return 'unsupported'
  }
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Safari aborts a download when its blob URL is revoked in the same tick.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
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
  const [actionStatus, setActionStatus] = useState<'idle' | 'saved' | 'shared' | 'copied' | 'failed'>(
    'idle',
  )

  // Filter to only the current user's sessions
  const ownSessions = sessions.filter((s) => s.user_id === userId)

  // The blob remembers the theme it was drawn for, so toggling the theme simply
  // hides the stale options and the next click regenerates on the new palette.
  const currentImage = image?.theme === theme ? image : null
  const canShare = currentImage?.blob ? canShareImage(currentImage.blob) : false
  // On iOS the share sheet is the only way into the Photos app, so it leads there.
  const shareFirst = canShare && isAppleMobile()

  const generateAndPresentOptions = async () => {
    setIsGenerating(true)
    setActionStatus('idle')
    setImage(null)

    try {
      const svg = generateWeekSessionSVG(ownSessions, weekTitle, displayName, theme)
      let blob: Blob | null = null
      let transparentBlob: Blob | null = null
      try {
        const pngs = await Promise.all([
          svgToPngBlob(svg, PALETTES[theme].page),
          svgToPngBlob(svg),
        ])
        blob = pngs[0]
        transparentBlob = pngs[1]
      } catch {
        // Canvas can be unavailable (e.g. jsdom); fall back to the SVG file.
        blob = null
        transparentBlob = null
      }

      setImage({ svg, blob, transparentBlob, theme })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleShareImage = async () => {
    if (!currentImage?.blob) {
      setActionStatus('failed')
      return
    }
    const result = await shareImage(currentImage.blob)
    if (result === 'shared') setActionStatus('shared')
    else if (result === 'cancelled') setActionStatus('idle')
    else setActionStatus('failed')
  }

  const handleSaveImage = () => {
    if (!currentImage) {
      setActionStatus('failed')
      return
    }
    if (currentImage.blob) {
      downloadBlob(currentImage.blob, 'climbcal-week.png')
    } else {
      downloadBlob(new Blob([currentImage.svg], { type: 'image/svg+xml' }), 'climbcal-week.svg')
    }
    setActionStatus('saved')
  }

  const handleCopyImage = async () => {
    if (!currentImage?.transparentBlob) {
      setActionStatus('failed')
      return
    }
    const success = await copyImageToClipboard(currentImage.transparentBlob)
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
              {shareFirst ? (
                <button type="button" onClick={handleShareImage} className={primaryButtonClass}>
                  Save to Photos
                </button>
              ) : null}
              <button
                type="button"
                onClick={handleSaveImage}
                className={shareFirst ? secondaryButtonClass : primaryButtonClass}
              >
                {shareFirst ? 'Download file' : 'Save Image'}
              </button>
              {canShare && !shareFirst ? (
                <button type="button" onClick={handleShareImage} className={secondaryButtonClass}>
                  Share…
                </button>
              ) : null}
              {canCopyImage() ? (
                <button type="button" onClick={handleCopyImage} className={secondaryButtonClass}>
                  Copy Image
                </button>
              ) : null}
            </>
          ) : (
            <button type="button" onClick={handleSaveImage} className={primaryButtonClass}>
              Save SVG
            </button>
          )}
        </div>
      ) : null}

      {shareFirst ? (
        <p className="text-xs text-zinc-400">
          Safari cannot write to the Photos app on its own. Use “Save to Photos”, then choose “Save
          Image” in the share sheet.
        </p>
      ) : null}

      {actionStatus === 'shared' ? (
        <p className="text-xs text-emerald-300">
          Choose “Save Image” in the share sheet to add it to Photos.
        </p>
      ) : null}

      {actionStatus === 'copied' ? (
        <p className="text-xs text-emerald-300">
          Copied with a transparent background - paste it over any photo in Instagram Stories.
        </p>
      ) : null}

      {actionStatus === 'failed' ? (
        <p className="text-xs text-red-300">
          That did not work. Try the save or copy option again.
        </p>
      ) : null}
    </div>
  )
}

export default WeekSessionImage
