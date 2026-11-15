// Definición de tipos para BRASA - NASA Space Apps Challenge 2026
// Equipo CODE RED

export type SensorType = 'harmonized' | 'modis' | 'viirs'
export type ConfidenceLevel = 'nominal_high' | 'all'
export type DayNight = 'all' | 'D' | 'N'
export type SourceType = 'MODIS' | 'BOTH' | 'VIIRS_CAL'
export type StatusLevel = 'normal' | 'elevado' | 'inusual'

export interface BoundingBox {
  minLon: number
  minLat: number
  maxLon: number
  maxLat: number
}

export type GeometryType = 'bbox' | 'polygon' | 'circle'

export interface CustomGeometry {
  type: GeometryType
  coordinates?: [number, number][] // Para polígonos [lat, lon]
  center?: [number, number] // Para círculos [lat, lon]
  radiusMeters?: number // Para círculos
  geojson?: GeoJSON.GeoJsonObject
}

export interface BaseFilterParams {
  year_from: number
  year_to: number
  sensor: SensorType
  confidence: ConfidenceLevel
  daynight: DayNight
  country_code?: string
  continent?: string
  geojson?: GeoJSON.GeoJsonObject
  bbox?: [number, number, number, number] // [minLon, minLat, maxLon, maxLat]
  province_id?: string
  canton_id?: string
}

export interface CalendarWeekItem {
  year: number
  week: number
  value: number
  source: SourceType
}

export interface CalendarResponse {
  unit: 'fire_cell_days'
  weeks: CalendarWeekItem[]
}

export interface ClimatologyWeekItem {
  week: number
  mean: number
  p10: number
  p50: number
  p90: number
}

export interface ClimatologyResponse {
  weeks: ClimatologyWeekItem[]
}

export interface SeasonYearItem {
  year: number
  start_week: number
  peak_week: number
  end_week: number
  total: number
}

export interface SeasonResponse {
  years: SeasonYearItem[]
}

export interface AnomalyItem {
  year: number
  week: number
  value: number
  zscore: number
  percentile: number
}

export interface AnomaliesResponse {
  items: AnomalyItem[]
}

export interface HotspotPoint {
  lat: number
  lon: number
  date: string
  frp: number
  sensor: string
}

export interface HotspotsResponse {
  points: HotspotPoint[]
}

export interface HotspotRequestParams extends BaseFilterParams {
  date_from?: string
  date_to?: string
  year?: number
  week?: number
}

export interface CurrentStatusResponse {
  /** Año de la semana evaluada. Opcional hasta que el backend real lo devuelva. */
  year?: number
  week: number
  value: number
  percentile: number
  zscore: number
  level: StatusLevel
}

export interface Canton {
  id: string
  name: string
  lat: number
  lon: number
  bbox?: [number, number, number, number]
}

export interface Region {
  id: string
  name: string
  continent?: string
  geojson: GeoJSON.Polygon | GeoJSON.GeoJsonObject | any
  center: [number, number] // [lat, lon]
  zoom: number
  cantons?: Canton[]
}

export type RegionsResponse = Region[]

// Estado de filtros del cliente
export interface FilterState {
  country: string // 'Ecuador'
  countryCode: string // 'ECU'
  continent?: string
  provinceId: string
  cantonId: string
  yearRange: [number, number] // [2001, 2025]
  selectedYear: number // p. ej. 2024
  sensor: SensorType
  confidence: ConfidenceLevel
  daynight: DayNight
  customGeometry?: CustomGeometry | null
  coverageRadiusMeters?: number
}
