import Link from 'next/link'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { getInstructorsList } from './data'

function fmtDate(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export default async function InstructoresPage() {
  const instructors = await getInstructorsList()

  return (
    <div className="space-y-5">
      <Link
        href="/socios"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 transition-colors hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a socios
      </Link>

      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-[20px] font-bold text-slate-900">Instructores</h1>
          <p className="mt-1 text-[13px] text-slate-500">
            Gestiona el equipo del gym y configura sus permisos granulares.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-slate-50 text-left text-[12px] font-medium text-slate-500">
              <tr>
                <th className="px-5 py-3">Instructor</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Teléfono</th>
                <th className="px-5 py-3">Fecha de alta</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {instructors.map((i) => (
                <tr key={i.id} className="border-t border-slate-100 text-slate-800">
                  <td className="px-5 py-3 font-medium">{i.name}</td>
                  <td className="px-5 py-3 text-slate-500">{i.email ?? '—'}</td>
                  <td className="px-5 py-3 text-slate-500">{i.phone ?? '—'}</td>
                  <td className="px-5 py-3 text-slate-500">{fmtDate(i.createdAt)}</td>
                  <td className="px-5 py-3">
                    {i.isActive ? (
                      i.hasAuthAccount ? (
                        <span className="inline-flex h-5 items-center rounded-full bg-emerald-50 px-2 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                          App activa
                        </span>
                      ) : (
                        <span className="inline-flex h-5 items-center rounded-full bg-amber-50 px-2 text-[11px] font-medium text-amber-700 ring-1 ring-amber-200">
                          Sin invitar
                        </span>
                      )
                    ) : (
                      <span className="inline-flex h-5 items-center rounded-full bg-slate-100 px-2 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200">
                        Inactivo
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      href={`/socios/instructores/${i.id}`}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Permisos
                    </Link>
                  </td>
                </tr>
              ))}
              {instructors.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-12 text-center text-[13px] text-slate-400"
                  >
                    No hay instructores todavía. Créalos desde la sección{' '}
                    <Link
                      href="/clases-tarifas"
                      className="text-[#3b8bea] underline"
                    >
                      Clases y tarifas
                    </Link>
                    .
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
