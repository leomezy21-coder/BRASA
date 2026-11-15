import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import type { StatusLevel } from '../types'
import { useBrasaData } from '../hooks/useBrasaData'
import { useFilters } from '../hooks/useFilters'
import { formatWeekFriendly } from '../utils/dateUtils'
import { KpiCardSkeleton, ChartSkeleton } from '../components/SkeletonLoader'
import { ClimatologyChart } from '../components/ClimatologyChart'
import { AnomalyList } from '../components/AnomalyList'

/* Paleta del semáforo BRASA */
const LEVELS: Record<StatusLevel, { label: string; color: string; soft: string; criterion: string }> = {
  normal: {
    label: 'Normal',
    color: '#10B981',
    soft: 'bg-emerald-50 text-emerald-700',
    criterion: 'Z-score < 1.0σ y percentil < P70. Variabilidad estacional esperada.',
  },
  elevado: {
    label: 'Elevado',
    color: '#FF7900',
    soft: 'bg-[#FFF2E6] text-[#C2410C]',
    criterion: 'Z-score entre 1.0σ y 2.0σ, o percentil entre P70 y P90.',
  },
  inusual: {
    label: 'Inusual',
    color: '#E53935',
    soft: 'bg-[#FDE8E8] text-[#E53935]',
    criterion: 'Z-score ≥ 2.0σ o percentil ≥ P90. Comparable a 2012 y 2024.',
  },
}

/* Año por defecto si la API de estado aún no devuelve `year` (el mock usa la temporada 2024). */
const DEFAULT_STATUS_YEAR = 2024

const LEVEL_ORDER: StatusLevel[] = ['normal', 'elevado', 'inusual']

const Eyebrow: React.FC<{ children: React.ReactNode; muted?: boolean }> = ({ children, muted }) => (
  <p className={`text-[11px] font-bold uppercase tracking-[0.22em] ${muted ? 'text-slate-400' : 'text-[#FF7900]'}`}>
    {children}
  </p>
)

const formatZ = (z: number) => `${z > 0 ? '+' : ''}${z.toFixed(2)}σ`

