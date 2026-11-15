// Cliente de API para BRASA - Conexión Backend / Modo Mock
// NASA Space Apps Challenge 2026 - Equipo CODE RED

import type {
  AnomaliesResponse,
  BaseFilterParams,
  CalendarResponse,
  ClimatologyResponse,
  CurrentStatusResponse,
  HotspotRequestParams,
  HotspotsResponse,
  RegionsResponse,
  SeasonResponse,
} from '../types'
import {
  mockGetAnomalies,
  mockGetCalendar,
  mockGetClimatology,
  mockGetCurrentStatus,
  mockGetHotspots,
  mockGetRegions,
  mockGetSeason,
} from './mock'

const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'https://brasa-api-mundial.onrender.com'
export const IS_MOCK_MODE =
  String(import.meta.env.VITE_USE_MOCK).toLowerCase() === 'true'

// Utilidad para simular latencia de red mínima en modo mock (120ms)
function mockDelay<T>(data: T, delayMs: number = 120, signal?: AbortSignal): Promise<T> {
  if (delayMs <= 0) {
    if (signal?.aborted) {
      return Promise.reject(new DOMException('Aborted', 'AbortError'))
    }
    return Promise.resolve(data)
  }

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      return reject(new DOMException('Aborted', 'AbortError'))
    }

    const timer = setTimeout(() => {
      if (signal?.aborted) {
        reject(new DOMException('Aborted', 'AbortError'))
      } else {
        resolve(data)
      }
    }, delayMs)

    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    })
  })
}

/**
 * Adapta los parámetros según el backend conectado (API local de Ecuador vs API mundial en Render)
 */
function prepareFilterPayload(params: any): any {
  const payload: any = {
    year_from: params.year_from ?? 2005,
    year_to: params.year_to ?? 2025,
    sensor: params.sensor ?? 'harmonized',
    confidence: params.confidence ?? 'all',
    daynight: params.daynight ?? 'all',
  }

  if (params.year !== undefined) payload.year = params.year
  if (params.week !== undefined) payload.week = params.week
  if (params.date_from !== undefined) payload.date_from = params.date_from
  if (params.date_to !== undefined) payload.date_to = params.date_to

  // Código ISO3 para países (Ecuador = ECU por defecto)
  payload.country_code = (params.country_code || 'ECU').toUpperCase()

  // La API mundial en Render no acepta canton_id, province_id ni geojson (responde 422)
  // El filtrado por ciudad/cantón se realiza de forma geoespacial precisa en el cliente
  return payload
}

