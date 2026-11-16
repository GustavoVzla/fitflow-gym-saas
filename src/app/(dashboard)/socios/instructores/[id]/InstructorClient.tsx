'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, User, Bell, ShieldCheck, Clock } from 'lucide-react'
import DatosTab from './tabs/DatosTab'
import NotificacionesTab from './tabs/NotificacionesTab'
import PermisosTab from './tabs/PermisosTab'
import FichadoTab, { type CheckInRow } from './tabs/FichadoTab'
import type { InstructorDetail, NotifDelivery } from '../types'

type TabKey = 'datos' | 'notificaciones' | 'permisos' | 'fichado'

const TABS: { key: TabKey; label: string; Icon: typeof User }[] = [
  { key: 'datos', label: 'Datos personales', Icon: User },
  { key: 'notificaciones', label: 'Notificaciones', Icon: Bell },
  { key: 'permisos', label: 'Permisos', Icon: ShieldCheck },
  { key: 'fichado', label: 'Historial fichado', Icon: Clock },
]

interface Props {
  instructor: InstructorDetail
  initialPermissions: Record<string, number>
  initialNotifPrefs: Record<string, NotifDelivery>
  initialCheckIns: CheckInRow[]
  monthTotalMinutes: number
  monthSessions: number
}

export default function InstructorClient({
  instructor,
  initialPermissions,
  initialNotifPrefs,
  initialCheckIns,
  monthTotalMinutes,
  monthSessions,
}: Props) {
  const [tab, setTab] = useState<TabKey>('datos')

  return (
    <div className="space-y-5">
      <Link
        href="/socios/instructores"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 transition-colors hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver al listado
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full text-[16px] font-semibold text-white shadow-sm"
            style={{ background: instructor.color }}
          >
            {instructor.name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div>
            <h1 className="text-[18px] font-bold text-slate-900">{instructor.name}</h1>
            <p className="text-[12px] text-slate-500">
              {instructor.email ?? 'Sin email'}{' '}
              {instructor.specialties.length > 0 && (
                <>· {instructor.specialties.join(', ')}</>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {instructor.isActive ? (
            <span className="inline-flex h-6 items-center rounded-full bg-emerald-50 px-2.5 text-[12px] font-medium text-emerald-700 ring-1 ring-emerald-200">
              Activo
            </span>
          ) : (
            <span className="inline-flex h-6 items-center rounded-full bg-slate-100 px-2.5 text-[12px] font-medium text-slate-500 ring-1 ring-slate-200">
              Inactivo
            </span>
          )}
          {instructor.hasAuthAccount && (
            <span className="inline-flex h-6 items-center rounded-full bg-indigo-50 px-2.5 text-[12px] font-medium text-indigo-700 ring-1 ring-indigo-200">
              App activa
            </span>
          )}
        </div>
      </header>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap gap-1 border-b border-slate-100 px-3 pt-3">
          {TABS.map((t) => {
            const active = t.key === tab
            const Icon = t.Icon
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={
                  'inline-flex items-center gap-1.5 rounded-t-lg border-b-2 px-3 pb-2 pt-1 text-[13px] font-medium transition-colors ' +
                  (active
                    ? 'border-[#3b8bea] text-[#3b8bea]'
                    : 'border-transparent text-slate-500 hover:text-slate-900')
                }
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            )
          })}
        </div>

        <div className="p-5">
          {tab === 'datos' && <DatosTab instructor={instructor} />}
          {tab === 'notificaciones' && (
            <NotificacionesTab
              instructorId={instructor.id}
              initialPrefs={initialNotifPrefs}
            />
          )}
          {tab === 'permisos' && (
            <PermisosTab
              instructorId={instructor.id}
              initialPermissions={initialPermissions}
            />
          )}
          {tab === 'fichado' && (
            <FichadoTab
              instructorId={instructor.id}
              initialEntries={initialCheckIns}
              monthTotalMinutes={monthTotalMinutes}
              monthSessions={monthSessions}
            />
          )}
        </div>
      </div>
    </div>
  )
}
