'use client'

import { useEffect, useState, useTransition } from 'react'
import { Bell, BellOff, AlertCircle } from 'lucide-react'
import { subscribePushAction, unsubscribePushAction } from '@/app/(member)/_actions/push'

type Props = {
  /** Public key VAPID generada en Edge Function send-push-notification */
  vapidPublicKey: string | null
}

type State =
  | 'unsupported'
  | 'no-vapid'
  | 'denied'
  | 'subscribed'
  | 'unsubscribed'
  | 'loading'

/**
 * Toggle Web Push notifications en `/cuenta`.
 *
 * Flow:
 * 1. Browser sin Service Worker o sin PushManager → unsupported
 * 2. Sin VAPID public key configurada (env var faltante) → no-vapid
 * 3. Notification permission 'denied' (user lo bloqueó) → denied (sin recovery in-app)
 * 4. Toggle ON: solicita permiso, subscribe, POST a Server Action
 * 5. Toggle OFF: unsubscribe + DELETE Server Action
 */
export function PushNotificationsToggle({ vapidPublicKey }: Props) {
  // Lazy init: detecta state inicial sincrono evitando lint react-hooks/set-state-in-effect.
  // El estado real (subscribed vs unsubscribed) se resuelve en el useEffect via async getSubscription.
  const [state, setState] = useState<State>(() => {
    if (typeof window === 'undefined') return 'loading'
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported'
    if (!vapidPublicKey) return 'no-vapid'
    if (Notification.permission === 'denied') return 'denied'
    return 'loading'
  })
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (state !== 'loading') return

    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        setState(sub ? 'subscribed' : 'unsubscribed')
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleEnable() {
    if (!vapidPublicKey) return
    setError(null)
    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
          setState(permission === 'denied' ? 'denied' : 'unsubscribed')
          return
        }

        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        })

        const json = sub.toJSON()
        const fd = new FormData()
        fd.set('endpoint', sub.endpoint)
        fd.set('p256dh', json.keys?.p256dh ?? '')
        fd.set('auth', json.keys?.auth ?? '')
        fd.set('userAgent', navigator.userAgent)

        const result = await subscribePushAction(fd)
        if (result.ok) {
          setState('subscribed')
        } else {
          setError(result.error)
          // Rollback la subscription si el server falló
          await sub.unsubscribe()
          setState('unsubscribed')
        }
      } catch (err) {
        setError('No se pudo activar las notificaciones.')
        console.error('[push] subscribe failed', err)
        setState('unsubscribed')
      }
    })
  }

  function handleDisable() {
    setError(null)
    startTransition(async () => {
      try {
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          const fd = new FormData()
          fd.set('endpoint', sub.endpoint)
          await unsubscribePushAction(fd)
          await sub.unsubscribe()
        }
        setState('unsubscribed')
      } catch (err) {
        setError('No se pudo desactivar las notificaciones.')
        console.error('[push] unsubscribe failed', err)
      }
    })
  }

  if (state === 'loading') {
    return (
      <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
        <div className="h-4 w-32 animate-pulse rounded bg-white/10" />
      </div>
    )
  }

  if (state === 'unsupported' || state === 'no-vapid') {
    // No mostrar nada en navegadores que no soportan, evita ruido visual
    return null
  }

  if (state === 'denied') {
    return (
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <div>
            <p className="text-sm font-medium text-amber-100">Notificaciones bloqueadas</p>
            <p className="mt-1 text-xs text-amber-200/70">
              Has bloqueado las notificaciones en este navegador. Cambia el permiso desde la configuración del sitio para activarlas.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const isSubscribed = state === 'subscribed'

  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {isSubscribed ? (
            <Bell className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          ) : (
            <BellOff className="mt-0.5 h-4 w-4 shrink-0 text-white/40" />
          )}
          <div>
            <p className="text-sm font-medium text-white">Notificaciones push</p>
            <p className="mt-0.5 text-xs text-white/50">
              {isSubscribed
                ? 'Recibirás avisos cuando haya hueco en la lista de espera y novedades del gimnasio.'
                : 'Activa para recibir avisos de huecos en lista de espera y novedades.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={isSubscribed ? handleDisable : handleEnable}
          disabled={pending}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
            isSubscribed
              ? 'bg-white/10 text-white/80 hover:bg-white/15'
              : 'bg-brand text-white hover:bg-brand/90'
          }`}
        >
          {pending ? '…' : isSubscribed ? 'Desactivar' : 'Activar'}
        </button>
      </div>
      {error ? (
        <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</p>
      ) : null}
    </div>
  )
}

/**
 * Convierte VAPID public key (base64url) a Uint8Array<ArrayBuffer> para
 * PushManager.subscribe(). Tipado explicito ArrayBuffer (no SharedArrayBuffer)
 * porque TS 5.7+ hizo Uint8Array generico y BufferSource no acepta el default.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const buf = new ArrayBuffer(raw.length)
  const out = new Uint8Array(buf)
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i)
  return out
}
