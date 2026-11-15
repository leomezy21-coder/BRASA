import React, { useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import type { AnomaliesResponse, CalendarResponse, ClimatologyResponse } from '../types'
import { formatWeekFriendly } from '../utils/dateUtils'

interface AnomalyListProps {
  anomalies: AnomaliesResponse | null
  isLoading: boolean
  selectedYear: number
  selectedWeek: number
  onSelectAnomaly: (year: number, week: number) => void
  /** Si se proveen, se dibuja la gráfica de desviación semanal del año seleccionado */
  calendar?: CalendarResponse | null
  climatology?: ClimatologyResponse | null
}

const INITIAL_ROWS = 6
const MAX_ROWS = 15

const getSeverity = (zscore: number) => {
  if (zscore >= 3.5) return { label: 'Crítica', color: '#E53935' }
  if (zscore >= 2.5) return { label: 'Alta', color: '#FF7900' }
  return { label: 'Moderada', color: '#F5B301' }
}

export const AnomalyList: React.FC<AnomalyListProps> = ({
  anomalies,
  isLoading,
  selectedYear,
  selectedWeek,
  onSelectAnomaly,
  calendar = null,
  climatology = null,
}) => {
  const [onlySelectedYear, setOnlySelectedYear] = useState(false)
  const [expanded, setExpanded] = useState(false)

  // Desviación de cada semana respecto a su media histórica; las semanas inusuales vienen del backend
  const deviation = useMemo(() => {
    if (!calendar || !climatology) return null
    const means = new Map(climatology.weeks.map((c) => [c.week, c.mean]))
    const flagged = new Set(anomalies?.items.filter((a) => a.year === selectedYear).map((a) => a.week))
    const values = new Map(calendar.weeks.filter((w) => w.year === selectedYear).map((w) => [w.week, w.value]))
    return Array.from({ length: 52 }, (_, i) => {
      const week = i + 1
      const v = values.get(week)
      const m = means.get(week)
      const diff = v === undefined || m === undefined ? null : Math.round((v - m) * 10) / 10
      const color = flagged.has(week) ? '#E53935' : diff !== null && diff > 0 ? '#FFB37A' : '#CBD5E1'
      return { value: diff, itemStyle: { color, borderRadius: diff !== null && diff < 0 ? [0, 0, 3, 3] : [3, 3, 0, 0] } }
    })
  }, [calendar, climatology, anomalies, selectedYear])

  if (isLoading || !anomalies) {
    return (
      <div className="bg-white rounded-[32px] border border-slate-200/70 p-7 sm:p-10 space-y-3">
        <div className="h-5 w-48 bg-slate-200 rounded-md animate-pulse" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 w-full bg-[#F4F6F9] rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  const allItems = anomalies.items || []
  const filtered = onlySelectedYear
    ? allItems.filter((item) => item.year === selectedYear)
    : allItems.slice(0, MAX_ROWS)
  const visible = expanded ? filtered : filtered.slice(0, INITIAL_ROWS)

  const scopeButton = (active: boolean) =>
    `px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors duration-250 ${active ? 'bg-[#0B1B3D] text-white' : 'text-slate-500 hover:text-[#0B1B3D]'
    }`

  return (
    <div className="bg-white rounded-[32px] border border-slate-200/70 p-7 sm:p-10">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#FF7900]">Periodos inusuales</p>
          <h3 className="mt-2 text-2xl font-black tracking-tight text-[#0B1B3D]">Semanas con anomalía térmica</h3>
          <p className="mt-1 text-sm text-slate-500">Ordenadas por desviación z-score (≥ 1.6σ).</p>
        </div>

        <div className="self-start sm:self-auto inline-flex p-1 rounded-full border border-slate-200">
          <button type="button" onClick={() => setOnlySelectedYear(false)} className={scopeButton(!onlySelectedYear)}>
            Toda la serie
          </button>
          <button type="button" onClick={() => setOnlySelectedYear(true)} className={scopeButton(onlySelectedYear)}>
            {selectedYear}
          </button>
        </div>
      </div>

      {/* Gráfica de desviación semanal */}
      {deviation && (
        <div className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>
              Diferencia frente a la media de cada semana · <strong className="text-[#0B1B3D]">{selectedYear}</strong>
            </span>
            <span className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#E53935]" /> Inusual
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#FFB37A]" /> Sobre la media
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#CBD5E1]" /> Bajo la media
              </span>
            </span>
          </div>
          <div className="w-full h-[190px]">
            <ReactECharts
              option={{
                tooltip: {
                  trigger: 'axis',
                  backgroundColor: 'rgba(11, 27, 61, 0.96)',
                  borderWidth: 0,
                  textStyle: { color: '#ffffff', fontSize: 12 },
                  formatter: (p: Array<{ dataIndex: number; value: number | null }>) =>
                    p?.length
                      ? `${formatWeekFriendly(selectedYear, p[0].dataIndex + 1)}<br/><b>${p[0].value === null ? '—' : `${p[0].value > 0 ? '+' : ''}${p[0].value}`
                      }</b> fcd vs media`
                      : '',
                },
                grid: { top: 12, left: 40, right: 8, bottom: 24 },
                xAxis: {
                  type: 'category',
                  data: Array.from({ length: 52 }, (_, i) => `S${i + 1}`),
                  axisLabel: { interval: 7, fontSize: 11, color: '#94a3b8' },
                  axisLine: { lineStyle: { color: '#e2e8f0' } },
                  axisTick: { show: false },
                },
                yAxis: {
                  type: 'value',
                  axisLabel: { fontSize: 11, color: '#94a3b8' },
                  splitLine: { lineStyle: { color: '#f1f5f9' } },
                },
                series: [{ type: 'bar', data: deviation, barCategoryGap: '25%' }],
              }}
              style={{ height: '100%', width: '100%' }}
              opts={{ renderer: 'canvas' }}
              onEvents={{
                click: (p: { dataIndex: number }) => onSelectAnomaly(selectedYear, p.dataIndex + 1),
              }}
            />
          </div>
        </div>
      )}

      {/* Lista */}
      {filtered.length === 0 ? (
        <p className="mt-8 py-8 text-center text-sm text-slate-400">
          No se registraron anomalías para los filtros seleccionados.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-slate-400">
                <th className="py-3 pr-4 font-medium">Periodo</th>
                <th className="py-3 px-4 font-medium">Actividad</th>
                <th className="py-3 px-4 font-medium">Z-score</th>
                <th className="py-3 px-4 font-medium hidden sm:table-cell">Percentil</th>
                <th className="py-3 px-4 font-medium">Severidad</th>
                <th className="py-3 pl-4" aria-label="Acción" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 border-t border-slate-100">
              {visible.map((item) => {
                const isSelected = item.year === selectedYear && item.week === selectedWeek
                const severity = getSeverity(item.zscore)

                return (
                  <tr
                    key={`${item.year}-${item.week}`}
                    onClick={() => onSelectAnomaly(item.year, item.week)}
                    className={`group cursor-pointer transition-colors ${isSelected ? 'bg-[#FFF8F2]' : 'hover:bg-[#F8FAFC]'
                      }`}
                  >
                    <td className="py-4 pr-4">
                      <span className="font-extrabold text-[#0B1B3D]">{item.year}</span>
                      <span className="ml-2 text-slate-500">{formatWeekFriendly(item.year, item.week)}</span>
                    </td>
                    <td className="py-4 px-4 font-bold text-[#0B1B3D] whitespace-nowrap">
                      {item.value} <span className="text-xs font-normal text-slate-400">fcd</span>
                    </td>
                    <td className="py-4 px-4 font-black text-[#E53935] whitespace-nowrap">
                      +{item.zscore.toFixed(2)}σ
                    </td>
                    <td className="py-4 px-4 text-slate-500 hidden sm:table-cell">P{item.percentile}</td>
                    <td className="py-4 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-2 text-slate-600">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: severity.color }} />
                        {severity.label}
                      </span>
                    </td>
                    <td className="py-4 pl-4 text-right text-[#FF7900] font-bold whitespace-nowrap">
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity text-xs mr-1">
                        Ver en mapa
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {filtered.length > INITIAL_ROWS && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="mt-5 text-sm font-bold text-[#FF7900] hover:text-[#E66D00] transition-colors"
            >
              {expanded ? 'Mostrar menos' : `Mostrar ${filtered.length - INITIAL_ROWS} más`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
