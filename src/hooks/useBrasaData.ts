// Hook central de datos para BRASA
// Gestiona peticiones a la API, cancelación de solicitudes obsoletas, caché y reintentos

import { useState, useEffect, useCallback, useRef } from 'react'
import type {
  AnomaliesResponse,
  CalendarResponse,
  ClimatologyResponse,
  CurrentStatusResponse,
  HotspotsResponse,
  RegionsResponse,
  SeasonResponse,
} from '../types'
import {
  fetchAnomalies,
  fetchCalendar,
  fetchClimatology,
  fetchCurrentStatus,
  fetchHotspots,
  fetchRegions,
  fetchSeason,
  IS_MOCK_MODE,
} from '../api/client'
import { mockGetHotspots } from '../api/mock'
import { useFilters } from './useFilters'

export interface BrasaDataState {
  regions: RegionsResponse | null
  calendar: CalendarResponse | null
  climatology: ClimatologyResponse | null
  season: SeasonResponse | null
  anomalies: AnomaliesResponse | null
  hotspots: HotspotsResponse | null
  currentStatus: CurrentStatusResponse | null
  isLoading: boolean
  isHotspotsLoading: boolean
  error: string | null
  refetch: () => void
}

export function useBrasaData(): BrasaDataState {
  const { filters, selectedWeek, analyzeTrigger } = useFilters()

  const [regions, setRegions] = useState<RegionsResponse | null>(null)
  const [calendar, setCalendar] = useState<CalendarResponse | null>(null)
  const [climatology, setClimatology] = useState<ClimatologyResponse | null>(null)
  const [season, setSeason] = useState<SeasonResponse | null>(null)
  const [anomalies, setAnomalies] = useState<AnomaliesResponse | null>(null)
  const [hotspots, setHotspots] = useState<HotspotsResponse | null>(null)
  const [currentStatus, setCurrentStatus] = useState<CurrentStatusResponse | null>(null)

  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isHotspotsLoading, setIsHotspotsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)
  const hotspotsAbortRef = useRef<AbortController | null>(null)
  const hotspotsCacheRef = useRef<Map<string, HotspotsResponse>>(new Map())

  // Cargar regiones solo una vez
  useEffect(() => {
    let active = true
    fetchRegions()
      .then((data) => {
        if (active) setRegions(data)
      })
      .catch((err) => {
        console.error('Error al cargar regiones:', err)
      })
    return () => {
      active = false
    }
  }, [])

  // Cargar dataset principal al cambiar filtros o disparar análisis
  const loadData = useCallback(() => {
    // Cancelar consulta previa en vuelo
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const ac = new AbortController()
    abortControllerRef.current = ac

    setIsLoading(true)
    setError(null)

    const baseParams = {
      year_from: filters.yearRange[0],
      year_to: filters.yearRange[1],
      sensor: filters.sensor,
      confidence: filters.confidence,
      daynight: filters.daynight,
      country_code: filters.countryCode || (filters.provinceId?.length === 3 ? filters.provinceId.toUpperCase() : 'ECU'),
      continent: filters.continent && filters.continent !== 'all' ? filters.continent : undefined,
      province_id: filters.provinceId,
      canton_id: filters.cantonId,
      geojson: filters.customGeometry?.geojson,
    }

    Promise.all([
      fetchCalendar(baseParams, ac.signal),
      fetchClimatology(baseParams, ac.signal),
      fetchSeason(baseParams, ac.signal),
      fetchAnomalies(baseParams, ac.signal),
      fetchCurrentStatus(baseParams, ac.signal),
    ])
      .then(([calData, climData, seasonData, anomData, statusData]) => {
        setCalendar(calData)
        setClimatology(climData)
        setSeason(seasonData)
        setAnomalies(anomData)
        setCurrentStatus(statusData)
        setIsLoading(false)
      })
      .catch((err) => {
        if (err.name === 'AbortError') return
        console.error('Error al consultar datos de BRASA:', err)
        setError('Ocurrió un error al consultar los datos satelitales. Verifique la conexión con el servicio.')
        setIsLoading(false)
      })
  }, [
    filters.countryCode,
    filters.country,
    filters.continent,
    filters.provinceId,
    filters.cantonId,
    filters.yearRange,
    filters.sensor,
    filters.confidence,
    filters.daynight,
    filters.customGeometry?.geojson,
    analyzeTrigger,
  ])

  useEffect(() => {
    loadData()
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [loadData])

  // Pre-calentar caché de focos para todas las 52 semanas del año seleccionado
  useEffect(() => {
    if (IS_MOCK_MODE) {
      const radius = filters.customGeometry?.radiusMeters || filters.coverageRadiusMeters || 18500
      for (let w = 1; w <= 52; w++) {
        const cacheKey = `${filters.selectedYear}-${w}-${filters.provinceId}-${filters.cantonId}-${filters.sensor}-${filters.confidence}-${filters.daynight}-${radius}`
        if (!hotspotsCacheRef.current.has(cacheKey)) {
          const res = mockGetHotspots({
            year_from: filters.yearRange[0],
            year_to: filters.yearRange[1],
            sensor: filters.sensor,
            confidence: filters.confidence,
            daynight: filters.daynight,
            province_id: filters.provinceId,
            canton_id: filters.cantonId,
            year: filters.selectedYear,
            week: w,
            geojson: filters.customGeometry?.geojson,
          })
          hotspotsCacheRef.current.set(cacheKey, res)
        }
      }
    }
  }, [
    filters.selectedYear,
    filters.provinceId,
    filters.cantonId,
    filters.sensor,
    filters.confidence,
    filters.daynight,
    filters.coverageRadiusMeters,
    filters.customGeometry?.radiusMeters,
  ])

  // Cargar focos de calor específicos para la semana y año seleccionados de forma instantánea
  useEffect(() => {
    const radius = filters.customGeometry?.radiusMeters || filters.coverageRadiusMeters || 18500
    const countryKey = filters.countryCode || 'ECU'
    const cacheKey = `${countryKey}-${filters.selectedYear}-${selectedWeek}-${filters.provinceId}-${filters.cantonId}-${filters.sensor}-${filters.confidence}-${filters.daynight}-${radius}`
    
    // Si ya está en caché, actualizar de inmediato sin parpadeos
    if (hotspotsCacheRef.current.has(cacheKey)) {
      setHotspots(hotspotsCacheRef.current.get(cacheKey)!)
      setIsHotspotsLoading(false)
      return
    }

    if (hotspotsAbortRef.current) {
      hotspotsAbortRef.current.abort()
    }
    const ac = new AbortController()
    hotspotsAbortRef.current = ac

    fetchHotspots(
      {
        year_from: filters.yearRange[0],
        year_to: filters.yearRange[1],
        sensor: filters.sensor,
        confidence: filters.confidence,
        daynight: filters.daynight,
        country_code: filters.countryCode || (filters.provinceId?.length === 3 ? filters.provinceId.toUpperCase() : 'ECU'),
        continent: filters.continent && filters.continent !== 'all' ? filters.continent : undefined,
        province_id: filters.provinceId,
        canton_id: filters.cantonId,
        year: filters.selectedYear,
        week: selectedWeek,
        geojson: filters.customGeometry?.geojson,
      },
      ac.signal
    )
      .then((res) => {
        hotspotsCacheRef.current.set(cacheKey, res)
        setHotspots(res)
        setIsHotspotsLoading(false)
      })
      .catch((err) => {
        if (err.name === 'AbortError') return
        console.error('Error al cargar focos:', err)
        setIsHotspotsLoading(false)
      })

    return () => {
      if (hotspotsAbortRef.current) {
        hotspotsAbortRef.current.abort()
      }
    }
  }, [
    filters.countryCode,
    filters.selectedYear,
    selectedWeek,
    filters.provinceId,
    filters.cantonId,
    filters.sensor,
    filters.confidence,
    filters.daynight,
    filters.coverageRadiusMeters,
    filters.customGeometry?.radiusMeters,
  ])

  return {
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
    refetch: loadData,
  }
}
