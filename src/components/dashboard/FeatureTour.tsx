'use client'

import { useEffect } from 'react'
import { driver, type DriveStep, type Config } from 'driver.js'
import 'driver.js/dist/driver.css'
import { markTourSeenAction } from '@/app/(dashboard)/tours-actions'

interface Props {
  /** Unique persistence key. Append a version suffix to force re-show after major tour updates (e.g. "socios-v1", "socios-v2"). */
  tourKey: string
  steps: DriveStep[]
  /** true = auto-start on first visit (default). false = only manual replay. */
  autoStart?: boolean
  /** Pre-fetched list of tour keys this user has already seen (from DB). Avoids a client-side roundtrip on mount. */
  seenTourKeys: string[]
}

/**
 * Auto-starts a driver.js tour the first time a user visits the page.
 *
 * Persistence: backend (migración 0025, table `gym_tours_seen`). Checks the
 * `seenTourKeys` prop passed from the Server Component parent (pre-fetched
 * via `public.get_tours_seen` RPC). After auto-starting, marks the tour as
 * seen via the `markTourSeenAction` Server Action (fire-and-forget).
 *
 * Fallback: also writes to `localStorage` so a flaky Server Action doesn't
 * re-show the tour on instant second-visit within the same session.
 */
export default function FeatureTour({
  tourKey,
  steps,
  autoStart = true,
  seenTourKeys,
}: Props) {
  useEffect(() => {
    if (!autoStart) return
    if (typeof window === 'undefined') return

    // Backend says seen → don't auto-start
    if (seenTourKeys.includes(tourKey)) return

    // Local fallback for same-session protection (also if user clears DB but
    // reloads twice in a row before the second fetch)
    const storageKey = `fitflow:tour:${tourKey}`
    if (window.localStorage.getItem(storageKey)) return

    // Small delay so target elements (usually rendered async) are in the DOM
    const timeout = window.setTimeout(() => {
      const d = driver(buildConfig(steps))
      d.drive()
      // Local + backend in parallel. Backend is source of truth cross-device;
      // localStorage prevents same-session re-show if backend lags.
      window.localStorage.setItem(storageKey, new Date().toISOString())
      void markTourSeenAction(tourKey)
    }, 600)

    return () => window.clearTimeout(timeout)
  }, [tourKey, steps, autoStart, seenTourKeys])

  return null
}

function buildConfig(steps: DriveStep[]): Config {
  return {
    showProgress: true,
    progressText: '{{current}} / {{total}}',
    nextBtnText: 'Siguiente →',
    prevBtnText: '← Anterior',
    doneBtnText: 'Entendido',
    allowClose: true,
    showButtons: ['next', 'previous', 'close'],
    steps,
  }
}
