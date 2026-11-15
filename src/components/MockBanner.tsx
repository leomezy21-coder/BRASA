import React, { useState } from 'react'
import { Info, X } from 'lucide-react'
import { IS_MOCK_MODE } from '../api/client'

interface MockBannerProps {
  forceShow?: boolean
}

export const MockBanner: React.FC<MockBannerProps> = ({ forceShow = false }) => {
  const [dismissed, setDismissed] = useState(false)

  if ((!IS_MOCK_MODE && !forceShow) || dismissed) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-[#FFF9E6] border-b border-[#FFC107]/40 text-[#0B2D5B] px-4 py-2.5 text-xs sm:text-sm flex items-center justify-between shadow-2xs transition-all"
    >
      <div className="flex items-center gap-2.5 max-w-7xl mx-auto w-full">
        <div className="w-5 h-5 rounded-full bg-[#FFC107] text-[#0B2D5B] flex items-center justify-center font-bold text-xs shrink-0">
          <Info className="w-3.5 h-3.5" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold tracking-wide text-[#0B2D5B]">
            Datos simulados de demostración
          </span>
          <span className="text-slate-600 text-xs hidden md:inline">
            — BRASA está operando en modo simulación para el NASA Space Apps Challenge 2026. Climatología histórica de Ecuador (2001–2025).
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="text-slate-500 hover:text-[#0B2D5B] p-1 rounded-md transition-colors"
        aria-label="Cerrar banner de modo simulado"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
