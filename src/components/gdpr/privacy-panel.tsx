'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function PrivacyPanel({ userEmail }: { userEmail: string }) {
  const router = useRouter()
  const [downloading, setDownloading] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [password, setPassword] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDownload() {
    setDownloading(true)
    setError(null)
    try {
      const res = await fetch('/api/gdpr/export', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `Error ${res.status}`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `fitflow-data-export-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al descargar datos')
    } finally {
      setDownloading(false)
    }
  }

  async function handleDelete() {
    if (confirmText !== 'BORRAR') {
      setError('Debes escribir BORRAR exactamente para confirmar')
      return
    }
    if (!password) {
      setError('Contraseña requerida')
      return
    }
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch('/api/gdpr/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error ?? `Error ${res.status}`)
      }
      // Redirect fuera del área protegida — la sesión ya fue invalidada server-side
      router.push('/login?deleted=1')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al eliminar cuenta')
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-8">
      <section className="border rounded-lg p-6 bg-white">
        <h2 className="text-lg font-semibold mb-2">Descargar mis datos</h2>
        <p className="text-sm text-gray-600 mb-4">
          Descarga un archivo JSON con toda la información personal que FitFlow tiene sobre tu cuenta ({userEmail}).
          Incluye perfil, reservas, pagos, notificaciones y registros de auditoría.
        </p>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {downloading ? 'Preparando...' : 'Descargar mis datos (JSON)'}
        </button>
      </section>

      <section className="border border-red-300 rounded-lg p-6 bg-red-50">
        <h2 className="text-lg font-semibold text-red-900 mb-2">Eliminar mi cuenta</h2>
        <p className="text-sm text-red-800 mb-4">
          Esta acción es <strong>permanente e irreversible</strong>. Se eliminará tu acceso y se anonimizarán tus datos personales.
          Por obligación contable española mantenemos registros fiscales de pagos anonimizados (factura sin nombre) durante
          el tiempo requerido por la ley.
        </p>
        {!showDeleteModal ? (
          <button
            onClick={() => setShowDeleteModal(true)}
            className="px-4 py-2 bg-red-600 text-white rounded font-medium hover:bg-red-700"
          >
            Eliminar mi cuenta
          </button>
        ) : (
          <div className="space-y-4 mt-4 border-t border-red-200 pt-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Escribe <code className="bg-white px-1 rounded">BORRAR</code> para confirmar
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="BORRAR"
                className="w-full px-3 py-2 border rounded font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Contraseña actual</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={deleting || confirmText !== 'BORRAR' || !password}
                className="px-4 py-2 bg-red-600 text-white rounded font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Eliminando...' : 'Confirmar eliminación'}
              </button>
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setConfirmText('')
                  setPassword('')
                  setError(null)
                }}
                disabled={deleting}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded font-medium hover:bg-gray-300"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </section>

      {error && (
        <div className="border border-red-300 rounded-lg p-4 bg-red-50 text-red-800 text-sm" role="alert">
          {error}
        </div>
      )}
    </div>
  )
}
