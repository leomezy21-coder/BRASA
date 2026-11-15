import React from 'react'
import { Link } from 'react-router-dom'
import type { AnomaliesResponse, CalendarResponse, CurrentStatusResponse, SeasonResponse } from '../types'
import { KpiCardSkeleton } from './SkeletonLoader'
import { MONTHS_LONG, formatPercent, monthlyTotals, percentDiff } from '../utils/monthly'

interface KpiCardsProps {
  season: SeasonResponse | null
  currentStatus: CurrentStatusResponse | null
  calendar?: CalendarResponse | null
  anomalies?: AnomaliesResponse | null
  selectedYear: number
  isLoading: boolean
}

const STATUS = {
  normal: { label: 'Normal', color: '#10B981' },
  elevado: { label: 'Elevado', color: '#FF7900' },
  inusual: { label: 'Inusual', color: '#E53935' },
}

const Kpi: React.FC<{ label: string; value: React.ReactNode; note?: React.ReactNode }> = ({ label, value, note }) => (
  <div className="px-6 py-5">
    <p className="text-xs text-slate-400">{label}</p>
    <p className="mt-1 text-xl font-black tracking-tight text-[#0B1B3D]">{value}</p>
    {note && <p className="mt-0.5 text-xs text-slate-500">{note}</p>}
  </div>
)

export const KpiCards: React.FC<KpiCardsProps> = ({
  season,
  currentStatus,
  calendar = null,
  anomalies = null,
  selectedYear,
  isLoading,
}) => {
  if (!season || !currentStatus) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCardSkeleton />
        <KpiCardSkeleton />
        <KpiCardSkeleton />
        <KpiCardSkeleton />
      </div>
    )
  }

  // 1. Total del año y variación respecto al promedio anual 2001–2025
  const yearSeason = season.years.find((y) => y.year === selectedYear)
  const total = yearSeason?.total ?? null
  const meanTotal = season.years.length ? season.years.reduce((acc, y) => acc + y.total, 0) / season.years.length : null
  const variation = percentDiff(total, meanTotal)

  // 2. Mes más activo del año
  const months = monthlyTotals(calendar, selectedYear)
  const peakMonth = months.reduce<number | null>(
    (best, v, m) => (v !== null && (best === null || v > (months[best] ?? -1)) ? m : best),
    null
  )

  // 3. Semanas inusuales del año (calculadas por el backend)
  const unusualCount = anomalies?.items.filter((a) => a.year === selectedYear).length ?? 0

  const status = STATUS[currentStatus.level]

  return (
    <div className="bg-white rounded-[28px] border border-slate-200/70 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 overflow-hidden [&>*]:border-slate-100 [&>*:not(:first-child)]:border-t sm:[&>*:nth-child(2)]:border-t-0 sm:[&>*:nth-child(even)]:border-l lg:[&>*]:border-t-0 lg:[&>*:not(:first-child)]:border-l">
      <Kpi
        label={`Actividad total ${selectedYear}`}
        value={
          <>
            {total === null ? '—' : Math.round(total).toLocaleString('es-EC')}
            <span className="ml-1.5 text-sm font-semibold text-slate-400">fcd</span>
          </>
        }
        note={
          <span className={variation !== null && variation > 0 ? 'text-[#C2410C] font-bold' : ''}>
            {formatPercent(variation)} vs promedio anual
          </span>
        }
      />

      <Kpi
        label="Mes más activo"
        value={peakMonth === null ? '—' : MONTHS_LONG[peakMonth]}
        note={yearSeason ? `Semana pico: ${yearSeason.peak_week}` : undefined}
      />

      <Kpi
        label={`Periodos inusuales ${selectedYear}`}
        value={
          <>
            {unusualCount}
            <span className="ml-1.5 text-sm font-semibold text-slate-400">semana{unusualCount === 1 ? '' : 's'}</span>
          </>
        }
        note="Z-score ≥ 1.6σ"
      />

      <Link to="/alertas" className="group block hover:bg-[#FFF8F2] transition-colors">
        <Kpi
          label="Estado de esta semana"
          value={
            <span className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: status.color }} />
              {status.label}
            </span>
          }
          note={<span className="font-bold text-[#FF7900]">Ver diagnóstico</span>}
        />
      </Link>
    </div>
  )
}
