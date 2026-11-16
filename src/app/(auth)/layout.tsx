import Image from 'next/image'
import { getHostBrand } from '@/lib/hostBrand'

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const brand = await getHostBrand()

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          {brand.logoUrl ? (
            <div className="mb-3 flex justify-center">
              <Image
                src={brand.logoUrl}
                alt={brand.name}
                width={72}
                height={72}
                priority
                className="h-16 w-16 rounded-xl object-contain"
              />
            </div>
          ) : null}
          <h1 className="text-3xl font-bold text-slate-900">{brand.name}</h1>
          <p className="mt-2 text-sm text-slate-600">{brand.subtitle}</p>
          {brand.isWhiteLabel && (
            <p className="mt-1 text-[11px] text-slate-400">Powered by FitFlow</p>
          )}
        </div>
        {children}
      </div>
    </div>
  )
}
