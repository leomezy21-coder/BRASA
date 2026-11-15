import React, { useMemo, useRef, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { Download } from 'lucide-react'
import { useBrasaData } from '../hooks/useBrasaData'
import { useFilters } from '../hooks/useFilters'
import { exportChartToPNG } from '../utils/exportUtils'
import { formatWeekFriendly } from '../utils/dateUtils'
import { ChartSkeleton } from '../components/SkeletonLoader'
import { MONTHS_SHORT, monthlyHistoricalMean, monthlyTotals } from '../utils/monthly'
import { getProvincesForCountry } from '../utils/territoryData'

const COLOR_A = '#E53935'
const COLOR_B = '#0B1B3D'
const WEEKS = Array.from({ length: 52 }, (_, i) => `S${i + 1}`)

const TOOLTIP = {
  trigger: 'axis',
  backgroundColor: 'rgba(11, 27, 61, 0.96)',
  borderWidth: 0,
  textStyle: { color: '#ffffff', fontSize: 12 },
}

const AXIS_X = {
  type: 'category',
  boundaryGap: false,
  axisLabel: { interval: 3, fontSize: 11, color: '#64748b' },
  axisLine: { lineStyle: { color: '#e2e8f0' } },
  axisTick: { show: false },
}

const AXIS_Y = {
  type: 'value',
  axisLabel: { fontSize: 11, color: '#64748b' },
  splitLine: { lineStyle: { color: '#f1f5f9' } },
}

const LEGEND = {
  bottom: 0,
  icon: 'roundRect',
  itemWidth: 14,
  itemHeight: 4,
  textStyle: { color: '#475569', fontSize: 12 },
}

/* "+3 sem.", "−2 sem." o "igual" */
const weekDelta = (a?: number, b?: number) => {
  if (a === undefined || b === undefined) return '—'
  const d = a - b
  if (d === 0) return 'Igual'
  return `${d > 0 ? '+' : '−'}${Math.abs(d)} sem.`
}

const Card: React.FC<{ eyebrow: string; title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode }> = ({
  eyebrow,
  title,
  subtitle,
  action,
  children,
}) => (
  <section className="bg-white rounded-[28px] p-6 sm:p-7 border border-slate-200/70">
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#FF7900]">{eyebrow}</p>
        <h2 className="mt-2 text-xl sm:text-2xl font-black tracking-tight text-[#0B1B3D]">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
    <div className="mt-5">{children}</div>
  </section>
)

export const Compare: React.FC = () => {
  const { filters } = useFilters()
  const { calendar, climatology, season, isLoading, regions } = useBrasaData()

  const [yearA, setYearA] = useState<number>(2024)
  const [yearB, setYearB] = useState<number>(2012)
  const [curveView, setCurveView] = useState<'semanal' | 'acumulado'>('semanal')
  const weeklyRef = useRef<ReactECharts>(null)

  const availableProvinces = getProvincesForCountry(filters.country)
  const selectedRegion =
    availableProvinces.find((r) => r.id === filters.provinceId) ||
    regions?.find((r) => r.id === filters.provinceId) ||
    availableProvinces[0]

  const seasonYears = useMemo(() => [...(season?.years ?? [])].sort((a, b) => a.year - b.year), [season])
  const availableYears = useMemo(() => {
    const fromSeason = seasonYears.map((y) => y.year)
    const fullRange = Array.from({ length: 21 }, (_, i) => 2005 + i)
    return Array.from(new Set([...fromSeason, ...fullRange])).sort((a, b) => b - a)
  }, [seasonYears])

  const seasonA = season?.years.find((y) => y.year === yearA)
  const seasonB = season?.years.find((y) => y.year === yearB)

  const { curveA, curveB, meanCurve, p10Curve, bandCurve, cumA, cumB, cumMean } = useMemo(() => {
    const empty = { curveA: [], curveB: [], meanCurve: [], p10Curve: [], bandCurve: [], cumA: [], cumB: [], cumMean: [] }
    if (!calendar || !climatology) return empty

    const byYear = (year: number) =>
      new Map(calendar.weeks.filter((w) => w.year === year).map((item) => [item.week, item.value]))
    const mapA = byYear(yearA)
    const mapB = byYear(yearB)
    const climMap = new Map(climatology.weeks.map((c) => [c.week, c]))

    const cA: (number | null)[] = []
    const cB: (number | null)[] = []
    const mean: (number | null)[] = []
    const p10: (number | null)[] = []
    const band: (number | null)[] = []
    const accA: (number | null)[] = []
    const accB: (number | null)[] = []
    const accM: (number | null)[] = []
    let sumA = 0
    let sumB = 0
    let sumM = 0

    for (let w = 1; w <= 52; w++) {
      // Sin dato = hueco en la línea (null), nunca un cero falso
      const a = mapA.get(w)
      const b = mapB.get(w)
      const c = climMap.get(w)
      cA.push(a ?? null)
      cB.push(b ?? null)
      mean.push(c?.mean ?? null)
      p10.push(c?.p10 ?? null)
      band.push(c ? Math.max(0, c.p90 - c.p10) : null)

      if (a !== undefined) sumA += a
      if (b !== undefined) sumB += b
      if (c) sumM += c.mean
      accA.push(a !== undefined ? Math.round(sumA) : null)
      accB.push(b !== undefined ? Math.round(sumB) : null)
      accM.push(c ? Math.round(sumM) : null)
    }

    return { curveA: cA, curveB: cB, meanCurve: mean, p10Curve: p10, bandCurve: band, cumA: accA, cumB: accB, cumMean: accM }
  }, [calendar, climatology, yearA, yearB])

  const monthly = useMemo(
    () => ({
      a: monthlyTotals(calendar, yearA).map((v) => (v === null ? null : Math.round(v))),
      b: monthlyTotals(calendar, yearB).map((v) => (v === null ? null : Math.round(v))),
      mean: monthlyHistoricalMean(calendar).map((v) => (v === null ? null : Math.round(v))),
    }),
    [calendar, yearA, yearB]
  )

  const totalA = seasonA?.total ?? 0
  const totalB = seasonB?.total ?? 0
  const diffPercent = totalB > 0 ? Math.round(((totalA - totalB) / totalB) * 100) : 0
  const durationA = seasonA ? seasonA.end_week - seasonA.start_week : undefined
  const durationB = seasonB ? seasonB.end_week - seasonB.start_week : undefined

  /* 1. Totales anuales: contexto para elegir años */
  const annualOption = {
    tooltip: { ...TOOLTIP, valueFormatter: (v: number) => `${Math.round(v).toLocaleString('es-EC')} fcd` },
    grid: { top: 10, left: 50, right: 10, bottom: 28 },
    xAxis: { ...AXIS_X, boundaryGap: true, data: seasonYears.map((y) => String(y.year)), axisLabel: { ...AXIS_X.axisLabel, interval: 1 } },
    yAxis: AXIS_Y,
    series: [
      {
        name: 'Total anual',
        type: 'bar',
        barWidth: '62%',
        data: seasonYears.map((y) => ({
          value: Math.round(y.total),
          itemStyle: {
            color: y.year === yearA ? COLOR_A : y.year === yearB ? COLOR_B : '#E2E8F0',
            borderRadius: [6, 6, 0, 0],
          },
        })),
      },
    ],
  }

  /* 2. Actividad mensual frente al promedio histórico */
  const monthlyOption = {
    tooltip: { ...TOOLTIP, valueFormatter: (v: number | null) => (v === null ? '—' : `${v.toLocaleString('es-EC')} fcd`) },
    legend: { ...LEGEND, data: [String(yearA), String(yearB), 'Promedio 2005–2025'] },
    grid: { top: 16, left: 52, right: 16, bottom: 44 },
    xAxis: { ...AXIS_X, boundaryGap: true, data: MONTHS_SHORT, axisLabel: { ...AXIS_X.axisLabel, interval: 0 } },
    yAxis: AXIS_Y,
    series: [
      { name: String(yearA), type: 'bar', data: monthly.a, barGap: '10%', barMaxWidth: 18, itemStyle: { color: COLOR_A, borderRadius: [4, 4, 0, 0] } },
      { name: String(yearB), type: 'bar', data: monthly.b, barMaxWidth: 18, itemStyle: { color: COLOR_B, borderRadius: [4, 4, 0, 0] } },
      {
        name: 'Promedio 2005–2025',
        type: 'line',
        data: monthly.mean,
        symbol: 'circle',
        symbolSize: 5,
        lineStyle: { color: '#94A3B8', width: 1.5, type: 'dashed' },
        itemStyle: { color: '#94A3B8' },
      },
    ],
  }

  /* 3. Curvas semanales con rango típico */
  const weeklyOption = {
    tooltip: {
      ...TOOLTIP,
      formatter: (params: Array<{ dataIndex: number }>) => {
        if (!params?.length) return ''
        const i = params[0].dataIndex
        const fmt = (v: number | null) => (v === null ? '—' : v)
        return `
          <div style="line-height:1.6">
            <div style="font-weight:800;color:#FF7900">${formatWeekFriendly(yearA, i + 1)}</div>
            <div><span style="color:#FCA5A5">${yearA}:</span> <b>${fmt(curveA[i])}</b> fcd</div>
            <div><span style="color:#93C5FD">${yearB}:</span> <b>${fmt(curveB[i])}</b> fcd</div>
            <div style="color:#cbd5e1;font-size:11px">Media: ${fmt(meanCurve[i])}</div>
          </div>`
      },
    },
    legend: { ...LEGEND, data: [String(yearA), String(yearB), 'Media', 'Rango P10–P90'] },
    grid: { top: 16, left: 44, right: 16, bottom: 44 },
    xAxis: { ...AXIS_X, data: WEEKS },
    yAxis: AXIS_Y,
    series: [
      { name: 'P10', type: 'line', data: p10Curve, stack: 'band', symbol: 'none', lineStyle: { opacity: 0 }, silent: true },
      {
        name: 'Rango P10–P90',
        type: 'line',
        data: bandCurve,
        stack: 'band',
        symbol: 'none',
        lineStyle: { opacity: 0 },
        areaStyle: { color: 'rgba(255, 121, 0, 0.12)' },
        itemStyle: { color: 'rgba(255, 121, 0, 0.35)' },
        silent: true,
      },
      { name: 'Media', type: 'line', data: meanCurve, symbol: 'none', lineStyle: { color: '#94A3B8', width: 1.5, type: 'dashed' }, itemStyle: { color: '#94A3B8' } },
      { name: String(yearB), type: 'line', data: curveB, symbol: 'none', lineStyle: { color: COLOR_B, width: 2.5 }, itemStyle: { color: COLOR_B } },
      { name: String(yearA), type: 'line', data: curveA, symbol: 'none', lineStyle: { color: COLOR_A, width: 2.5 }, itemStyle: { color: COLOR_A } },
    ],
  }

  /* 4. Acumulado: qué temporada se adelanta */
  const cumulativeOption = {
    tooltip: { ...TOOLTIP, valueFormatter: (v: number | null) => (v === null ? '—' : `${v.toLocaleString('es-EC')} fcd`) },
    legend: { ...LEGEND, data: [String(yearA), String(yearB), 'Media'] },
    grid: { top: 16, left: 52, right: 16, bottom: 44 },
    xAxis: { ...AXIS_X, data: WEEKS },
    yAxis: AXIS_Y,
    series: [
      { name: 'Media', type: 'line', data: cumMean, symbol: 'none', lineStyle: { color: '#94A3B8', width: 1.5, type: 'dashed' }, itemStyle: { color: '#94A3B8' } },
      { name: String(yearB), type: 'line', data: cumB, symbol: 'none', lineStyle: { color: COLOR_B, width: 2.5 }, itemStyle: { color: COLOR_B } },
      {
        name: String(yearA),
        type: 'line',
        data: cumA,
        symbol: 'none',
        lineStyle: { color: COLOR_A, width: 2.5 },
        itemStyle: { color: COLOR_A },
        areaStyle: { color: 'rgba(229, 57, 53, 0.06)' },
      },
    ],
  }

  const handleExportPNG = () => {
    const instance = weeklyRef.current?.getEchartsInstance()
    if (instance) exportChartToPNG(instance, `brasa_comparativa_${yearA}_vs_${yearB}`)
  }

  const yearSelect = (value: number, onChange: (y: number) => void, color: string, label: string) => (
    <label className="inline-flex items-center gap-2 pl-4 pr-2 py-1.5 rounded-full border border-slate-200 bg-white">
      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="bg-transparent text-sm font-black text-[#0B1B3D] pr-1 focus:outline-hidden cursor-pointer"
      >
        {availableYears.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </label>
  )

  const rows = [
    {
      label: 'Total acumulado',
      a: `${Math.round(totalA).toLocaleString('es-EC')} fcd`,
      b: `${Math.round(totalB).toLocaleString('es-EC')} fcd`,
      diff: `${diffPercent > 0 ? '+' : ''}${diffPercent}%`,
    },
    { label: 'Inicio de temporada', a: `Sem. ${seasonA?.start_week ?? '—'}`, b: `Sem. ${seasonB?.start_week ?? '—'}`, diff: weekDelta(seasonA?.start_week, seasonB?.start_week) },
    { label: 'Semana pico', a: `Sem. ${seasonA?.peak_week ?? '—'}`, b: `Sem. ${seasonB?.peak_week ?? '—'}`, diff: weekDelta(seasonA?.peak_week, seasonB?.peak_week) },
    { label: 'Fin de temporada', a: `Sem. ${seasonA?.end_week ?? '—'}`, b: `Sem. ${seasonB?.end_week ?? '—'}`, diff: weekDelta(seasonA?.end_week, seasonB?.end_week) },
    { label: 'Duración', a: durationA !== undefined ? `${durationA} sem.` : '—', b: durationB !== undefined ? `${durationB} sem.` : '—', diff: weekDelta(durationA, durationB) },
  ]

  return (
    <div className="py-10 sm:py-12 px-4 sm:px-6 lg:px-8 max-w-[1400px] mx-auto space-y-6 text-[#0B1B3D]">
      {/* Encabezado */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#FF7900]">Análisis histórico</p>
          <h1 className="mt-3 text-4xl sm:text-5xl font-black tracking-tight leading-none">Año contra año</h1>
          <p className="mt-3 text-slate-500">{selectedRegion?.name || 'Ecuador'}</p>
        </div>
        <div className="flex items-center gap-3">
          {yearSelect(yearA, setYearA, COLOR_A, 'Año A')}
          <span className="text-sm font-bold text-slate-300">vs</span>
          {yearSelect(yearB, setYearB, COLOR_B, 'Año B')}
        </div>
      </header>

      {isLoading ? (
        <ChartSkeleton height="h-80" />
      ) : (
        <>
          <Card
            eyebrow="Contexto"
            title="Total anual 2005–2025"
            subtitle="Clic en una barra para usarla como año A."
          >
            <div className="w-full h-[220px]">
              <ReactECharts
                option={annualOption}
                style={{ height: '100%', width: '100%' }}
                opts={{ renderer: 'canvas' }}
                onEvents={{
                  click: (p: { dataIndex: number }) => {
                    const y = seasonYears[p.dataIndex]?.year
                    if (y) setYearA(y)
                  },
                }}
              />
            </div>
          </Card>

          <Card
            eyebrow="Mes a mes"
            title={`${yearA} y ${yearB} frente al promedio`}
            subtitle="Meses aproximados a partir de semanas ISO."
          >
            <div className="w-full h-[300px]">
              <ReactECharts option={monthlyOption} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'canvas' }} />
            </div>
          </Card>

          <Card
            eyebrow="Semana a semana"
            title={curveView === 'semanal' ? `${yearA} vs ${yearB}` : '¿Qué temporada se adelantó?'}
            subtitle={
              curveView === 'semanal'
                ? 'La banda naranja es el rango típico (P10–P90).'
                : 'Suma de fire_cell_days a lo largo del año.'
            }
            action={
              <div className="self-start sm:self-auto flex items-center gap-2">
                <div className="inline-flex p-1 rounded-full border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setCurveView('semanal')}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
                      curveView === 'semanal' ? 'bg-[#0B1B3D] text-white' : 'text-slate-500 hover:text-[#0B1B3D]'
                    }`}
                  >
                    Semanal
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurveView('acumulado')}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
                      curveView === 'acumulado' ? 'bg-[#0B1B3D] text-white' : 'text-slate-500 hover:text-[#0B1B3D]'
                    }`}
                  >
                    Acumulado
                  </button>
                </div>
                {curveView === 'semanal' && (
                  <button
                    type="button"
                    onClick={handleExportPNG}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-full border border-slate-200 transition-colors duration-250 hover:bg-[#FFF8F2] hover:border-[#FF7900]/35"
                  >
                    <Download className="w-3.5 h-3.5 text-[#FF7900]" />
                    <span>PNG</span>
                  </button>
                )}
              </div>
            }
          >
            <div className="w-full h-[360px]">
              {curveView === 'semanal' ? (
                <ReactECharts ref={weeklyRef} option={weeklyOption} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'canvas' }} />
              ) : (
                <ReactECharts option={cumulativeOption} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'canvas' }} />
              )}
            </div>
          </Card>

          <Card eyebrow="Métricas de temporada" title="Diferencias clave">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs text-slate-400">
                    <th className="py-3 pr-4 font-medium">Parámetro</th>
                    <th className="py-3 px-4 font-bold" style={{ color: COLOR_A }}>{yearA}</th>
                    <th className="py-3 px-4 font-bold" style={{ color: COLOR_B }}>{yearB}</th>
                    <th className="py-3 pl-4 font-medium text-right">Diferencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 border-t border-slate-100">
                  {rows.map((r) => (
                    <tr key={r.label}>
                      <td className="py-4 pr-4 text-slate-500">{r.label}</td>
                      <td className="py-4 px-4 font-bold">{r.a}</td>
                      <td className="py-4 px-4 font-bold">{r.b}</td>
                      <td className="py-4 pl-4 font-black text-right">{r.diff}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
