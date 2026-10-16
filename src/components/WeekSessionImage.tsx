import type { ClimbEntry } from '../types'
import { displayNameOf, gymNameOf } from '../lib/format'
import { formatTimeWindow, formatDuration } from '../lib/date'
import { ShareLink } from './ShareLink'

/**
 * Instagram Story dimensions: 1080x1920 (9:16 aspect ratio)
 */
const CANVAS_WIDTH = 1080
const CANVAS_HEIGHT = 1920

/**
 * Default padding for the Instagram Story content
 */
const PADDING = 40

/**
 * Header height for title, date, and avatar
 */
const HEADER_HEIGHT = 200

/**
 * Card height for each session
 */
const CARD_HEIGHT = 180

/**
 * Card spacing
 */
const CARD_SPACING = 30

/**
 * Share link path for the generated image
 */
const IMAGE_SHARE_PATH = '/api/share-image/week'

export interface WeekSessionImageProps {
  /** Weekly session data to display */
  sessions: ClimbEntry[]
  /** The week title to display */
  weekTitle: string
  /** The display name of the climber */
  displayName: string
}

/**
 * Generates an Instagram Story-sized image of the weekly climbing session
 */
function generateWeekSessionSVG(
  sessions: ClimbEntry[],
  weekTitle: string,
  displayName: string,
): string {
  const maxSessionsPerRow = 2
  const availableWidth = CANVAS_WIDTH - PADDING * 2
  const cardWidth = (availableWidth - CARD_SPACING * (maxSessionsPerRow - 1)) / maxSessionsPerRow
  
  let y = HEADER_HEIGHT + PADDING
  
  const pathData: string[] = []
  
  // Header with title and avatar
  pathData.push(`<defs>
    <linearGradient id="headerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#14532d;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#065f46;stop-opacity:1" />
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="2" dy="2" stdDeviation="4" flood-opacity="0.3" />
    </filter>
  </defs>`)
  
  pathData.push(`<rect width="${CANVAS_WIDTH}" height="${HEADER_HEIGHT}" fill="url(#headerGradient)" />`)
  pathData.push(`<text x="30" y="60" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="bold" fill="white">${displayName}'s Week</text>`)
  pathData.push(`<text x="30" y="95" font-family="system-ui, -apple-system, sans-serif" font-size="16" fill="#d1fae5">${weekTitle}</text>`)
  pathData.push(`<circle cx="${CANVAS_WIDTH - 40}" cy="60" r="30" fill="#10b981" stroke="white" stroke-width="3" />`)
  pathData.push(`<text x="${CANVAS_WIDTH - 40}" y="75" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="bold" fill="white" text-anchor="middle">🧗</text>`)
  
  // Scroll indicator
  pathData.push(`<rect x="${CANVAS_WIDTH / 2 - 20}" y="${HEADER_HEIGHT - 20}" width="40" height="4" rx="2" fill="#34d399" />`)
  pathData.push(`<polygon points="${CANVAS_WIDTH / 2 - 8},${HEADER_HEIGHT - 12} ${CANVAS_WIDTH / 2 + 8},${HEADER_HEIGHT - 12} ${CANVAS_WIDTH / 2},${HEADER_HEIGHT - 4}" fill="#34d399" />`)
  
  // Generate session cards
  sessions.forEach((session, index) => {
    const row = Math.floor(index / maxSessionsPerRow)
    const col = index % maxSessionsPerRow
    
    const x = PADDING + col * (cardWidth + CARD_SPACING)
    const cardY = y + row * (CARD_HEIGHT + CARD_SPACING)
    
    const bgColor = 'rgba(16, 185, 129, 0.1)'
    const borderColor = '#10b981'
    
    pathData.push(`<rect x="${x}" y="${cardY}" width="${cardWidth}" height="${CARD_HEIGHT}" rx="12" fill="${bgColor}" stroke="${borderColor}" stroke-width="2" />`)
    
    const avatarInitials = displayName.split(' ').map(n => n[0]).join('').toUpperCase()
    pathData.push(`<circle cx="${x + 30}" cy="${cardY + 30}" r="20" fill="${borderColor}" stroke="white" stroke-width="2" />`)
    pathData.push(`<text x="${x + 30}" y="${cardY + 38}" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="bold" fill="white" text-anchor="middle">${avatarInitials}</text>`)
    
    const sessionTitle = displayNameOf(session.climber)
    pathData.push(`<text x="${x + 60}" y="${cardY + 25}" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="bold" fill="#e5e7eb">${sessionTitle}</text>`)
    
    const gymName = gymNameOf(session)
    pathData.push(`<text x="${x + 60}" y="${cardY + 42}" font-family="system-ui, -apple-system, sans-serif" font-size="12" fill="#9ca3af">🏔️ ${gymName}</text>`)
    
    const timeWindow = formatTimeWindow(session.start_time, session.end_time, session.start_slot, session.end_slot)
    pathData.push(`<text x="${x + 60}" y="${cardY + 57}" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="bold" fill="#10b981">⏰ ${timeWindow}</text>`)
    
    if (session.start_time && session.end_time) {
      const duration = formatDuration(session.start_time, session.end_time)
      pathData.push(`<text x="${x + 60}" y="${cardY + 72}" font-family="system-ui, -apple-system, sans-serif" font-size="11" fill="#6b7280">⏱️ ${duration}</text>`)
    }
    
    if (session.note) {
      const noteText = session.note.length > 40 ? session.note.substring(0, 37) + '...' : session.note
      pathData.push(`<rect x="${x + 10}" y="${cardY + 87}" width="${cardWidth - 20}" height="20" rx="4" fill="#374151" />`)
      pathData.push(`<text x="${x + 15}" y="${cardY + 99}" font-family="system-ui, -apple-system, sans-serif" font-size="10" fill="#d1d5db">📝 ${noteText}</text>`)
    }
  })
  
  // Footer
  pathData.push(`<rect x="0" y="${CANVAS_HEIGHT - 80}" width="${CANVAS_WIDTH}" height="80" fill="#111827" />`)
  pathData.push(`<text x="30" y="${CANVAS_HEIGHT - 45}" font-family="system-ui, -apple-system, sans-serif" font-size="14" fill="#9ca3af">climbcal • Share your weekly climbs</text>`)
  pathData.push(`<text x="30" y="${CANVAS_HEIGHT - 25}" font-family="system-ui, -apple-system, sans-serif" font-size="12" fill="#6b7280">Generated on ${new Date().toLocaleDateString()}</text>`)
  
  return `
    <svg width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        text { font-family: 'Inter', system-ui, -apple-system, sans-serif; }
      </style>
      ${pathData.join('')}
    </svg>
  `
}

