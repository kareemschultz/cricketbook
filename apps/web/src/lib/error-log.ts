// ─── In-session error log ─────────────────────────────────────────────────────
//
// Lightweight circular buffer for surfacing errors that would otherwise be
// silently swallowed. Max 20 entries, newest-first. Not persisted — resets on
// page reload (intentional: tells user "since last session open").

export interface ErrorEntry {
  timestamp: string   // ISO string
  context: string     // human-readable source label e.g. "stats-update"
  message: string
}

const MAX_ENTRIES = 20
let entries: ErrorEntry[] = []
const listeners = new Set<() => void>()

/** Log an error with a source context label. Non-throwing. */
export function logError(context: string, error: unknown): void {
  const message =
    error instanceof Error ? error.message : String(error)
  entries = [
    { timestamp: new Date().toISOString(), context, message },
    ...entries,
  ].slice(0, MAX_ENTRIES)
  listeners.forEach((fn) => fn())
}

/** Returns a snapshot of the current error log (newest first). */
export function getErrorLog(): ErrorEntry[] {
  return [...entries]
}

/** Clears all entries and notifies listeners. */
export function clearErrorLog(): void {
  entries = []
  listeners.forEach((fn) => fn())
}

/** Subscribe to changes. Returns an unsubscribe function. */
export function subscribeErrorLog(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
