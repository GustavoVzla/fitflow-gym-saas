'use client'

import { studioBrand } from '../theme'

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(248,113,113,0.12)] text-[#f87171]">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="h-8 w-8"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.348 14.652a3.75 3.75 0 010-5.304m5.304 0a3.75 3.75 0 010 5.304m-7.425 2.121a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546M5.106 18.894c-3.808-3.808-3.808-9.98 0-13.789m13.788 0c3.808 3.808 3.808 9.981 0 13.79M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <h1 className="mb-2 font-[family-name:var(--font-display)] text-2xl font-bold text-[#f0f0f5]">
        Sin conexión
      </h1>
      <p className="max-w-sm text-sm text-[rgba(240,240,245,0.6)]">
        No podemos contactar con {studioBrand.name} ahora mismo. Comprueba
        tu conexión y reintenta.
      </p>
      <button
        type="button"
        onClick={() => location.reload()}
        className="mt-6 rounded-lg border border-[rgba(59,139,234,0.3)] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#5da0ef] hover:bg-[rgba(59,139,234,0.08)]"
      >
        Reintentar
      </button>
    </main>
  )
}
