// Contexto y Hook de Filtros para BRASA

import React, { createContext, useContext, useState, useMemo } from 'react'
import type {
  ConfidenceLevel,
  CustomGeometry,
  DayNight,
  FilterState,
  SensorType,
} from '../types'
import { circleToPolygonGeoJSON } from '../utils/geoUtils'

export interface FiltersContextType {
  filters: FilterState
  selectedWeek: number
  coverageRadiusMeters: number
  setSelectedWeek: (week: number) => void
  setCoverageRadiusMeters: (radius: number) => void
  setCountry: (name: string, code: string, center?: [number, number]) => void
  setCountryCode: (code: string) => void
  setContinent: (continent: string) => void
  setProvinceId: (id: string, center?: [number, number]) => void
  setCantonId: (id: string, center?: [number, number]) => void
  setYearRange: (range: [number, number]) => void
  setSelectedYear: (year: number) => void
  setSensor: (sensor: SensorType) => void
  setConfidence: (confidence: ConfidenceLevel) => void
  setDayNight: (daynight: DayNight) => void
  setCustomGeometry: (geometry: CustomGeometry | null) => void
  resetFilters: () => void
  analyzeTrigger: number
  triggerAnalyze: () => void
}

const DEFAULT_RADIUS = 18500

const DEFAULT_FILTERS: FilterState = {
  country: 'Ecuador',
  countryCode: 'ECU',
  continent: 'all',
  provinceId: 'chimborazo',
  cantonId: 'riobamba',
  yearRange: [2001, 2025],
  selectedYear: 2024,
  sensor: 'harmonized',
  confidence: 'nominal_high',
  daynight: 'all',
  customGeometry: {
    type: 'circle',
    center: [-1.6709, -78.6545],
    radiusMeters: DEFAULT_RADIUS,
    geojson: circleToPolygonGeoJSON(-1.6709, -78.6545, DEFAULT_RADIUS),
  },
  coverageRadiusMeters: DEFAULT_RADIUS,
}

const FiltersContext = createContext<FiltersContextType | undefined>(undefined)

export const FiltersProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)
  const [selectedWeek, setSelectedWeek] = useState<number>(36) // Semana pico en temporada seca
  const [coverageRadiusMeters, setCoverageRadiusState] = useState<number>(DEFAULT_RADIUS)
  const [analyzeTrigger, setAnalyzeTrigger] = useState<number>(0)

  const setCoverageRadiusMeters = (radius: number) => {
    setCoverageRadiusState(radius)
    setFilters((prev) => {
      const center = prev.customGeometry?.center || [-1.6709, -78.6545]
      return {
        ...prev,
        coverageRadiusMeters: radius,
        customGeometry:
          prev.customGeometry?.type === 'circle' || !prev.customGeometry
            ? {
                type: 'circle',
                center,
                radiusMeters: radius,
                geojson: circleToPolygonGeoJSON(center[0], center[1], radius),
              }
            : prev.customGeometry,
      }
    })
  }

  const setCountry = (name: string, code: string, center?: [number, number]) => {
    setFilters((prev) => {
      const newCenter = center || prev.customGeometry?.center || [-1.6709, -78.6545]
      const radius = prev.coverageRadiusMeters || DEFAULT_RADIUS
      const isEcuador = code.toUpperCase() === 'ECU'
      return {
        ...prev,
        country: name,
        countryCode: code.toUpperCase(),
        provinceId: isEcuador ? 'chimborazo' : code.toUpperCase(),
        cantonId: isEcuador ? 'riobamba' : '',
        customGeometry: {
          type: 'circle',
          center: newCenter,
          radiusMeters: radius,
          geojson: circleToPolygonGeoJSON(newCenter[0], newCenter[1], radius),
        },
      }
    })
  }

  const setCountryCode = (code: string) => {
    setFilters((prev) => ({
      ...prev,
      countryCode: code.toUpperCase(),
      provinceId: code.toUpperCase() === 'ECU' ? prev.provinceId || 'chimborazo' : code.toUpperCase(),
      cantonId: code.toUpperCase() === 'ECU' ? prev.cantonId : '',
    }))
  }

  const setContinent = (continent: string) => {
    setFilters((prev) => ({ ...prev, continent }))
  }

  const setProvinceId = (provinceId: string, center?: [number, number]) => {
    setFilters((prev) => {
      const newCenter = center || (provinceId === 'chimborazo' ? [-1.6709, -78.6545] : [-0.2298, -78.5249])
      const radius = prev.coverageRadiusMeters || DEFAULT_RADIUS
      return {
        ...prev,
        provinceId,
        cantonId: provinceId === 'chimborazo' ? 'riobamba' : '',
        customGeometry: {
          type: 'circle',
          center: newCenter,
          radiusMeters: radius,
          geojson: circleToPolygonGeoJSON(newCenter[0], newCenter[1], radius),
        },
      }
    })
  }

  const setCantonId = (cantonId: string, center?: [number, number]) => {
    setFilters((prev) => {
      const newCenter = center || prev.customGeometry?.center || [-1.6709, -78.6545]
      const radius = prev.coverageRadiusMeters || DEFAULT_RADIUS
      return {
        ...prev,
        cantonId,
        customGeometry: {
          type: 'circle',
          center: newCenter,
          radiusMeters: radius,
          geojson: circleToPolygonGeoJSON(newCenter[0], newCenter[1], radius),
        },
      }
    })
  }

  const setYearRange = (yearRange: [number, number]) => {
    setFilters((prev) => ({ ...prev, yearRange }))
  }

  const setSelectedYear = (selectedYear: number) => {
    setFilters((prev) => ({ ...prev, selectedYear }))
  }

  const setSensor = (sensor: SensorType) => {
    setFilters((prev) => ({ ...prev, sensor }))
  }

  const setConfidence = (confidence: ConfidenceLevel) => {
    setFilters((prev) => ({ ...prev, confidence }))
  }

  const setDayNight = (daynight: DayNight) => {
    setFilters((prev) => ({ ...prev, daynight }))
  }

  const setCustomGeometry = (customGeometry: CustomGeometry | null) => {
    setFilters((prev) => ({ ...prev, customGeometry }))
  }

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS)
    setSelectedWeek(36)
    setCoverageRadiusState(DEFAULT_RADIUS)
    setAnalyzeTrigger((prev) => prev + 1)
  }

  const triggerAnalyze = () => {
    setAnalyzeTrigger((prev) => prev + 1)
  }

  const value = useMemo(
    () => ({
      filters,
      selectedWeek,
      coverageRadiusMeters,
      setSelectedWeek,
      setCoverageRadiusMeters,
      setCountry,
      setCountryCode,
      setContinent,
      setProvinceId,
      setCantonId,
      setYearRange,
      setSelectedYear,
      setSensor,
      setConfidence,
      setDayNight,
      setCustomGeometry,
      resetFilters,
      analyzeTrigger,
      triggerAnalyze,
    }),
    [filters, selectedWeek, coverageRadiusMeters, analyzeTrigger]
  )

  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>
}

export function useFilters(): FiltersContextType {
  const context = useContext(FiltersContext)
  if (!context) {
    throw new Error('useFilters debe utilizarse dentro de FiltersProvider')
  }
  return context
}
