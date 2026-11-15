// Generador de datos simulados deterministas para BRASA
// Basado en el régimen de incendios de Ecuador (2001-2025)
// Temporada seca andina: semanas 32 a 40 (Agosto - Octubre)
// Años críticos: 2012 y 2024

import type {
  AnomaliesResponse,
  BaseFilterParams,
  CalendarResponse,
  CalendarWeekItem,
  ClimatologyResponse,
  ClimatologyWeekItem,
  CurrentStatusResponse,
  HotspotPoint,
  HotspotRequestParams,
  HotspotsResponse,
  RegionsResponse,
  SeasonResponse,
  SeasonYearItem,
  SourceType,
  StatusLevel,
} from '../types'
import PAISES_177 from '../utils/paises177.json'
import WORLD_CITIES from '../utils/worldCities.json'

// Generador pseudoaleatorio determinista con semilla (Linear Congruential Generator)
function pseudoRandom(seed: number): () => number {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

// Provincias de Ecuador y cantones con GeoJSON simplificado
export const MOCK_REGIONS: RegionsResponse = [
  {
    id: 'chimborazo',
    name: 'Chimborazo',
    center: [-1.6709, -78.6545],
    zoom: 10,
    cantons: [
      { id: 'riobamba', name: 'Riobamba', lat: -1.6709, lon: -78.6545 },
      { id: 'guano', name: 'Guano', lat: -1.6033, lon: -78.6322 },
      { id: 'colta', name: 'Colta', lat: -1.7167, lon: -78.7500 },
      { id: 'alausi', name: 'Alausí', lat: -2.2000, lon: -78.8500 },
      { id: 'guamote', name: 'Guamote', lat: -1.9333, lon: -78.7167 },
      { id: 'chambo', name: 'Chambo', lat: -1.7000, lon: -78.5833 },
      { id: 'pallatanga', name: 'Pallatanga', lat: -2.0000, lon: -78.9667 },
    ],
    geojson: {
      type: 'Polygon',
      coordinates: [
        [
          [-78.50, -1.35],
          [-78.35, -1.60],
          [-78.40, -1.95],
          [-78.60, -2.35],
          [-78.95, -2.40],
          [-79.15, -2.10],
          [-79.00, -1.70],
          [-78.80, -1.40],
          [-78.50, -1.35],
        ],
      ],
    },
  },
  {
    id: 'pichincha',
    name: 'Pichincha',
    center: [-0.2298, -78.5249],
    zoom: 10,
    cantons: [
      { id: 'quito', name: 'Quito', lat: -0.2298, lon: -78.5249 },
      { id: 'cayambe', name: 'Cayambe', lat: 0.0417, lon: -78.1453 },
      { id: 'mejia', name: 'Mejía (Machachi)', lat: -0.5100, lon: -78.5667 },
      { id: 'ruminahui', name: 'Rumiñahui (Sangolquí)', lat: -0.3333, lon: -78.4500 },
    ],
    geojson: {
      type: 'Polygon',
      coordinates: [
        [
          [-78.70, 0.25],
          [-78.20, 0.15],
          [-78.10, -0.30],
          [-78.35, -0.65],
          [-78.75, -0.60],
          [-79.05, -0.15],
          [-78.70, 0.25],
        ],
      ],
    },
  },
  {
    id: 'guayas',
    name: 'Guayas',
    center: [-2.1894, -79.8891],
    zoom: 9,
    cantons: [
      { id: 'guayaquil', name: 'Guayaquil', lat: -2.1894, lon: -79.8891 },
      { id: 'samborondon', name: 'Samborondón', lat: -2.1400, lon: -79.7200 },
      { id: 'daule', name: 'Daule', lat: -1.8600, lon: -79.9800 },
      { id: 'milagro', name: 'Milagro', lat: -2.1333, lon: -79.5833 },
    ],
    geojson: {
      type: 'Polygon',
      coordinates: [
        [
          [-79.90, -1.30],
          [-79.40, -1.80],
          [-79.45, -2.70],
          [-80.10, -2.85],
          [-80.45, -2.30],
          [-80.20, -1.60],
          [-79.90, -1.30],
        ],
      ],
    },
  },
  {
    id: 'azuay',
    name: 'Azuay',
    center: [-2.9001, -79.0059],
    zoom: 10,
    cantons: [
      { id: 'cuenca', name: 'Cuenca', lat: -2.9001, lon: -79.0059 },
      { id: 'gualaceo', name: 'Gualaceo', lat: -2.8900, lon: -78.7800 },
      { id: 'paute', name: 'Paute', lat: -2.7800, lon: -78.7600 },
    ],
    geojson: {
      type: 'Polygon',
      coordinates: [
        [
          [-79.10, -2.60],
          [-78.60, -2.75],
          [-78.70, -3.40],
          [-79.35, -3.35],
          [-79.50, -2.80],
          [-79.10, -2.60],
        ],
      ],
    },
  },
  {
    id: 'loja',
    name: 'Loja',
    center: [-3.9931, -79.2042],
    zoom: 9,
    cantons: [
      { id: 'loja', name: 'Loja', lat: -3.9931, lon: -79.2042 },
      { id: 'catamayo', name: 'Catamayo', lat: -3.9800, lon: -79.3500 },
      { id: 'calvas', name: 'Calvas (Cariamanga)', lat: -4.3200, lon: -79.5500 },
    ],
    geojson: {
      type: 'Polygon',
      coordinates: [
        [
          [-79.25, -3.50],
          [-78.90, -3.90],
          [-79.10, -4.60],
          [-79.70, -4.50],
          [-80.00, -4.00],
          [-79.50, -3.60],
          [-79.25, -3.50],
        ],
      ],
    },
  },
  {
    id: 'imbabura',
    name: 'Imbabura',
    center: [0.3517, -78.1223],
    zoom: 10,
    cantons: [
      { id: 'ibarra', name: 'Ibarra', lat: 0.3517, lon: -78.1223 },
      { id: 'otavalo', name: 'Otavalo', lat: 0.2333, lon: -78.2667 },
      { id: 'cotacachi', name: 'Cotacachi', lat: 0.3000, lon: -78.2667 },
    ],
    geojson: {
      type: 'Polygon',
      coordinates: [
        [
          [-78.15, 0.70],
          [-77.85, 0.40],
          [-78.10, 0.15],
          [-78.55, 0.20],
          [-78.60, 0.60],
          [-78.15, 0.70],
        ],
      ],
    },
  },
  {
    id: 'manabi',
    name: 'Manabí',
    center: [-1.0546, -80.4544],
    zoom: 9,
    cantons: [
      { id: 'portoviejo', name: 'Portoviejo', lat: -1.0546, lon: -80.4544 },
      { id: 'manta', name: 'Manta', lat: -0.9677, lon: -80.7089 },
      { id: 'chone', name: 'Chone', lat: -0.6981, lon: -80.0936 },
    ],
    geojson: {
      type: 'Polygon',
      coordinates: [
        [
          [-80.10, 0.20],
          [-79.80, -0.60],
          [-80.20, -1.80],
          [-80.80, -1.60],
          [-80.70, -0.30],
          [-80.10, 0.20],
        ],
      ],
    },
  },
]

// Función auxiliar para calcular el valor base de fuego según semana y año
function calculateBaseFireValue(year: number, week: number, provinceFactor: number = 1.0): number {
  // Climatología ecuatoriana: temporada seca andina entre semanas 30 y 42, con pico semanas 34-38
  const peakWeek = 36
  const sigma = 3.5
  const gaussian = Math.exp(-Math.pow(week - peakWeek, 2) / (2 * Math.pow(sigma, 2)))

  // Pequeño pico secundario a inicios de año (semana 7-10 en algunas zonas)
  const minorPeak = 0.15 * Math.exp(-Math.pow(week - 8, 2) / (2 * 4))

  // Intensidad base por año
  let yearMultiplier = 1.0
  if (year === 2012) yearMultiplier = 2.45 // Año extremo 2012
  else if (year === 2024) yearMultiplier = 2.85 // Año extremo 2024 (incendios históricos recientes)
  else if (year === 2015 || year === 2016) yearMultiplier = 1.65 // Fenómeno El Niño moderado
  else if (year === 2005 || year === 2020) yearMultiplier = 1.4
  else if (year === 2008 || year === 2018) yearMultiplier = 0.65 // Años muy húmedos (La Niña)
  else {
    const prng = pseudoRandom(year * 7919)
    yearMultiplier = 0.75 + prng() * 0.6
  }

  // Ruido estocástico determinista por semana/año
  const prngWeek = pseudoRandom(year * 1000 + week * 13)
  const noise = 0.8 + prngWeek() * 0.4

  const baseFire = (3 + gaussian * 95 + minorPeak * 25) * yearMultiplier * provinceFactor * noise
  return Math.round(baseFire * 10) / 10
}

// Determinar la fuente satelital según el año y filtro
function resolveSource(year: number, sensorFilter: string): SourceType {
  if (sensorFilter === 'modis') return 'MODIS'
  if (sensorFilter === 'viirs') return 'VIIRS_CAL'
  if (year < 2012) return 'MODIS'
  if (year <= 2018) return 'BOTH'
  return 'VIIRS_CAL'
}

// Escala por sensor (datos simulados): VIIRS 375 m detecta ~2.3x más celdas activas que MODIS 1 km;
// MODIS muestra una ligera pérdida de sensibilidad desde 2017 (envejecimiento de Terra/Aqua).
// La serie armonizada calibra ambos sensores a una escala común (factor 1).
function sensorScale(year: number, sensor?: string): number {
  if (sensor === 'viirs') return 2.3
  if (sensor === 'modis') return year >= 2017 ? 0.82 : 1
  return 1
}

// Obtener factor de escala según filtros de confianza y día/noche
function getFilterScales(confidence: string, daynight: string): number {
  let scale = 1.0
  if (confidence === 'nominal_high') scale *= 0.82 // Filtra un 18% de detecciones de baja confianza
  if (daynight === 'D') scale *= 0.72 // 72% de focos son diurnos
  else if (daynight === 'N') scale *= 0.28 // 28% nocturnos
  return scale
}

// Factor multiplicador por provincia
function getProvinceFactor(provinceId?: string): number {
  switch (provinceId?.toLowerCase()) {
    case 'chimborazo':
      return 1.15
    case 'pichincha':
      return 1.35
    case 'loja':
      return 1.45
    case 'azuay':
      return 1.1
    case 'guayas':
      return 0.85
    case 'manabi':
      return 0.95
    case 'imbabura':
      return 1.05
    default:
      return 1.0
  }
}

// Simular API: GET /api/regions
export function mockGetRegions(): RegionsResponse {
  return MOCK_REGIONS
}

// Simular API: POST /api/calendar
export function mockGetCalendar(params: BaseFilterParams): CalendarResponse {
  const yearFrom = params.year_from || 2001
  const yearTo = params.year_to || 2025
  const filterScale = getFilterScales(params.confidence, params.daynight)
  const provFactor = getProvinceFactor(params.province_id)

  const weeks: CalendarWeekItem[] = []

  for (let y = yearFrom; y <= yearTo; y++) {
    for (let w = 1; w <= 52; w++) {
      const baseVal = calculateBaseFireValue(y, w, provFactor)
      const adjustedVal = Math.round(baseVal * filterScale * sensorScale(y, params.sensor) * 10) / 10
      const source = resolveSource(y, params.sensor)

      weeks.push({
        year: y,
        week: w,
        value: adjustedVal,
        source,
      })
    }
  }

  return {
    unit: 'fire_cell_days',
    weeks,
  }
}

// Simular API: POST /api/climatology
export function mockGetClimatology(params: BaseFilterParams): ClimatologyResponse {
  const provFactor = getProvinceFactor(params.province_id)
  const filterScale = getFilterScales(params.confidence, params.daynight)
  const weeks: ClimatologyWeekItem[] = []

  for (let w = 1; w <= 52; w++) {
    const historicalValues: number[] = []
    for (let y = 2001; y <= 2025; y++) {
      const val = calculateBaseFireValue(y, w, provFactor) * filterScale * sensorScale(y, params.sensor)
      historicalValues.push(val)
    }

    historicalValues.sort((a, b) => a - b)
    const n = historicalValues.length
    const sum = historicalValues.reduce((acc, curr) => acc + curr, 0)
    const mean = Math.round((sum / n) * 10) / 10
    const p10 = Math.round(historicalValues[Math.floor(n * 0.1)] * 10) / 10
    const p50 = Math.round(historicalValues[Math.floor(n * 0.5)] * 10) / 10
    const p90 = Math.round(historicalValues[Math.floor(n * 0.9)] * 10) / 10

    weeks.push({
      week: w,
      mean,
      p10,
      p50,
      p90,
    })
  }

  return { weeks }
}

// Simular API: POST /api/season
export function mockGetSeason(params: BaseFilterParams): SeasonResponse {
  const yearFrom = params.year_from || 2001
  const yearTo = params.year_to || 2025
  const provFactor = getProvinceFactor(params.province_id)
  const filterScale = getFilterScales(params.confidence, params.daynight)

  const years: SeasonYearItem[] = []

  for (let y = yearFrom; y <= yearTo; y++) {
    let maxVal = -1
    let peakWeek = 36
    let total = 0
    const weekValues: number[] = []

    for (let w = 1; w <= 52; w++) {
      const val = calculateBaseFireValue(y, w, provFactor) * filterScale * sensorScale(y, params.sensor)
      weekValues.push(val)
      total += val
      if (val > maxVal) {
        maxVal = val
        peakWeek = w
      }
    }

    // Umbral de inicio de temporada: cuando la actividad supera el 15% del pico
    const threshold = maxVal * 0.2
    let startWeek = 28
    let endWeek = 44

    for (let w = 1; w <= peakWeek; w++) {
      if (weekValues[w - 1] >= threshold) {
        startWeek = w
        break
      }
    }

    for (let w = peakWeek; w <= 52; w++) {
      if (weekValues[w - 1] < threshold) {
        endWeek = w
        break
      }
    }

    years.push({
      year: y,
      start_week: startWeek,
      peak_week: peakWeek,
      end_week: endWeek,
      total: Math.round(total * 10) / 10,
    })
  }

  return { years }
}

// Simular API: POST /api/anomalies
export function mockGetAnomalies(params: BaseFilterParams): AnomaliesResponse {
  const calendar = mockGetCalendar(params)
  const climatology = mockGetClimatology(params)
  const climMap = new Map(climatology.weeks.map((c) => [c.week, c]))

  const items: {
    year: number
    week: number
    value: number
    zscore: number
    percentile: number
  }[] = []

  // Calcular desviación estándar semanal
  const stdMap = new Map<number, number>()
  for (let w = 1; w <= 52; w++) {
    const c = climMap.get(w)!
    const yearVals = calendar.weeks.filter((k) => k.week === w).map((k) => k.value)
    const variance = yearVals.reduce((acc, v) => acc + Math.pow(v - c.mean, 2), 0) / yearVals.length
    const std = Math.sqrt(variance) || 1
    stdMap.set(w, std)
  }

  calendar.weeks.forEach((item) => {
    const c = climMap.get(item.week)
    if (!c) return
    const std = stdMap.get(item.week) || 1
    const zscore = Math.round(((item.value - c.mean) / std) * 100) / 100

    // Si zscore es significativo (> 1.6) o percentil alto
    if (zscore >= 1.6 && item.value > 15) {
      // Cálculo aproximado de percentil normal
      const percentile = Math.min(99.9, Math.round((0.5 * (1 + Math.tanh(zscore * 0.797885))) * 1000) / 10)
      items.push({
        year: item.year,
        week: item.week,
        value: item.value,
        zscore,
        percentile,
      })
    }
  })

  // Ordenar por zscore descendente
  items.sort((a, b) => b.zscore - a.zscore)

  return { items }
}

// Simular API: POST /api/hotspots
export function mockGetHotspots(params: HotspotRequestParams): HotspotsResponse {
  const year = params.year || 2024
  const week = params.week || 36
  const provFactor = getProvinceFactor(params.province_id)
  const baseValue = calculateBaseFireValue(year, week, provFactor)

  // Determinar centro del país o ciudad
  let centerLat = -1.8312
  let centerLon = -78.1834

  if (params.canton_id) {
    const code = (params.country_code || 'ECU').toUpperCase()
    const cities = (WORLD_CITIES as Record<string, any[]>)[code] || []
    const city = cities.find((c) => c.id === params.canton_id)
    if (city) {
      centerLat = city.lat
      centerLon = city.lon
    }
  } else if (params.country_code) {
    const country = (PAISES_177 as any[]).find((c) => c.code === params.country_code?.toUpperCase())
    if (country) {
      centerLat = country.lat
      centerLon = country.lon
    }
  } else if (params.province_id) {
    const region = MOCK_REGIONS.find((r) => r.id === params.province_id) || MOCK_REGIONS[0]
    centerLat = region.center[0]
    centerLon = region.center[1]
  }

  // Cantidad de puntos proporcionales al valor de fire_cell_days
  const count = Math.min(180, Math.max(4, Math.floor(baseValue * 0.7)))
  const prng = pseudoRandom(year * 31337 + week * 997)

  const points: HotspotPoint[] = []
  const sensors = params.sensor === 'modis' ? ['MODIS'] : params.sensor === 'viirs' ? ['VIIRS'] : ['VIIRS', 'MODIS', 'VIIRS']

  // Calcular fechas de la semana
  const dayOfYear = (week - 1) * 7 + 1
  for (let i = 0; i < count; i++) {
    // Generar dispersión en racimos (clusters de fuego realistas)
    const cluster = Math.floor(prng() * 4)
    const clusterOffsets = [
      [0.08, -0.05],
      [-0.12, 0.09],
      [0.04, 0.14],
      [-0.06, -0.11],
    ]
    const cOffset = clusterOffsets[cluster]

    const latOffset = cOffset[0] + (prng() - 0.5) * 0.09
    const lonOffset = cOffset[1] + (prng() - 0.5) * 0.09

    // FRP: Fire Radiative Power en Megawatts
    // La mayoría entre 8 y 45 MW, con algunos focos intensos de 100-240 MW
    const isIntense = prng() > 0.85
    const frp = isIntense
      ? Math.round((70 + prng() * 150) * 10) / 10
      : Math.round((8 + prng() * 55) * 10) / 10

    const dayDelta = Math.floor(prng() * 7)
    const dateObj = new Date(year, 0, dayOfYear + dayDelta)
    const dateStr = dateObj.toISOString().split('T')[0]

    const sensor = sensors[Math.floor(prng() * sensors.length)]

    points.push({
      lat: Math.round((centerLat + latOffset) * 10000) / 10000,
      lon: Math.round((centerLon + lonOffset) * 10000) / 10000,
      date: dateStr,
      frp,
      sensor,
    })
  }

  return { points }
}

// Simular API: POST /api/current-status
export function mockGetCurrentStatus(params: BaseFilterParams): CurrentStatusResponse {
  // Semana actual en el contexto del NASA Space Apps Challenge (o semana 36/46)
  const currentWeek = 37 // Semana crítica de la temporada seca andina
  const currentYear = 2024
  const provFactor = getProvinceFactor(params.province_id)
  const filterScale = getFilterScales(params.confidence, params.daynight)

  const value =
    Math.round(
      calculateBaseFireValue(currentYear, currentWeek, provFactor) * filterScale * sensorScale(currentYear, params.sensor) * 10
    ) / 10
  const climatology = mockGetClimatology(params)
  const climWeek = climatology.weeks.find((w) => w.week === currentWeek) || climatology.weeks[36]

  // Cálculo de zscore respecto al histórico de esa semana
  const calendar = mockGetCalendar(params)
  const weekVals = calendar.weeks.filter((k) => k.week === currentWeek).map((k) => k.value)
  const variance = weekVals.reduce((acc, v) => acc + Math.pow(v - climWeek.mean, 2), 0) / (weekVals.length || 1)
  const std = Math.sqrt(variance) || 1
  const zscore = Math.round(((value - climWeek.mean) / std) * 100) / 100

  // Percentil histórico
  const countBelow = weekVals.filter((v) => v <= value).length
  const percentile = Math.min(99.8, Math.round((countBelow / (weekVals.length || 1)) * 1000) / 10)

  let level: StatusLevel = 'normal'
  if (zscore >= 2.0 || percentile >= 90) {
    level = 'inusual'
  } else if (zscore >= 1.0 || percentile >= 70) {
    level = 'elevado'
  }

  return {
    year: currentYear,
    week: currentWeek,
    value,
    percentile,
    zscore,
    level,
  }
}
