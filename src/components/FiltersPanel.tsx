import React, { useState } from 'react'
import {
  Filter,
  RotateCcw,
  Search,
  ChevronDown,
} from 'lucide-react'
import { useFilters } from '../hooks/useFilters'
import type { RegionsResponse, SensorType, ConfidenceLevel, DayNight } from '../types'
import { COUNTRIES, CONTINENTS, getCountriesForContinent, getCitiesForCountry } from '../utils/territoryData'
import { MONTHS_LONG, MONTHS_SHORT, weekToMonth, firstWeekOfMonth } from '../utils/monthly'

interface FiltersPanelProps {
  regions: RegionsResponse | null
  onTriggerDrawCircle?: (radiusMeters: number) => void
  onTriggerDrawPolygon?: () => void
  className?: string
}

export const FiltersPanel: React.FC<FiltersPanelProps> = ({
  regions,
  onTriggerDrawCircle,
  onTriggerDrawPolygon,
  className = '',
}) => {
  const {
    filters,
    selectedWeek,
    setSelectedWeek,
    setContinent,
    setCountry,
    setCantonId,
    setYearRange,
    setSelectedYear,
    setSensor,
    setConfidence,
    setDayNight,
    resetFilters,
    triggerAnalyze,
  } = useFilters()

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState<boolean>(false)

  const currentMonth = weekToMonth(filters.selectedYear, selectedWeek)
  const filteredCountries = getCountriesForContinent(filters.continent)
  const availableCities = getCitiesForCountry(filters.country)
  const selectedCity = availableCities.find((c) => c.id === filters.cantonId)

  const content = (
    <div className="space-y-4 text-xs font-sans">
      {/* 1. Header con icono y botón de restablecer */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2 font-bold text-[#0B2D5B] text-sm">
          <Filter className="w-4 h-4 text-[#FF7900]" />
          <span>Filtros de Análisis</span>
        </div>
        <button
          type="button"
          onClick={resetFilters}
          className="text-[11px] font-semibold text-slate-400 hover:text-[#0B2D5B] flex items-center gap-1 transition-colors px-1.5 py-0.5 rounded-md hover:bg-slate-100"
          title="Restablecer filtros a valores iniciales"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Restablecer</span>
        </button>
      </div>

      {/* 2. Ubicación territorial: Continente, País y Ciudad */}
      <div className="space-y-3">
        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
          UBICACIÓN TERRITORIAL
        </label>

        {/* Filtro de Continente */}
        <div>
          <label htmlFor="continent-select" className="text-xs text-slate-400 font-medium block mb-1">
            Continente
          </label>
          <div className="relative">
            <select
              id="continent-select"
              value={filters.continent || ''}
              onChange={(e) => setContinent(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 pr-7 text-xs font-bold text-[#0B2D5B] focus:ring-1 focus:ring-[#FF7900] focus:outline-hidden appearance-none shadow-2xs cursor-pointer"
            >
              <option value="">(Todos los continentes)</option>
              {CONTINENTS.map((cont) => (
                <option key={cont} value={cont}>
                  {cont}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Filtro de País */}
        <div>
          <label htmlFor="country-select" className="text-xs text-slate-400 font-medium block mb-1">
            País ({filteredCountries.length} disponibles)
          </label>
          <div className="relative">
            <select
              id="country-select"
              value={filters.country}
              onChange={(e) => {
                const c = filteredCountries.find((item) => item.code === e.target.value) || COUNTRIES.find((item) => item.code === e.target.value)
                setCountry(
                  e.target.value,
                  c?.name.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ ]/g, '').trim(),
                  c ? [c.lat, c.lon] : undefined
                )
              }}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 pr-7 text-xs font-bold text-[#0B2D5B] focus:ring-1 focus:ring-[#FF7900] focus:outline-hidden appearance-none shadow-2xs cursor-pointer"
            >
              {filteredCountries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        <div>
          <label htmlFor="city-select" className="text-xs text-slate-400 font-medium block mb-1">
            Ciudad / Cantón ({availableCities.length} disponibles)
          </label>
          <div className="relative">
            <select
              id="city-select"
              value={filters.cantonId}
              onChange={(e) => {
                const selectedId = e.target.value
                if (!selectedId) {
                  const c = COUNTRIES.find((item) => item.code === filters.country)
                  setCantonId('', c ? [c.lat, c.lon] : undefined)
                } else {
                  const city = availableCities.find((item) => item.id === selectedId)
                  setCantonId(selectedId, city ? [city.lat, city.lon] : undefined)
                }
              }}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 pr-7 text-xs font-bold text-slate-700 focus:ring-1 focus:ring-[#FF7900] focus:outline-hidden appearance-none shadow-2xs cursor-pointer"
            >
              <option value="">(Todo el país / Todas las ciudades)</option>
              {availableCities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* 3. Período histórico */}
      <div className="space-y-2 pt-1 border-t border-slate-100">
        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
          PERÍODO HISTÓRICO
        </label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-xs text-slate-400 font-medium block mb-1">Desde</span>
            <div className="relative">
              <select
                value={filters.yearRange[0]}
                onChange={(e) => {
                  const newFrom = Number(e.target.value)
                  const newTo = Math.max(newFrom, filters.yearRange[1])
                  setYearRange([newFrom, newTo])
                }}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 pr-7 text-xs font-bold text-slate-700 shadow-2xs appearance-none cursor-pointer"
              >
                {Array.from({ length: 21 }, (_, i) => 2005 + i).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
          <div>
            <span className="text-xs text-slate-400 font-medium block mb-1">Hasta</span>
            <div className="relative">
              <select
                value={filters.yearRange[1]}
                onChange={(e) => {
                  const newTo = Number(e.target.value)
                  const newFrom = Math.min(newTo, filters.yearRange[0])
                  setYearRange([newFrom, newTo])
                }}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 pr-7 text-xs font-bold text-slate-700 shadow-2xs appearance-none cursor-pointer"
              >
                {Array.from({ length: 21 }, (_, i) => 2005 + i).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="selected-year-select" className="text-xs text-slate-400 font-medium block mb-1">
            Año en foco (mapa y gráficos)
          </label>
          <div className="relative">
            <select
              id="selected-year-select"
              value={filters.selectedYear}
              onChange={(e) => {
                const y = Number(e.target.value)
                setSelectedYear(y)
                // Asegurar que el rango histórico cubra el año seleccionado
                if (y < filters.yearRange[0]) {
                  setYearRange([y, filters.yearRange[1]])
                } else if (y > filters.yearRange[1]) {
                  setYearRange([filters.yearRange[0], y])
                }
              }}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 pr-7 text-xs font-black text-slate-800 shadow-2xs appearance-none cursor-pointer"
            >
              {Array.from({ length: 21 }, (_, i) => 2005 + i).map((y) => (
                <option key={y} value={y}>
                  {y}{y === 2024 || y === 2012 ? ' · temporada crítica' : ''}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Filtro de Mes */}
        <div>
          <label htmlFor="selected-month-select" className="text-xs text-slate-400 font-medium block mb-1">
            Mes en foco
          </label>
          <div className="relative">
            <select
              id="selected-month-select"
              value={currentMonth}
              onChange={(e) => {
                const m = Number(e.target.value)
                setSelectedWeek(firstWeekOfMonth(filters.selectedYear, m))
              }}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 pr-7 text-xs font-black text-slate-800 shadow-2xs appearance-none cursor-pointer"
            >
              {MONTHS_LONG.map((name, idx) => (
                <option key={name} value={idx}>
                  {name} {idx === 8 || idx === 7 ? '· temporada seca' : ''}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Cuadrícula interactiva de 12 meses idéntica al diseño anterior */}
          <div className="grid grid-cols-6 gap-1 mt-2">
            {MONTHS_SHORT.map((mShort, idx) => {
              const isSelected = currentMonth === idx
              return (
                <button
                  key={mShort}
                  type="button"
                  onClick={() => setSelectedWeek(firstWeekOfMonth(filters.selectedYear, idx))}
                  className={`py-1.5 text-[11px] rounded-lg font-bold transition-all text-center ${
                    isSelected
                      ? 'bg-[#0B2D5B] text-white shadow-2xs'
                      : 'bg-slate-50 text-slate-600 hover:bg-orange-50 hover:text-[#FF7900] border border-slate-200/60'
                  }`}
                  title={`${MONTHS_LONG[idx]} ${filters.selectedYear}`}
                >
                  {mShort}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* 5. Sensor satelital */}
      <div className="space-y-2 pt-1 border-t border-slate-100">
        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
          SENSOR SATELITAL
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { id: 'harmonized', label: 'Armonizado' },
            { id: 'modis', label: 'MODIS' },
            { id: 'viirs', label: 'VIIRS' },
          ].map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSensor(s.id as SensorType)}
              className={`px-2 py-2 text-xs rounded-xl font-black transition-all text-center border ${
                filters.sensor === s.id
                  ? 'bg-[#071C3A] text-white border-[#071C3A] shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-[#F4F6F9]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* 6. Confianza y Día/Noche */}
      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
        <div>
          <label htmlFor="confidence-select" className="text-xs text-slate-400 font-medium block mb-1">
            Confianza
          </label>
          <div className="relative">
            <select
              id="confidence-select"
              value={filters.confidence}
              onChange={(e) => setConfidence(e.target.value as ConfidenceLevel)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 pr-7 text-xs font-bold text-slate-700 shadow-2xs appearance-none"
            >
              <option value="nominal_high">Nominal / Alta</option>
              <option value="all">Todas</option>
            </select>
            <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        <div>
          <label htmlFor="daynight-select" className="text-xs text-slate-400 font-medium block mb-1">
            Paso Satelital
          </label>
          <div className="relative">
            <select
              id="daynight-select"
              value={filters.daynight}
              onChange={(e) => setDayNight(e.target.value as DayNight)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 pr-7 text-xs font-bold text-slate-700 shadow-2xs appearance-none"
            >
              <option value="all">Día y Noche</option>
              <option value="D">Diurno</option>
              <option value="N">Nocturno</option>
            </select>
            <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* 7. Botón principal: ANALIZAR ÁREA */}
      <div className="pt-2">
        <button
          type="button"
          onClick={triggerAnalyze}
          className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-[#FF7900] hover:bg-[#E66D00] text-white font-black rounded-xl shadow-md shadow-[#FF7900]/30 transition-all text-xs uppercase tracking-wider focus:outline-hidden"
        >
          <Search className="w-4 h-4" />
          <span>ANALIZAR ÁREA</span>
        </button>
      </div>
    </div>
  )

  return (
    <>
      <div
        className={`bg-white rounded-[28px] p-6 border border-slate-200/70 hidden lg:block sticky top-24 self-start max-h-[calc(100vh-110px)] overflow-y-auto ${className}`}
      >
        {content}
      </div>

      {/* Versión Móvil: Botón flotante y Bottom Sheet */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setMobileDrawerOpen(true)}
          className="fixed bottom-5 right-5 z-30 flex items-center gap-2 px-5 py-3.5 bg-[#FF7900] text-white rounded-full shadow-2xl font-black text-sm hover:bg-[#E66D00]"
          aria-label="Abrir panel de filtros"
        >
          <Filter className="w-4 h-4" />
          <span>Filtros ({selectedCity ? selectedCity.name : filters.countryName || 'Territorio'})</span>
        </button>

        {mobileDrawerOpen && (
          <div className="fixed inset-0 z-50 bg-[#071C3A]/60 backdrop-blur-xs flex flex-col justify-end">
            <div className="bg-white rounded-t-3xl max-h-[85vh] overflow-y-auto p-6 shadow-2xl space-y-4">
              <div className="flex justify-center -mt-2 mb-2">
                <div className="w-12 h-1.5 bg-slate-300 rounded-full" />
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="font-black text-[#0B2D5B] text-base">
                  Filtros de Análisis
                </span>
                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="p-1 rounded-md text-slate-400 hover:text-[#0B2D5B]"
                >
                  <ChevronDown className="w-6 h-6" />
                </button>
              </div>

              {content}

              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                className="w-full mt-3 py-3 bg-[#F4F6F9] text-[#0B2D5B] rounded-xl font-bold text-xs text-center hover:bg-slate-200"
              >
                Cerrar filtros
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
