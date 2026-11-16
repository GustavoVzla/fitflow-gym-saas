'use client'

import { useRef, useState } from 'react'
import { Upload, X, Loader2, ImageIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export type UploadKind = 'logo' | 'web-hero' | 'web-gallery'

interface Props {
  gymId: string
  kind: UploadKind
  currentUrl: string | null
  onUploaded: (url: string) => void | Promise<void>
  onRemove?: () => void | Promise<void>
  accept?: string
  previewShape?: 'circle' | 'square' | 'wide'
  label?: string
  helperText?: string
  disabled?: boolean
}

const MAX_SIZE = 5 * 1024 * 1024

export function ImageUploader({
  gymId,
  kind,
  currentUrl,
  onUploaded,
  onRemove,
  accept = 'image/png,image/jpeg,image/webp,image/svg+xml',
  previewShape = 'square',
  label = 'Subir imagen',
  helperText,
  disabled = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null)
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_SIZE) {
      setError('Máximo 5MB')
      return
    }

    setUploading(true)
    try {
      const supabase = createClient()
      const ext = (file.name.split('.').pop() || 'png').toLowerCase()
      const rand = Math.random().toString(36).slice(2, 8)
      const path = `${gymId}/${kind}/${kind}-${Date.now()}-${rand}.${ext}`

      const { error: upErr } = await supabase.storage
        .from('gym-assets')
        .upload(path, file, {
          upsert: false,
          cacheControl: '3600',
          contentType: file.type,
        })
      if (upErr) throw upErr

      const { data } = supabase.storage.from('gym-assets').getPublicUrl(path)
      await onUploaded(data.publicUrl)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error subiendo archivo'
      setError(msg)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const previewClass =
    previewShape === 'circle'
      ? 'h-20 w-20 rounded-full'
      : previewShape === 'wide'
        ? 'w-full aspect-video rounded-lg'
        : 'h-24 w-24 rounded-lg'

  return (
    <div>
      <div className="flex items-start gap-4 flex-wrap">
        <div
          className={`${previewClass} flex-shrink-0 overflow-hidden bg-slate-100 ring-1 ring-slate-200 flex items-center justify-center text-slate-400`}
        >
          {currentUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={currentUrl} alt="Preview" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-6 w-6" />
          )}
        </div>

        <div className="flex-1 min-w-[180px]">
          <label
            className={`inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-slate-50 cursor-pointer ${
              disabled || uploading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {uploading ? 'Subiendo...' : label}
            <input
              ref={inputRef}
              type="file"
              accept={accept}
              onChange={handleFile}
              disabled={disabled || uploading}
              className="hidden"
            />
          </label>

          {currentUrl && onRemove && (
            <button
              type="button"
              onClick={onRemove}
              disabled={disabled || uploading}
              className="ml-2 inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" />
              Quitar
            </button>
          )}

          {helperText && (
            <p className="mt-1.5 text-xs text-slate-500">{helperText}</p>
          )}
          {error && (
            <p className="mt-1.5 text-xs text-red-600">{error}</p>
          )}
        </div>
      </div>
    </div>
  )
}