/**
 * React component: renders the Instagram Story-sized image preview,
 * with a download button and share link for sharing online.
 */
export function WeekSessionImage({ sessions, weekTitle, displayName }: WeekSessionImageProps) {
  const svg = generateWeekSessionSVG(sessions, weekTitle, displayName)
  return (
    <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-6 backdrop-blur-sm">
      <h3 className="text-lg font-semibold text-zinc-100 mb-4">Instagram Story Preview</h3>

      <div className="relative mx-auto" style={{ maxWidth: '320px', aspectRatio: '9 / 16' }}>
        <div className="w-full h-full bg-contain bg-no-repeat bg-center">
          {svg}
        </div>

        <div className="mt-4 space-y-2 text-sm text-zinc-400">
          <p>• 9:16 Instagram Story aspect ratio</p>
          <p>• Contains {sessions.length} sessions</p>
          <p>• Ready to share online</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => alert(`Share link: ${IMAGE_SHARE_PATH}?week=${encodeURIComponent(weekTitle)}&name=${encodeURIComponent(displayName)}`)}
          disabled={!sessions.length}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
        >
          Download Image
        </button>

        <ShareLink path={IMAGE_SHARE_PATH} label="Copy share link" />
      </div>
    </div>
  )
}

export default WeekSessionImage