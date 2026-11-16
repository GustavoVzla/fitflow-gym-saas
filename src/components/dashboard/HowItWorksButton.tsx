'use client'

import { HelpCircle } from 'lucide-react'
import { driver, type DriveStep, type Config } from 'driver.js'
import 'driver.js/dist/driver.css'

interface Props {
  steps: DriveStep[]
  label?: string
}

/**
 * Client-only button that replays a driver.js tour on demand. Place next to
 * a feature's page title so the user can re-open the tour whenever they want.
 *
 * Does NOT persist/respect the "seen" localStorage flag — clicking this button
 * always starts the tour from step 1.
 */
export default function HowItWorksButton({ steps, label = '¿Cómo funciona?' }: Props) {
  const onClick = () => {
    const config: Config = {
      showProgress: true,
      progressText: '{{current}} / {{total}}',
      nextBtnText: 'Siguiente →',
      prevBtnText: '← Anterior',
      doneBtnText: 'Entendido',
      allowClose: true,
      showButtons: ['next', 'previous', 'close'],
      steps,
    }
    driver(config).drive()
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-[#3b8bea] hover:text-[#3b8bea]"
    >
      <HelpCircle className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}