/**
 * Petición genérica al backend REST con reintento y fallback resiliente
 */
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`
  let response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options.headers,
    },
  })

  // Si la API remota responde 422 (validación de esquema)
  if (response.status === 422 && options.body) {
    try {
      const parsed = JSON.parse(options.body as string)
      const adapted = {
        ...parsed,
        country_code: parsed.country_code || 'ECU',
      }
      delete adapted.province_id
      delete adapted.canton_id
      delete adapted.geojson

      const retryRes = await fetch(url, {
        ...options,
        body: JSON.stringify(adapted),
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...options.headers,
        },
      })
      if (retryRes.ok) {
        return retryRes.json()
      }
    } catch {
      // Ignorar fallo de parseo y continuar con manejo normal
    }
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '')
    throw new Error(
      `Error ${response.status} en ${endpoint}: ${response.statusText || errorBody || 'Fallo de red'}`
    )
  }

  return response.json()
}

/**
 * GET /api/regions
 */
export async function fetchRegions(signal?: AbortSignal): Promise<RegionsResponse> {
  if (IS_MOCK_MODE) {
    return mockDelay(mockGetRegions(), 80, signal)
  }
  try {
    const data = await request<RegionsResponse>('/api/regions', { method: 'GET', signal })
    // Si la API remota devuelve lista mundial de países (donde el primero es Afganistán "AFG"):
    // Conservamos las provincias y cantones de Ecuador para mantener la fidelidad territorial
    if (Array.isArray(data) && data.length > 0 && (data[0].id === 'AFG' || data.some((r) => r.id === 'ECU'))) {
      return mockGetRegions()
    }
    return data
  } catch {
    // Si falla la consulta de regiones del servidor remoto, usar provincias locales de Ecuador
    return mockGetRegions()
  }
}

/**
 * POST /api/calendar
 */
export async function fetchCalendar(
  params: BaseFilterParams,
  signal?: AbortSignal
): Promise<CalendarResponse> {
  if (IS_MOCK_MODE) {
    return mockDelay(mockGetCalendar(params), 180, signal)
  }
  return request<CalendarResponse>('/api/calendar', {
    method: 'POST',
    body: JSON.stringify(prepareFilterPayload(params)),
    signal,
  })
}

/**
 * POST /api/climatology
 */
export async function fetchClimatology(
  params: BaseFilterParams,
  signal?: AbortSignal
): Promise<ClimatologyResponse> {
  if (IS_MOCK_MODE) {
    return mockDelay(mockGetClimatology(params), 150, signal)
  }
  return request<ClimatologyResponse>('/api/climatology', {
    method: 'POST',
    body: JSON.stringify(prepareFilterPayload(params)),
    signal,
  })
}

/**
 * POST /api/season
 */
export async function fetchSeason(
  params: BaseFilterParams,
  signal?: AbortSignal
): Promise<SeasonResponse> {
  if (IS_MOCK_MODE) {
    return mockDelay(mockGetSeason(params), 140, signal)
  }
  return request<SeasonResponse>('/api/season', {
    method: 'POST',
    body: JSON.stringify(prepareFilterPayload(params)),
    signal,
  })
}

/**
 * POST /api/anomalies
 */
export async function fetchAnomalies(
  params: BaseFilterParams,
  signal?: AbortSignal
): Promise<AnomaliesResponse> {
  if (IS_MOCK_MODE) {
    return mockDelay(mockGetAnomalies(params), 160, signal)
  }
  return request<AnomaliesResponse>('/api/anomalies', {
    method: 'POST',
    body: JSON.stringify(prepareFilterPayload(params)),
    signal,
  })
}

/**
 * POST /api/hotspots
 */
export async function fetchHotspots(
  params: HotspotRequestParams,
  signal?: AbortSignal
): Promise<HotspotsResponse> {
  if (IS_MOCK_MODE) {
    return mockDelay(mockGetHotspots(params), 0, signal)
  }
  // Para /api/hotspots enviamos estrictamente los parámetros que la base de datos consulta:
  // country_code, year, week, sensor, confidence, daynight (sin year_from ni year_to para evitar errores 422 de rango)
  const hotspotsPayload: Record<string, any> = {
    country_code: (params.country_code || 'ECU').toUpperCase(),
    year: params.year ?? 2024,
    week: params.week ?? 36,
    sensor: params.sensor ?? 'harmonized',
    confidence: params.confidence ?? 'all',
    daynight: params.daynight ?? 'all',
  }
  if (params.date_from !== undefined) hotspotsPayload.date_from = params.date_from
  if (params.date_to !== undefined) hotspotsPayload.date_to = params.date_to

  return request<HotspotsResponse>('/api/hotspots', {
    method: 'POST',
    body: JSON.stringify(hotspotsPayload),
    signal,
  })
}

/**
 * POST /api/current-status
 */
export async function fetchCurrentStatus(
  params: BaseFilterParams,
  signal?: AbortSignal
): Promise<CurrentStatusResponse> {
  if (IS_MOCK_MODE) {
    return mockDelay(mockGetCurrentStatus(params), 100, signal)
  }
  return request<CurrentStatusResponse>('/api/current-status', {
    method: 'POST',
    body: JSON.stringify(prepareFilterPayload(params)),
    signal,
  })
}
