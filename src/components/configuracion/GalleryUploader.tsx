'use client'

import { useRef, useState } from 'react'
import { Upload, X, Loader2, ImageIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  gymId: string
  currentUrls: string[]
  maxItems?: number
  onUpdate: (urls: string[]) => void | Promise<void>
  disabled?: boolean
}

const MAX_SIZE = 5 * 1024 * 1024

export function GalleryUploader({
  gymId,
  currentUrls,
  maxItems = 12,
  onUpdate,
  disabled = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null)
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return

    const remaining = maxItems - currentUrls.length
    if (remaining <= 0) {
      setError(`Máximo ${maxItems} imágenes`)
      return
    }

    const toUpload = files.slice(0, remaining)
    setUploading(true)

    try {
      const supabase = createClient()
      const uploaded: string[] = []

      for (const file of toUpload) {
        if (file.size > MAX_SIZE) {
          setError(`"${file.name}" excede 5MB`)
          continue
        }
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
        const rand = Math.random().toString(36).slice(2, 8)
        const path = `${gymId}/web-gallery/gal-${Date.now()}-${rand}.${ext}`

        const { error: upErr } = await supabase.storage
          .from('gym-assets')
          .upload(path, file, {
            upsert: false,
            cacheControl: '3600',
            contentType: file.type,
          })
        if (upErr) {
          setError(upErr.message)
          continue
        }

        const { data } = supabase.storage.from('gym-assets').getPublicUrl(path)
        uploaded.push(data.publicUrl)
      }

      if (uploaded.length > 0) {
        await onUpdate([...currentUrls, ...uploaded])
      }
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleRemove(idx: number) {
    const next = currentUrls.filter((_, i) => i !== idx)
    await onUpdate(next)
  }

  async function handleMove(idx: number, direction: -1 | 1) {
    const newIdx = idx + direction
    if (newIdx < 0 || newIdx >= currentUrls.length) return
    const next = [...currentUrls]
    ;[next[idx], next[newIdx]] = [next[newIdx], next[idx]]
    await onUpdate(next)
  }

  const canAdd = currentUrls.length < maxItems

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">
            Galería web pública
          </p>
          <p className="text-xs text-slate-500">
            {currentUrls.length} / {maxItems} imágenes · Orden importa (primera = más prominente)
          </p>
        </div>
        <label
          className={`inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-slate-50 cursor-pointer ${
            disabled || uploading || !canAdd ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {uploading ? 'Subiendo...' : 'Añadir imágenes'}
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            onChange={handleFiles}
            disabled={disabled || uploading || !canAdd}
            className="hidden"
          />
        </label>
      </div>

      {error && (
        <p className="mb-2 text-xs text-red-600">{error}</p>
      )}

      {currentUrls.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
          <ImageIcon className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-xs text-slate-500">
            Sin imágenes todavía. Añade al menos 3 para que la web luzca completa.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {currentUrls.map((url, idx) => (
            <div
              key={url}
              className="group relative aspect-square rounded-lg overflow-hidden bg-slate-100 ring-1 ring-slate-200"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Imagen ${idx + 1}`} className="h-full w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex gap-1">
                  {idx > 0 && (
                    <button
                      type="button"
                      onClick={() => handleMove(idx, -1)}
                      disabled={disabled}
                      className="rounded bg-white/90 p-1 text-slate-700 hover:bg-white disabled:opacity-50"
                      title="Mover izquierda"
                    >
                      <ChevronLeft className="h-3 w-3" />
                    </button>
                  )}
                  {idx < currentUrls.length - 1 && (
                    <button
                      type="button"
                      onClick={() => handleMove(idx, 1)}
                      disabled={disabled}
                      className="rounded bg-white/90 p-1 text-slate-700 hover:bg-white disabled:opacity-50"
                      title="Mover derecha"
                    >
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(idx)}
                  disabled={disabled}
                  className="rounded bg-red-600 p-1 text-white hover:bg-red-700 disabled:opacity-50"
                  title="Eliminar"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              {idx === 0 && (
                <span className="absolute top-1 left-1 rounded bg-amber-400 px-1.5 py-0.5 text-[9px] font-semibold text-slate-900">
                  PORTADA
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
