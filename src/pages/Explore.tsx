import React from 'react'
import { Link } from 'react-router-dom'
import { Wind } from 'lucide-react'
import { useBrasaData } from '../hooks/useBrasaData'
import { useFilters } from '../hooks/useFilters'
import { FiltersPanel } from '../components/FiltersPanel'
import { KpiCards } from '../components/KpiCards'
import { MapView } from '../components/MapView'
import { FireCalendar } from '../components/FireCalendar'
import { TimelinePlayer } from '../components/TimelinePlayer'
import { ExportControls } from '../components/ExportControls'
import { ErrorMessage } from '../components/ErrorMessage'
import { HarmonizationChart } from '../components/HarmonizationChart'
import { getCitiesForCountry, getProvincesForCountry } from '../utils/territoryData'

const SectionLabel: React.FC<{ title: string; note: string }> = ({ title, note }) => (
  <div className="flex items-baseline gap-3 pt-2">
    <h2 className="text-sm font-black uppercase tracking-[0.18em] text-[#0B1B3D]">{title}</h2>
    <span className="text-sm text-slate-400">{note}</span>
  </div>
)

export const Explore: React.FC = () => {
  const {
    filters,
    selectedWeek,
    setSelectedWeek,
    setSelectedYear,
    setCustomGeometry,
  } = useFilters()

  const {
    regions,
    calendar,
    climatology,
    season,
    anomalies,
    hotspots,
    currentStatus,
    isLoading,
    isHotspotsLoading,
    error,
    refetch,
  } = useBrasaData()

  const availableProvinces = getProvincesForCountry(filters.country)
  const availableCities = getCitiesForCountry(filters.country)
  const selectedRegion =
    availableProvinces.find((r) => r.id === filters.provinceId) ||
    regions?.find((r) => r.id === filters.provinceId) ||
    availableProvinces[0]
  const selectedCanton = availableCities.find((c) => c.id === filters.cantonId)

  const handleSelectWeekAndYear = (year: number, week: number) => {
    setSelectedYear(year)
    setSelectedWeek(week)
  }

  const handleClearGeometry = () => {
    setCustomGeometry(null)
  }

  const peakWeek = season?.years.find((y) => y.year === filters.selectedYear)?.peak_week

  return (
    <div className="py-10 sm:py-12 px-4 sm:px-6 lg:px-8 max-w-[1680px] mx-auto space-y-6 text-[#0B1B3D]">
      {/* Encabezado */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#FF7900]">Dashboard</p>
          <h1 className="mt-3 text-4xl sm:text-5xl font-black tracking-tight leading-none">Explorar</h1>
          <p className="mt-3 text-slate-500 font-medium">
            {selectedCanton ? (
              <span className="font-bold text-[#0B1B3D]">{selectedCanton.name} · </span>
            ) : (
              <span>Nivel Nacional · </span>
            )}
            <span className="font-bold text-[#FF7900]">{filters.countryName || 'Ecuador'}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/simulador"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#0B1B3D] to-[#1E293B] text-white rounded-xl text-xs sm:text-sm font-bold hover:shadow-md transition-all border border-slate-700/50"
          >
            <Wind className="w-4 h-4 text-[#FF7900] animate-pulse" />
            <span>Simulador Táctico FireCast</span>
          </Link>

          <ExportControls
            calendar={calendar}
            hotspots={hotspots}
            climatology={climatology}
            anomalies={anomalies}
            selectedYear={filters.selectedYear}
            selectedWeek={selectedWeek}
          />
        </div>
      </header>

      {error && <ErrorMessage message={error} onRetry={refetch} />}

      <KpiCards
        season={season}
        currentStatus={currentStatus}
        calendar={calendar}
        anomalies={anomalies}
        selectedYear={filters.selectedYear}
        isLoading={isLoading}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Columna principal */}
        <div className="lg:col-span-8 space-y-6">
          <SectionLabel title={`Año ${filters.selectedYear}`} note="Dónde y cuándo" />

          <MapView
            region={selectedRegion}
            canton={selectedCanton}
            hotspots={hotspots}
            isLoadingHotspots={isHotspotsLoading}
            selectedYear={filters.selectedYear}
            selectedWeek={selectedWeek}
            customGeometry={filters.customGeometry}
            onClearGeometry={handleClearGeometry}
          />

          <TimelinePlayer
            currentWeek={selectedWeek}
            selectedYear={filters.selectedYear}
            onWeekChange={(week) => setSelectedWeek(week)}
            peakWeek={peakWeek}
          />

          <div className="pt-6">
            <SectionLabel title="Serie histórica" note="2005–2025" />
          </div>

          <FireCalendar
            calendar={calendar}
            isLoading={isLoading}
            selectedYear={filters.selectedYear}
            selectedWeek={selectedWeek}
            onSelectWeek={handleSelectWeekAndYear}
          />

          <HarmonizationChart />
        </div>

        {/* Filtros */}
        <div className="lg:col-span-4">
          <FiltersPanel regions={availableProvinces} />
        </div>
      </div>
    </div>
  )
}
