import React, { useCallback, useMemo, useRef } from 'react'
import ReactECharts from 'echarts-for-react'
import { Download, Play, Pause } from 'lucide-react'
import type { CalendarResponse, SourceType } from '../types'
import { ChartSkeleton } from './SkeletonLoader'
import { exportChartToPNG } from '../utils/exportUtils'
import { formatWeekFriendly } from '../utils/dateUtils'
import { useTimeline } from '../hooks/useTimeline'

const VIIRS_START_YEAR = 2012

interface FireCalendarProps {
  calendar: CalendarResponse | null
  isLoading: boolean
  selectedYear: number
  selectedWeek: number
  onSelectWeek: (year: number, week: number) => void
}

export const FireCalendar: React.FC<FireCalendarProps> = ({
  calendar,
  isLoading,
  selectedYear,
  selectedWeek,
  onSelectWeek,
}) => {
  const chartRef = useRef<ReactECharts>(null)

  const { years, weeks, heatmapData, sourceLookup, maxValue } = useMemo(() => {
    if (!calendar || calendar.weeks.length === 0) {
      return { years: [] as number[], weeks: [] as number[], heatmapData: [] as [number, number, number][], sourceLookup: new Map<string, SourceType>(), maxValue: 100 }
    }

    const yearsSet = new Set<number>()
    const sourceMap = new Map<string, SourceType>()
    let max = 10

    calendar.weeks.forEach((item) => {
      yearsSet.add(item.year)
      sourceMap.set(`${item.year}-${item.week}`, item.source)
      if (item.value > max) max = item.value
    })

    // Años de 2001 a 2025
    const sortedYears = Array.from(yearsSet).sort((a, b) => a - b)
    const weeksList = Array.from({ length: 52 }, (_, i) => i + 1)

    const data: [number, number, number][] = []

    calendar.weeks.forEach((item) => {
      const yIndex = sortedYears.indexOf(item.year)
      const xIndex = item.week - 1
      if (yIndex !== -1 && xIndex >= 0 && xIndex < 52) {
        data.push([xIndex, yIndex, item.value])
      }
    })

    return {
      years: sortedYears,
      weeks: weeksList,
      heatmapData: data,
      sourceLookup: sourceMap,
      maxValue: Math.ceil(max),
    }
  }, [calendar])

  // Reproductor del calendario: recorre las semanas del año seleccionado
  const handleWeekChange = useCallback((week: number) => onSelectWeek(selectedYear, week), [onSelectWeek, selectedYear])
  const { isPlaying, speed, togglePlay, setSpeed, setWeek } = useTimeline(selectedWeek, handleWeekChange, 52)

  if (!calendar && isLoading) {
    return <ChartSkeleton height="h-96" />
  }

  // Configuración del Heatmap idéntica a la captura
  const option = {
    tooltip: {
      position: 'top',
      backgroundColor: '#071C3A',
      borderColor: '#FF7900',
      borderWidth: 1.5,
      padding: [10, 14],
      textStyle: { color: '#ffffff', fontSize: 12 },
      formatter: (params: { data: [number, number, number] }) => {
        const [wIndex, yIndex, value] = params.data
        const year = years[yIndex]
        const week = wIndex + 1
        const source = sourceLookup.get(`${year}-${week}`) || 'MODIS'

        const sourceLabels: Record<string, string> = {
          MODIS: 'MODIS (Terra/Aqua 1km)',
          BOTH: 'Armonizado (MODIS + VIIRS)',
          VIIRS_CAL: 'VIIRS Calibrado (375m)',
        }
        const sourceLabel = sourceLabels[source] || source

        return `
          <div style="font-family: inherit; line-height: 1.5;">
            <div style="font-weight: 800; color: #FF7900; font-size: 13px; margin-bottom: 4px;">
              Año ${year} — ${formatWeekFriendly(year, week)}
            </div>
            <div style="font-size: 12px; margin-bottom: 2px;">
              Actividad: <b style="color: #ffffff;">${value}</b> <span style="font-size: 11px; color: #94a3b8;">fire_cell_days</span>
            </div>
            <div style="font-size: 11px; color: #FFC107; margin-bottom: 4px;">
              Sensor: <b>${sourceLabel}</b>
            </div>
            <div style="font-size: 10px; color: #cbd5e1; border-top: 1px solid rgba(255,255,255,0.15); padding-top: 3px;">
              Clic para enfocar focos en el mapa
            </div>
          </div>
        `
      },
    },
    grid: {
      top: '10px',
      bottom: '64px',
      left: '46px',
      right: '96px',
    },
    xAxis: {
      type: 'category',
      data: weeks.map((w) => `S${w}`),
      splitArea: { show: false },
      axisLabel: {
        interval: 3,
        fontSize: 10,
        color: '#64748b',
        fontWeight: 'bold',
      },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'category',
      data: years.map(String),
      inverse: true, // 2025 en la parte superior, 2001 en la base como en el screenshot
      splitArea: { show: false },
      axisLabel: {
        fontSize: 10,
        color: '#64748b',
        fontWeight: 'bold',
        interval: 1, // Muestra años alternados (2025, 2023, 2021...) como en el screenshot
      },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    visualMap: {
      min: 0,
      max: maxValue,
      show: true,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      itemWidth: 10,
      itemHeight: 220,
      calculable: false,
      text: [`${maxValue} fcd`, '0'],
      textGap: 10,
      textStyle: { color: '#64748b', fontSize: 11, fontWeight: 'bold' },
      inRange: {
        color: ['#FFFFFF', '#FFF9E6', '#FFD54F', '#FF7900', '#E53935', '#071C3A'],
      },
    },
    series: [
      {
        name: 'Actividad Satelital',
        type: 'heatmap',
        data: heatmapData,
        label: { show: false },
        itemStyle: {
          borderWidth: 0.5,
          borderColor: '#ffffff',
        },
        // Inicio de la era VIIRS: desde aquí la serie combina ambos sensores armonizados
        markLine: years.includes(VIIRS_START_YEAR)
          ? {
              silent: true,
              symbol: 'none',
              lineStyle: { color: '#0B1B3D', width: 1.5, type: 'dashed' },
              label: {
                formatter: 'Inicio VIIRS',
                position: 'end',
                color: '#0B1B3D',
                fontSize: 11,
                fontWeight: 'bold',
              },
              data: [{ yAxis: String(VIIRS_START_YEAR) }],
            }
          : undefined,
        emphasis: {
          itemStyle: {
            borderColor: '#071C3A',
            borderWidth: 2,
            shadowBlur: 8,
            shadowColor: 'rgba(7, 28, 58, 0.4)',
          },
        },
      },
    ],
  }

  const handleChartClick = (params: { data: [number, number, number] }) => {
    if (params && params.data) {
      const [wIndex, yIndex] = params.data
      const year = years[yIndex]
      const week = wIndex + 1
      if (year && week) {
        onSelectWeek(year, week)
      }
    }
  }

  const handleExportPNG = () => {
    if (chartRef.current) {
      const instance = chartRef.current.getEchartsInstance()
      exportChartToPNG(instance, `brasa_calendario_incendios_${selectedYear}`)
    }
  }

  return (
    <div className="bg-white rounded-[28px] p-6 sm:p-7 border border-slate-200/70">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#FF7900]">Calendario de quema</p>
          <h3 className="mt-2 text-xl sm:text-2xl font-black tracking-tight text-[#0B1B3D]">
            Actividad semanal 2005–2025
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Cada celda es una semana en fire_cell_days. Haz clic para verla en el mapa.
          </p>
          <p className="mt-1 text-xs font-bold text-[#FF7900]">
            Seleccionada: {formatWeekFriendly(selectedYear, selectedWeek)} · {selectedYear}
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportPNG}
          className="self-start sm:self-auto inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-[#0B1B3D] rounded-full border border-slate-200 transition-colors duration-250 hover:bg-[#FFF8F2] hover:border-[#FF7900]/35"
          title="Descargar gráfico en PNG"
        >
          <Download className="w-3.5 h-3.5 text-[#FF7900]" />
          <span>PNG</span>
        </button>
      </div>

      <div className="mt-5 w-full h-[440px]">
        <ReactECharts
          ref={chartRef}
          option={option}
          style={{ height: '100%', width: '100%' }}
          onEvents={{ click: handleChartClick }}
          opts={{ renderer: 'canvas' }}
        />
      </div>

      {/* Reproductor */}
      <div className="mt-4 pt-5 border-t border-slate-100 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={togglePlay}
          className="w-10 h-10 shrink-0 rounded-full bg-[#0B1B3D] hover:bg-[#16437E] text-white flex items-center justify-center transition-colors"
          aria-label={isPlaying ? 'Pausar recorrido del calendario' : 'Reproducir recorrido del calendario'}
        >
          {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
        </button>

        <div className="flex-1 min-w-[180px]">
          <input
            type="range"
            min={1}
            max={52}
            value={selectedWeek}
            onChange={(e) => setWeek(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-[#0B1B3D]"
            aria-label="Semana del calendario"
          />
          <p className="mt-1.5 text-xs text-slate-400">
            Semana {selectedWeek} · {selectedYear}
          </p>
        </div>

        <div className="inline-flex p-1 rounded-full border border-slate-200">
          {[0.5, 1, 2].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSpeed(s)}
              className={`px-2.5 py-1 rounded-full text-xs font-bold transition-colors ${
                speed === s ? 'bg-[#0B1B3D] text-white' : 'text-slate-500 hover:text-[#0B1B3D]'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
