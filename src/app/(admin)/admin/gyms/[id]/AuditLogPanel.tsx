'use client'

import { useState } from 'react'
import {
  History,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Ban,
  CheckCircle2,
  Edit3,
  KeyRound,
  Trash2,
  Undo2,
  UserCog,
  UserX,
  CreditCard,
  Crown,
  Clock,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { AUDIT_ACTION_LABELS, formatDateTime, type AdminAuditLogRow } from '../../types'

type Props = {
  entries: AdminAuditLogRow[]
}

const ACTION_ICONS: Record<string, LucideIcon> = {
  'gym.update': Edit3,
  'gym.change_plan': Crown,
  'gym.change_payment_mode': CreditCard,
  'gym.suspend': Ban,
  'gym.reactivate': CheckCircle2,
  'gym.soft_delete': Trash2,
  'gym.restore': Undo2,
  'gym.remove_user': UserX,
  'gym.transfer_ownership': UserCog,
  'user.reset_password': KeyRound,
  'cron.hard_delete': AlertTriangle,
}

const TONE_COLORS: Record<string, string> = {
  info: 'bg-slate-50 text-slate-700 ring-slate-200',
  warn: 'bg-amber-50 text-amber-700 ring-amber-200',
  danger: 'bg-red-50 text-red-700 ring-red-200',
  ok: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
}

export default function AuditLogPanel({ entries }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
          <History className="h-4 w-4 text-slate-500" />
          Historial de acciones
        </h3>
        <span className="text-[11px] text-slate-400">Últimas {entries.length} entradas</span>
      </div>

      {entries.length === 0 ? (
        <p className="mt-4 text-xs text-slate-500">
          No hay acciones registradas todavía. Cualquier cambio sobre este gym se listará aquí.
        </p>
      ) : (
        <div className="mt-4 divide-y divide-slate-100">
          {entries.map((e) => {
            const label = AUDIT_ACTION_LABELS[e.action] ?? { label: e.action, tone: 'info' as const }
            const Icon = ACTION_ICONS[e.action] ?? Clock
            const isExpanded = expanded === e.id
            const hasMetadata = Object.keys(e.metadata).length > 0

            return (
              <div key={e.id} className="py-2.5">
                <button
                  type="button"
                  onClick={() => setExpanded(isExpanded ? null : e.id)}
                  disabled={!hasMetadata}
                  className="flex w-full items-start gap-3 text-left disabled:cursor-default"
                >
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1 ${
                      TONE_COLORS[label.tone]
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <p className="text-sm font-semibold text-slate-800">{label.label}</p>
                      {e.actorEmail ? (
                        <p className="text-xs text-slate-500">
                          por <span className="font-medium">{e.actorEmail}</span>
                        </p>
                      ) : (
                        <p className="text-xs text-slate-400 italic">sistema</p>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-400">{formatDateTime(e.createdAt)}</p>
                  </div>
                  {hasMetadata && (
                    <span className="shrink-0 text-slate-400">
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </span>
                  )}
                </button>

                {isExpanded && hasMetadata && (
                  <div className="ml-10 mt-2 rounded-lg bg-slate-50 p-3">
                    <pre className="whitespace-pre-wrap break-all text-[11px] text-slate-700">
                      {JSON.stringify(e.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