export const Alertas: React.FC = () => {
  const { filters, selectedWeek, setSelectedWeek, setSelectedYear } = useFilters()
  const { currentStatus, climatology, calendar, anomalies, regions, isLoading } = useBrasaData()
  const navigate = useNavigate()

  /* Al elegir un periodo inusual se abre esa semana en el mapa */
  const handleSelectAnomaly = (year: number, week: number) => {
    setSelectedYear(year)
    setSelectedWeek(week)
    navigate('/explorar')
  }

  const selectedRegion =
    regions?.find((r) => r.id === filters.provinceId) ||
    regions?.find((r) => r.id === filters.countryCode) ||
    regions?.[0]
  const selectedCanton = selectedRegion?.cantons?.find((c) => c.id === filters.cantonId)

  if (isLoading || !currentStatus) {
    return (
      <div className="space-y-6 py-10 px-4 sm:px-8 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCardSkeleton />
          <KpiCardSkeleton />
          <KpiCardSkeleton />
          <KpiCardSkeleton />
        </div>
        <ChartSkeleton height="h-96" />
      </div>
    )
  }

  const climWeek = climatology?.weeks.find((w) => w.week === currentStatus.week)
  const statusYear = currentStatus.year ?? DEFAULT_STATUS_YEAR
  const level = LEVELS[currentStatus.level]
  const isEcuador = (filters.countryCode || 'ECU').toUpperCase() === 'ECU'
  const regionName = isEcuador
    ? (selectedRegion?.name || 'Chimborazo')
    : (filters.country || selectedRegion?.name || 'Territorio seleccionado')
  const cantonName = selectedCanton ? selectedCanton.name : isEcuador ? 'Riobamba' : regionName
  const displayLocation = selectedCanton
    ? `${selectedCanton.name}, ${regionName}`
    : isEcuador && filters.provinceId && filters.provinceId !== 'ECU'
      ? `${selectedRegion?.name || 'Chimborazo'}, Ecuador`
      : (filters.country || regionName)
  const percentile = Math.min(100, Math.max(0, currentStatus.percentile))

  const headline = {
    normal: 'Actividad dentro de lo esperado',
    elevado: 'Actividad por encima del promedio',
    inusual: 'Anomalía térmica significativa',
  }[currentStatus.level]

  const explanation = {
    normal: `Los ${currentStatus.value} fire_cell_days detectados están alineados con el promedio histórico (${climWeek?.mean ?? '—'}) para la semana ${currentStatus.week} en ${regionName}, dentro del rango P10–P90.`,
    elevado: `Los ${currentStatus.value} fire_cell_days superan el percentil P70 de la serie 2001–2025 y la media climatológica (${climWeek?.mean ?? '—'}), lo que sugiere condiciones secas persistentes o focos de quema concentrados.`,
    inusual: `Los ${currentStatus.value} fire_cell_days se ubican en el percentil P${currentStatus.percentile} (${formatZ(currentStatus.zscore)}) y superan ampliamente el umbral P90 (${climWeek?.p90 ?? '—'}), con una densidad de focos equiparable a las temporadas críticas de 2012 y 2024.`,
  }[currentStatus.level]

  const stats = [
    { label: 'Z-score', value: formatZ(currentStatus.zscore) },
    { label: `Media sem. ${currentStatus.week}`, value: `${climWeek?.mean ?? '24.3'}` },
    { label: 'Umbral P90', value: `${climWeek?.p90 ?? '68.2'}` },
  ]

  const context = [
    { label: isEcuador ? 'Provincia / Región' : 'País', value: regionName },
    { label: isEcuador ? 'Cantón' : 'Ámbito', value: cantonName },
    { label: 'Semana ISO', value: `${currentStatus.week} · ${statusYear}` },
    { label: 'Sensores', value: 'MODIS 1 km + VIIRS 375 m' },
  ]

  const params = [
    { label: 'P10', value: climWeek?.p10 ?? '4.2' },
    { label: 'Mediana', value: climWeek?.p50 ?? '18.7' },
    { label: 'Media', value: climWeek?.mean ?? '24.3' },
    { label: 'P90', value: climWeek?.p90 ?? '68.2' },
  ]

  return (
    <div className="py-10 sm:py-12 px-4 sm:px-8 max-w-6xl mx-auto text-[#0B1B3D]">
      {/* ───────── Encabezado ───────── */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div>
          <Eyebrow>Semáforo estadístico · {formatWeekFriendly(statusYear, currentStatus.week)}</Eyebrow>
          <h1 className="mt-3 text-4xl sm:text-5xl font-black tracking-tight leading-none">Alertas</h1>
          <p className="mt-3 text-slate-500">
            {displayLocation}
          </p>
        </div>

        <Link
          to="/explorar"
          className="inline-flex w-fit items-center gap-2.5 px-6 py-3 bg-gradient-to-r from-[#FF7900] to-[#FF5500] hover:from-[#E66D00] hover:to-[#E04800] text-white text-sm font-bold rounded-full shadow-lg shadow-[#FF7900]/25 transition-[translate,box-shadow] duration-250 hover:-translate-y-[3px] group"
        >
          <span>Ver en el mapa</span>
          <span className="text-base leading-none transition-transform group-hover:translate-x-1">→</span>
        </Link>
      </header>

      {/* ───────── Estado actual ───────── */}
      <section className="mt-10 bg-white rounded-[32px] border border-slate-200/70 overflow-hidden">
        <div className="grid lg:grid-cols-[1.35fr_1fr]">
          {/* Diagnóstico */}
          <div className="p-7 sm:p-10">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5" aria-hidden="true">
                {LEVEL_ORDER.map((l) => (
                  <span
                    key={l}
                    className="w-2.5 h-2.5 rounded-full transition-opacity"
                    style={{
                      backgroundColor: LEVELS[l].color,
                      opacity: l === currentStatus.level ? 1 : 0.18,
                      boxShadow: l === currentStatus.level ? `0 0 0 4px ${LEVELS[l].color}22` : undefined,
                    }}
                  />
                ))}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${level.soft}`}>
                Nivel {level.label.toLowerCase()}
              </span>
            </div>

            <h2 className="mt-6 text-2xl sm:text-3xl font-black tracking-tight leading-tight">{headline}</h2>
            <p className="mt-4 max-w-xl text-slate-600 leading-relaxed">{explanation}</p>
          </div>

          {/* Valor observado + posición histórica */}
          <div className="p-7 sm:p-10 bg-[#F8FAFC] lg:border-l border-t lg:border-t-0 border-slate-100 flex flex-col justify-center">
            <Eyebrow muted>Actividad observada</Eyebrow>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-6xl font-black tracking-tight" style={{ color: level.color }}>
                {currentStatus.value}
              </span>
              <span className="text-sm font-semibold text-slate-400">fire_cell_days</span>
            </div>

            <div className="mt-8">
              <div className="relative h-1.5 rounded-full bg-slate-200">
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700"
                  style={{ width: `${percentile}%`, backgroundColor: level.color }}
                />
                {[70, 90].map((p) => (
                  <span key={p} className="absolute -top-1 w-px h-3.5 bg-slate-300" style={{ left: `${p}%` }} />
                ))}
                <span
                  className="absolute top-1/2 w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white border-[3px]"
                  style={{ left: `${percentile}%`, borderColor: level.color }}
                />
              </div>
              <div className="relative mt-2 h-4 text-[11px] font-semibold text-slate-400">
                <span className="absolute left-0">P0</span>
                <span className="absolute -translate-x-1/2" style={{ left: '70%' }}>P70</span>
                <span className="absolute -translate-x-1/2" style={{ left: '90%' }}>P90</span>
              </div>
            </div>
          </div>
        </div>

        {/* Cifras clave en línea */}
        <dl className="grid grid-cols-1 sm:grid-cols-3 border-t border-slate-100">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={`px-7 sm:px-10 py-6 border-slate-100 ${i > 0 ? 'border-t sm:border-t-0 sm:border-l' : ''}`}
            >
              <dt className="text-xs text-slate-400">{s.label}</dt>
              <dd className="mt-1 text-xl font-black tracking-tight">{s.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ───────── Climatología semanal vs año ───────── */}
      <section className="mt-8">
        <ClimatologyChart
          climatology={climatology}
          calendar={calendar}
          selectedYear={statusYear}
          selectedWeek={currentStatus.week}
          isLoading={isLoading}
        />
      </section>

      {/* ───────── Periodos inusuales ───────── */}
      <section className="mt-8">
        <AnomalyList
          anomalies={anomalies}
          isLoading={isLoading}
          selectedYear={filters.selectedYear}
          selectedWeek={selectedWeek}
          onSelectAnomaly={handleSelectAnomaly}
          calendar={calendar}
          climatology={climatology}
        />
      </section>

      {/* ───────── Clasificación + Contexto ───────── */}
      <section className="mt-16 grid lg:grid-cols-2 gap-14 lg:gap-20">
        <div>
          <Eyebrow>Cómo se clasifica</Eyebrow>
          <ul className="mt-5 divide-y divide-slate-200/70 border-y border-slate-200/70">
            {LEVEL_ORDER.map((l) => {
              const active = l === currentStatus.level
              return (
                <li key={l} className={`flex gap-4 py-5 ${active ? '' : 'opacity-60'}`}>
                  <span
                    className="mt-1.5 w-2.5 h-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: LEVELS[l].color }}
                  />
                  <div>
                    <p className="font-extrabold flex items-center gap-2">
                      {LEVELS[l].label}
                      {active && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Actual</span>
                      )}
                    </p>
                    <p className="mt-1 text-sm text-slate-500 leading-relaxed">{LEVELS[l].criterion}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>

        <div>
          <Eyebrow>Contexto</Eyebrow>
          <dl className="mt-5 divide-y divide-slate-200/70 border-y border-slate-200/70 text-sm">
            {context.map((c) => (
              <div key={c.label} className="flex justify-between gap-4 py-3.5">
                <dt className="text-slate-500">{c.label}</dt>
                <dd className="font-bold text-right">{c.value}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-10 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">
            Climatología sem. {currentStatus.week} (fcd)
          </p>
          <dl className="mt-4 grid grid-cols-4 gap-4">
            {params.map((p) => (
              <div key={p.label}>
                <dt className="text-xs text-slate-400">{p.label}</dt>
                <dd className={`mt-1 text-lg font-black ${p.label === 'P90' ? 'text-[#E53935]' : ''}`}>{p.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ───────── Aviso ───────── */}
      <aside
        role="note"
        className="mt-16 flex gap-3 items-start pt-6 border-t border-slate-200/70 text-xs text-slate-500 leading-relaxed"
      >
        <ShieldAlert className="w-4 h-4 shrink-0 text-[#FF7900] mt-0.5" />
        <p>
          Herramienta analítica del <strong className="text-[#0B1B3D]">NASA Space Apps Challenge 2026</strong> con fines
          científicos y de exploración. Los estados y percentiles mostrados{' '}
          <strong className="text-[#0B1B3D]">no constituyen alertas oficiales</strong> ni pronósticos de protección civil.
        </p>
      </aside>
    </div>
  )
}
