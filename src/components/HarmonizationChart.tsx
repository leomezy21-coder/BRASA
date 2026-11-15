import React, { useEffect, useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import type { BaseFilterParams, CalendarResponse, SensorType } from '../types'
import { fetchCalendar } from '../api/client'
import { useFilters } from '../hooks/useFilters'
import { ChartSkeleton } from './SkeletonLoader'

const VIIRS_START_YEAR = 2012
const OVERLAP: [number, number] = [2012, 2018]

type SeriesBySensor = Record<SensorType, CalendarResponse | null>

const annualTotals = (calendar: CalendarResponse | null): Map<number, number> => {
  const totals = new Map<number, number>()
  calendar?.weeks.forEach((w) => totals.set(w.year, (totals.get(w.year) ?? 0) + w.value))
  return totals
}

/**
 * Muestra por qué hace falta armonizar: totales anuales de MODIS y VIIRS sin ajustar
 * frente a la serie armonizada que usa BRASA.
 */
export const HarmonizationChart: React.FC = () => {
  const { filters } = useFilters()
  const [data, setData] = useState<SeriesBySensor>({ harmonized: null, modis: null, viirs: null })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const ac = new AbortController()
    const base: Omit<BaseFilterParams, 'sensor'> = {
      year_from: filters.yearRange[0],
      year_to: filters.yearRange[1],
      confidence: filters.confidence,
      daynight: filters.daynight,
      country_code: filters.countryCode || (filters.provinceId?.length === 3 ? filters.provinceId.toUpperCase() : 'ECU'),
      continent: filters.continent && filters.continent !== 'all' ? filters.continent : undefined,
      province_id: filters.provinceId,
      canton_id: filters.cantonId,
      geojson: filters.customGeometry?.geojson,
    }
    const sensors: SensorType[] = ['harmonized', 'modis', 'viirs']

    setIsLoading(true)
    setError(false)
    Promise.all(sensors.map((sensor) => fetchCalendar({ ...base, sensor }, ac.signal)))
      .then(([harmonized, modis, viirs]) => {
        setData({ harmonized, modis, viirs })
        setIsLoading(false)
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return
        setError(true)
        setIsLoading(false)
      })

    return () => ac.abort()
  }, [
    filters.countryCode,
    filters.country,
    filters.continent,
    filters.yearRange,
    filters.confidence,
    filters.daynight,
    filters.provinceId,
    filters.cantonId,
    filters.customGeometry?.geojson,
  ])

  const { years, modis, viirs, harmonized, ratio } = useMemo(() => {
    const h = annualTotals(data.harmonized)
    const m = annualTotals(data.modis)
    const v = annualTotals(data.viirs)
    const yrs = Array.from(h.keys()).sort((a, b) => a - b)
    const round = (n: number | undefined) => (n === undefined ? null : Math.round(n))

    // Relación VIIRS/MODIS en el periodo de solapamiento (lo que corrige la armonización)
    const overlapYears = yrs.filter((y) => y >= OVERLAP[0] && y <= OVERLAP[1])
    const sumV = overlapYears.reduce((acc, y) => acc + (v.get(y) ?? 0), 0)
    const sumM = overlapYears.reduce((acc, y) => acc + (m.get(y) ?? 0), 0)

    return {
      years: yrs,
      harmonized: yrs.map((y) => round(h.get(y))),
      modis: yrs.map((y) => round(m.get(y))),
      viirs: yrs.map((y) => (y >= VIIRS_START_YEAR ? round(v.get(y)) : null)),
      ratio: sumM > 0 ? sumV / sumM : null,
    }
  }, [data])

  const option = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(11, 27, 61, 0.96)',
      borderWidth: 0,
      textStyle: { color: '#ffffff', fontSize: 12 },
      valueFormatter: (v: number | null) => (v === null || v === undefined ? '—' : `${v.toLocaleString('es-EC')} fcd`),
    },
    legend: {
      data: ['Armonizado (BRASA)', 'MODIS sin ajustar', 'VIIRS sin ajustar'],
      bottom: 0,
      icon: 'roundRect',
      itemWidth: 14,
      itemHeight: 4,
      textStyle: { color: '#475569', fontSize: 12 },
    },
    grid: { top: 30, left: 56, right: 20, bottom: 48 },
    xAxis: {
      type: 'category',
      data: years.map(String),
      boundaryGap: false,
      axisLabel: { color: '#64748b', fontSize: 11, interval: 2 },
      axisLine: { lineStyle: { color: '#e2e8f0' } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      name: 'fcd / año',
      nameTextStyle: { color: '#94a3b8', fontSize: 11 },
      axisLabel: { color: '#64748b', fontSize: 11 },
      splitLine: { lineStyle: { color: '#f1f5f9' } },
    },
    series: [
      {
        name: 'MODIS sin ajustar',
        type: 'line',
        data: modis,
        symbol: 'none',
        lineStyle: { color: '#94A3B8', width: 1.5 },
        itemStyle: { color: '#94A3B8' },
        markArea: {
          silent: true,
          itemStyle: { color: 'rgba(11, 27, 61, 0.04)' },
          label: { color: '#64748b', fontSize: 11, position: 'insideTop' },
          data: [[{ name: 'Calibración', xAxis: String(OVERLAP[0]) }, { xAxis: String(OVERLAP[1]) }]],
        },
      },
      {
        name: 'VIIRS sin ajustar',
        type: 'line',
        data: viirs,
        symbol: 'none',
        lineStyle: { color: '#60A5FA', width: 1.5, type: 'dashed' },
        itemStyle: { color: '#60A5FA' },
      },
      {
        name: 'Armonizado (BRASA)',
        type: 'line',
        data: harmonized,
        symbol: 'circle',
        symbolSize: 5,
        lineStyle: { color: '#FF7900', width: 3 },
        itemStyle: { color: '#FF7900' },
      },
    ],
  }

  return (
    <div className="bg-white rounded-[28px] p-6 sm:p-7 border border-slate-200/70">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#FF7900]">Comparación de Sensores</p>
          <h3 className="mt-2 text-xl sm:text-2xl font-black tracking-tight text-[#0B1B3D]">
            Respuesta Instrumental: MODIS vs VIIRS
          </h3>
          <p className="mt-1 max-w-xl text-sm text-slate-500">
            MODIS (1 km) y VIIRS (375 m) tienen diferentes capacidades de detección. La agregación por fire_cell_days a 1° unifica la presencia diaria y el período de solapamiento {OVERLAP[0]}–{OVERLAP[1]} evidencia la mayor sensibilidad de VIIRS para evitar conclusiones distorsionadas.
          </p>
        </div>
        {ratio !== null && (
          <div className="sm:text-right">
            <p className="text-xs text-slate-400">Ratio observacional VIIRS / MODIS {OVERLAP[0]}–{OVERLAP[1]}</p>
            <p className="text-2xl font-black tracking-tight text-[#0B1B3D]">×{ratio.toFixed(1)}</p>
            <p className="text-[11px] text-slate-400 font-medium">Sensibilidad de detección</p>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="mt-5">
          <ChartSkeleton height="h-72" />
        </div>
      ) : error ? (
        <p className="mt-8 py-10 text-center text-sm text-slate-400">No se pudo cargar la comparación por sensor.</p>
      ) : (
        <div className="mt-5 w-full h-[320px]">
          <ReactECharts option={option} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'canvas' }} />
        </div>
      )}
    </div>
  )
}
