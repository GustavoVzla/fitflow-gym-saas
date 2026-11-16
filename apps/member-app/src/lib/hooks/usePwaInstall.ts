'use client'

import { useCallback, useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

type InstallState =
  | { status: 'unsupported' }
  | { status: 'installed' }
  | { status: 'dismissed-permanent' }
  | { status: 'idle'; visitCount: number }
  | { status: 'ready'; visitCount: number; prompt: () => Promise<'accepted' | 'dismissed'> }

const LS_VISIT_COUNT = 'pwa:visit-count'
const LS_DISMISSED_AT = 'pwa-install-dismissed-at'
const LS_LAST_VISIT_DAY = 'pwa:last-visit-day'
const DISMISS_COOLDOWN_MS = 1000 * 60 * 60 * 24 * 30 // 30 dias
const MIN_VISITS_TO_PROMPT = 2

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  if ((window.navigator as unknown as { standalone?: boolean }).standalone) return true
  return false
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function incrementVisitCountOncePerDay(): number {
  if (typeof window === 'undefined') return 0
  const today = todayKey()
  const last = localStorage.getItem(LS_LAST_VISIT_DAY)
  const current = Number(localStorage.getItem(LS_VISIT_COUNT) ?? 0)
  if (last === today) return current
  const next = current + 1
  localStorage.setItem(LS_VISIT_COUNT, String(next))
  localStorage.setItem(LS_LAST_VISIT_DAY, today)
  return next
}

function isDismissedPermanent(): boolean {
  if (typeof window === 'undefined') return false
  const raw = localStorage.getItem(LS_DISMISSED_AT)
  if (!raw) return false
  const at = Number(raw)
  if (Number.isNaN(at)) return false
  return Date.now() - at < DISMISS_COOLDOWN_MS
}

/**
 * Hook para PWA install prompt educativo.
 *
 * Flow:
 * 1. `beforeinstallprompt` capturado (solo Chrome/Edge/Samsung Browser).
 * 2. Trigger visible si: no standalone + visitas >= 2 + no dismissed recientemente.
 * 3. `install()` muestra el prompt nativo. Si user dismiss → persiste timestamp (30d cooldown).
 * 4. Safari iOS: no expone API → estado `unsupported`. UI debe mostrar instrucciones manuales (share sheet → Add to Home Screen).
 */
export function usePwaInstall(): InstallState {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState<boolean>(() => isStandalone())
  const [dismissedPermanent, setDismissedPermanent] = useState<boolean>(() => isDismissedPermanent())
  const [visitCount] = useState<number>(() => incrementVisitCountOncePerDay())

  useEffect(() => {
    if (typeof window === 'undefined') return
    void visitCount

    const onBip = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => setInstalled(true)

    window.addEventListener('beforeinstallprompt', onBip)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBip)
      window.removeEventListener('appinstalled', onInstalled)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const triggerPrompt = useCallback(async (): Promise<'accepted' | 'dismissed'> => {
    if (!deferred) return 'dismissed'
    await deferred.prompt()
    const choice = await deferred.userChoice
    if (choice.outcome === 'dismissed') {
      localStorage.setItem(LS_DISMISSED_AT, String(Date.now()))
      setDismissedPermanent(true)
    }
    setDeferred(null)
    return choice.outcome
  }, [deferred])

  if (installed) return { status: 'installed' }
  if (dismissedPermanent) return { status: 'dismissed-permanent' }
  if (typeof window !== 'undefined' && !('BeforeInstallPromptEvent' in window) && !deferred) {
    // Safari/iOS: no soporta el evento. Otros browsers (Firefox) tampoco.
    return { status: 'unsupported' }
  }
  if (!deferred || visitCount < MIN_VISITS_TO_PROMPT) {
    return { status: 'idle', visitCount }
  }
  return { status: 'ready', visitCount, prompt: triggerPrompt }
}

export function dismissInstallPromptManually(): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(LS_DISMISSED_AT, String(Date.now()))
}
