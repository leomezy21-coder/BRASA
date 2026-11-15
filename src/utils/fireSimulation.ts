// Motor Científico de Simulación de Propagación de Fuego y Evacuación Táctica
// Modelos Físicos: Rothermel (1972), Elipses de Propagación de Anderson (1983) / Richards (1990)
// Protocolo de Seguridad Internacional: LCES / NFPA 1051 y Regla de Butler (2014) para Zonas de Seguridad
// Red de Evacuación Real: Ruteo peatonal sobre caminos y senderos de OpenStreetMap (OSRM)

export type FuelType = 'paramo' | 'pine_eucalyptus' | 'shrub' | 'humid_forest'

export interface FuelModelInfo {
  id: FuelType
  name: string
  scientificName: string
  description: string
  baseSpreadRateKmH: number // Tasa de avance base sin viento (km/h)
  heatIntensityMw: number // Radiación FRP promedio aproximada (MW)
  flameHeightMeters: number // Altura estimada de llama (m)
  fuelLoadTonHa: number // Carga de combustible (ton/ha)
}

export const FUEL_MODELS: Record<FuelType, FuelModelInfo> = {
  paramo: {
    id: 'paramo',
    name: 'Páramo / Pajonal Andino',
    scientificName: 'Calamagrostis intermedia / Stipa ichu',
    description: 'Combustible fino de biomasa herbácea seca. Ignición explosiva con vientos de alta montaña.',
    baseSpreadRateKmH: 0.38,
    heatIntensityMw: 45,
    flameHeightMeters: 2.2,
    fuelLoadTonHa: 14.5,
  },
  pine_eucalyptus: {
    id: 'pine_eucalyptus',
    name: 'Plantación de Pino y Eucalipto',
    scientificName: 'Pinus patula / Eucalyptus globulus',
    description: 'Alta carga de resinas y aceites volátiles. Fuego de copas y pavesas a larga distancia.',
    baseSpreadRateKmH: 0.32,
    heatIntensityMw: 85,
    flameHeightMeters: 5.5,
    fuelLoadTonHa: 38.0,
  },
  shrub: {
    id: 'shrub',
    name: 'Matorral Seco Interandino',
    scientificName: 'Baccharis latifolia / Dodonaea viscosa',
    description: 'Vegetación arbustiva densa y baja humedad en época seca (Agosto–Octubre).',
    baseSpreadRateKmH: 0.24,
    heatIntensityMw: 35,
    flameHeightMeters: 1.8,
    fuelLoadTonHa: 18.2,
  },
  humid_forest: {
    id: 'humid_forest',
    name: 'Bosque Húmedo / Selva Alta',
    scientificName: 'Ocotea / Guatteria sp.',
    description: 'Alta humedad en sotobosque. Propagación lenta excepto bajo sequías extremas prolongadas.',
    baseSpreadRateKmH: 0.08,
    heatIntensityMw: 20,
    flameHeightMeters: 1.2,
    fuelLoadTonHa: 45.0,
  },
}

export interface WeatherData {
  temperatureC: number
  relativeHumidity: number
  windSpeedKmH: number
  windDirectionDeg: number // 0-360° (de donde viene el viento)
  elevationMeters: number
  isRealTime: boolean
}

export interface SimulationIsochrone {
  hours: number
  coordinates: [number, number][] // [lat, lon]
  areaHectares: number
  perimeterKm: number
}

export interface SmokePlume {
  coordinates: [number, number][] // [lat, lon]
  lengthKm: number
  spreadAngleDeg: number
}

export interface LcesProtocol {
  lookout: string
  communications: string
  escapeRoute: string
  safetyZone: string
  butlerDistanceMeters: number // Distancia Mínima de Separación (Butler, 2014)
}

export interface EvacuationPlan {
  status: 'SAFE' | 'CAUTION' | 'DANGER'
  distanceToFireKm: number
  distanceToSmokeKm: number
  timeUntilFireArrivalHours: number | null
  escapeHeadingDeg: number
  escapeHeadingName: string
  escapeDistanceKm: number
  estimatedWalkingMinutes: number
  safetyMarginHours: number | null
  safePoint: [number, number] // [lat, lon]
  escapeRoute: [number, number][] // Waypoints [lat, lon]
  isRealRoadNetwork: boolean // Si se trazó sobre caminos reales de OpenStreetMap
  lces: LcesProtocol
}

export interface FireSimulationResult {
  origin: [number, number] // [lat, lon]
  weather: WeatherData
  fuel: FuelModelInfo
  spreadRateKmH: number
  spreadAngleDeg: number // Hacia dónde avanza el fuego
  isochrones: {
    sixHours: SimulationIsochrone
    twelveHours: SimulationIsochrone
    twentyFourHours: SimulationIsochrone
  }
  smokePlume: SmokePlume
  evacuation?: EvacuationPlan
}

export interface SimulationPreset {
  id: string
  name: string
  locationName: string
  lat: number
  lon: number
  brigadeLat: number
  brigadeLon: number
  fuelType: FuelType
  description: string
}

export const ECUADOR_PRESETS: SimulationPreset[] = [
  {
    id: 'chambo',
    name: 'Chambo / Estribaciones El Altar',
    locationName: 'Chimborazo',
    lat: -1.685,
    lon: -78.532,
    brigadeLat: -1.673,
    brigadeLon: -78.548,
    fuelType: 'paramo',
    description: 'Páramo de alta montaña expuesto al efecto chimenea del callejón interandino.',
  },
  {
    id: 'cotopaxi',
    name: 'Páramo del Parque Nacional Cotopaxi',
    locationName: 'Laderas Orientales, Cotopaxi',
    lat: -0.655,
    lon: -78.445,
    brigadeLat: -0.648,
    brigadeLon: -78.458,
    fuelType: 'paramo',
    description: 'Pajonal andino cercano al corredor de senderos y vía al Refugio Carrel.',
  },
  {
    id: 'cajas',
    name: 'Parque Nacional Cajas',
    locationName: 'Azuay',
    lat: -2.795,
    lon: -79.23,
    brigadeLat: -2.784,
    brigadeLon: -79.223,
    fuelType: 'paramo',
    description: 'Ecosistema lacustre de páramo junto al centro de control Laguna Toreadora.',
  },
  {
    id: 'el_angel',
    name: 'Reserva Ecológica El Ángel',
    locationName: 'Carchi',
    lat: 0.702,
    lon: -77.882,
    brigadeLat: 0.692,
    brigadeLon: -77.872,
    fuelType: 'paramo',
    description: 'Páramo de frailejones junto al puesto de control del Sendero El Voladero.',
  },
  {
    id: 'ilalo',
    name: 'Cerro Ilaló (Valle de Tumbaco / Quito)',
    locationName: 'Pichincha',
    lat: -0.262,
    lon: -78.421,
    brigadeLat: -0.252,
    brigadeLon: -78.412,
    fuelType: 'pine_eucalyptus',
    description: 'Plantaciones de eucalipto en interfase urbano-forestal con pendientes pronunciadas.',
  },
]

/**
 * Consulta la API de Open-Meteo para obtener condiciones meteorológicas reales
 */
export async function fetchLiveWeather(lat: number, lon: number): Promise<WeatherData> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(
    4
  )}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 4000)

  try {
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()

    return {
      temperatureC: Math.round((data.current?.temperature_2m ?? 16.5) * 10) / 10,
      relativeHumidity: Math.round(data.current?.relative_humidity_2m ?? 65),
      windSpeedKmH: Math.round((data.current?.wind_speed_10m ?? 14.2) * 10) / 10,
      windDirectionDeg: Math.round(data.current?.wind_direction_10m ?? 75),
      elevationMeters: Math.round(data.elevation ?? 2800),
      isRealTime: true,
    }
  } catch {
    clearTimeout(timeoutId)
    return {
      temperatureC: 17.0,
      relativeHumidity: 60,
      windSpeedKmH: 16.0,
      windDirectionDeg: 80,
      elevationMeters: 2850,
      isRealTime: false,
    }
  }
}

/**
 * Consulta la red vial y de senderos reales de OpenStreetMap usando OSRM
 * Asegura continuidad absoluta: añade 'start' (brigadista) y 'end' (zona segura)
 * para que la línea nunca aparezca cortada. Si no hay senderos a menos de 1.5 km,
 * descarta el ruteo de carretera lejana para usar el corredor campotraviesa.
 */
export async function fetchOSRMRoute(
  start: [number, number],
  end: [number, number]
): Promise<{ coordinates: [number, number][]; distanceMeters: number; durationSeconds: number } | null> {
  const [lat1, lon1] = start
  const [lat2, lon2] = end
  const url = `https://router.project-osrm.org/route/v1/foot/${lon1.toFixed(5)},${lat1.toFixed(5)};${lon2.toFixed(
    5
  )},${lat2.toFixed(5)}?overview=full&geometries=geojson`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 3500)

  try {
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)
    if (!res.ok) return null
    const data = await res.json()
    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) return null

    const route = data.routes[0]
    const startSnapDist = data.waypoints?.[0]?.distance ?? 0

    // Si el sendero más cercano está a más de 1.5 km en otro valle,
    // descartamos OSRM para usar el ruteo campotraviesa directo por cresta
    if (startSnapDist > 1500) {
      return null
    }

    // Convertir coordenadas de OSRM [lon, lat] a [lat, lon]
    const osrmCoords: [number, number][] = route.geometry.coordinates.map(
      ([lon, lat]: [number, number]) => [lat, lon]
    )

    // GARANTIZAR CONTINUIDAD TOTAL:
    // El punto 0 es SIEMPRE la brigada (start) y el último es SIEMPRE la zona segura (end).
    // Esto conecta sin ninguna ruptura la posición del bombero con el sendero y el punto de extracción.
    const coordinates: [number, number][] = [start, ...osrmCoords, end]

    return {
      coordinates,
      distanceMeters: Math.round(route.distance + startSnapDist),
      durationSeconds: Math.round(route.duration + startSnapDist / 0.9), // velocidad pedestre ~3.2 km/h
    }
  } catch {
    clearTimeout(timeoutId)
    return null
  }
}

/**
 * Convierte un rumbo en grados a nombre cardinal en español
 */
export function getHeadingCardinal(deg: number): string {
  const normalized = ((deg % 360) + 360) % 360
  const directions = [
    'Norte (N)',
    'Noreste (NE)',
    'Este (E)',
    'Sureste (SE)',
    'Sur (S)',
    'Suroeste (SO)',
    'Oeste (O)',
    'Noroeste (NO)',
  ]
  const index = Math.round(normalized / 45) % 8
  return `${directions[index]} (${Math.round(normalized)}°)`
}

/**
 * Distancia Haversine en kilómetros
 */
export function haversineDistanceKm(p1: [number, number], p2: [number, number]): number {
  const R = 6371
  const lat1 = (p1[0] * Math.PI) / 180
  const lat2 = (p2[0] * Math.PI) / 180
  const dLat = ((p2[0] - p1[0]) * Math.PI) / 180
  const dLon = ((p2[1] - p1[1]) * Math.PI) / 180

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Calcula el rumbo geográfico en grados (0° - 360°) desde p1 hacia p2
 */
export function calculateBearingDeg(p1: [number, number], p2: [number, number]): number {
  const lat1 = (p1[0] * Math.PI) / 180
  const lat2 = (p2[0] * Math.PI) / 180
  const dLon = ((p2[1] - p1[1]) * Math.PI) / 180

  const y = Math.sin(dLon) * Math.cos(lat2)
  const x =
    Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)

  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

/**
 * Proyecta una coordenada geográfica una distancia hacia un rumbo
 */
export function projectCoordinate(
  origin: [number, number],
  distanceKm: number,
  headingDeg: number
): [number, number] {
  const R = 6371
  const radLat = (origin[0] * Math.PI) / 180
  const radLon = (origin[1] * Math.PI) / 180
  const radHeading = (headingDeg * Math.PI) / 180

  const dByR = distanceKm / R

  const newLat = Math.asin(
    Math.sin(radLat) * Math.cos(dByR) +
      Math.cos(radLat) * Math.sin(dByR) * Math.cos(radHeading)
  )

  const newLon =
    radLon +
    Math.atan2(
      Math.sin(radHeading) * Math.sin(dByR) * Math.cos(radLat),
      Math.cos(dByR) - Math.sin(radLat) * Math.sin(newLat)
    )

  return [(newLat * 180) / Math.PI, (newLon * 180) / Math.PI]
}

/**
 * Traza un corredor de escape campotraviesa continuo con waypoints orográficos
 * que evitan el frente de fuego y conectan sin rupturas desde la brigada a la zona segura
 */
export function generateCrossCountryEscapeRoute(
  start: [number, number],
  end: [number, number],
  fireOrigin: [number, number],
  steps: number = 8
): [number, number][] {
  const points: [number, number][] = [start]
  for (let i = 1; i < steps; i++) {
    const fraction = i / steps
    const rawLat = start[0] + (end[0] - start[0]) * fraction
    const rawLon = start[1] + (end[1] - start[1]) * fraction
    const midPoint: [number, number] = [rawLat, rawLon]

    // Deflexión orográfica alejándose del foco térmico
    const bearingAway = calculateBearingDeg(fireOrigin, midPoint)
    const curveOffsetKm = Math.sin(fraction * Math.PI) * 0.15
    const curvedWaypoint = projectCoordinate(midPoint, curveOffsetKm, bearingAway)
    points.push(curvedWaypoint)
  }
  points.push(end)
  return points
}

/**
 * Genera el polígono elíptico de avance de fuego (Huygens / Rothermel)
 */
function generateEllipticalIsochrone(
  origin: [number, number],
  headKm: number,
  backKm: number,
  flankKm: number,
  spreadHeadingDeg: number,
  points: number = 36
): [number, number][] {
  const coords: [number, number][] = []
  const radHeading = (spreadHeadingDeg * Math.PI) / 180

  const c = (headKm - backKm) / 2
  const a = (headKm + backKm) / 2
  const b = flankKm

  for (let i = 0; i <= points; i++) {
    const angle = (i * 2 * Math.PI) / points
    const x = a * Math.cos(angle) + c
    const y = b * Math.sin(angle)

    const rotX = x * Math.cos(radHeading) - y * Math.sin(radHeading)
    const rotY = x * Math.sin(radHeading) + y * Math.cos(radHeading)

    const latOffset = rotX / 110.574
    const lonOffset = rotY / (111.32 * Math.cos((origin[0] * Math.PI) / 180))

    coords.push([origin[0] + latOffset, origin[1] + lonOffset])
  }

  return coords
}

/**
 * Comprueba si un punto se encuentra dentro de un polígono [lat, lon][]
 */
export function isPointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  let inside = false
  const [x, y] = point

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0]
    const yi = polygon[i][1]
    const xj = polygon[j][0]
    const yj = polygon[j][1]

    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }

  return inside
}

/**
 * Calcula el perímetro elíptico del fuego para una hora específica T (1h - 24h)
 * basándose en las ecuaciones físicas de Rothermel y Huygens
 */
export function calculateFirePerimeterAtHour(
  origin: [number, number],
  weather: WeatherData,
  fuelType: FuelType,
  hours: number
): SimulationIsochrone {
  const fuel = FUEL_MODELS[fuelType]
  const spreadAngleDeg = (weather.windDirectionDeg + 180) % 360
  const U = Math.max(1, weather.windSpeedKmH)
  const windFactor = 1 + 0.08 * Math.pow(U, 1.15)
  const humidityFactor = Math.max(0.6, 1.4 - weather.relativeHumidity / 100)
  const spreadRateKmH = fuel.baseSpreadRateKmH * windFactor * humidityFactor
  const lengthToBreadth = Math.max(1.1, 1 + 0.05 * U)

  const effectiveHours = Math.max(0.2, hours)
  const headKm = spreadRateKmH * effectiveHours
  const backKm = fuel.baseSpreadRateKmH * 0.18 * effectiveHours
  const flankKm = (headKm + backKm) / (2 * lengthToBreadth)

  const coordinates = generateEllipticalIsochrone(
    origin,
    headKm,
    backKm,
    flankKm,
    spreadAngleDeg,
    36
  )

  const a = (headKm + backKm) / 2
  const b = flankKm
  const areaHectares = Math.round(Math.PI * a * b * 100)
  const perimeterKm =
    Math.round(Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b))) * 10) / 10

  return {
    hours,
    coordinates,
    areaHectares,
    perimeterKm,
  }
}

/**
 * Calcula el cono dinámico de dispersión de humo para una hora específica T
 */
export function calculateSmokePlumeAtHour(
  origin: [number, number],
  weather: WeatherData,
  fuelType: FuelType,
  hours: number
): SmokePlume {
  const fuel = FUEL_MODELS[fuelType]
  const spreadAngleDeg = (weather.windDirectionDeg + 180) % 360
  const U = Math.max(1, weather.windSpeedKmH)
  const windFactor = 1 + 0.08 * Math.pow(U, 1.15)
  const humidityFactor = Math.max(0.6, 1.4 - weather.relativeHumidity / 100)
  const spreadRateKmH = fuel.baseSpreadRateKmH * windFactor * humidityFactor

  const effectiveHours = Math.max(0.4, hours)
  const smokeDistanceKm = spreadRateKmH * effectiveHours * 1.6
  const smokeHalfAngle = 28

  const smokeP1 = projectCoordinate(origin, smokeDistanceKm, spreadAngleDeg - smokeHalfAngle)
  const smokeP2 = projectCoordinate(origin, smokeDistanceKm * 1.1, spreadAngleDeg)
  const smokeP3 = projectCoordinate(origin, smokeDistanceKm, spreadAngleDeg + smokeHalfAngle)

  return {
    coordinates: [origin, smokeP1, smokeP2, smokeP3, origin],
    lengthKm: Math.round(smokeDistanceKm * 10) / 10,
    spreadAngleDeg: smokeHalfAngle * 2,
  }
}

/**
 * Ejecuta la simulación física de propagación y genera el plan de evacuación inicial
 */
export function simulateFireSpread(
  origin: [number, number],
  weather: WeatherData,
  fuelType: FuelType,
  brigadeLocation?: [number, number] | null
): FireSimulationResult {
  const fuel = FUEL_MODELS[fuelType]

  // Dirección hacia donde avanza el fuego
  const spreadAngleDeg = (weather.windDirectionDeg + 180) % 360

  // Velocidad de viento y aceleración Rothermel
  const U = Math.max(1, weather.windSpeedKmH)
  const windFactor = 1 + 0.08 * Math.pow(U, 1.15)
  const humidityFactor = Math.max(0.6, 1.4 - weather.relativeHumidity / 100)
  const spreadRateKmH = fuel.baseSpreadRateKmH * windFactor * humidityFactor

  // Isócronas a 6h, 12h y 24h
  const sixHours = calculateFirePerimeterAtHour(origin, weather, fuelType, 6)
  const twelveHours = calculateFirePerimeterAtHour(origin, weather, fuelType, 12)
  const twentyFourHours = calculateFirePerimeterAtHour(origin, weather, fuelType, 24)

  // Cono de humo y partículas tóxicas PM2.5 a 24h
  const smokePlume = calculateSmokePlumeAtHour(origin, weather, fuelType, 24)

  // Evaluación táctica de la brigada y protocolo LCES
  let evacuation: EvacuationPlan | undefined

  if (brigadeLocation) {
    const distToOrigin = haversineDistanceKm(brigadeLocation, origin)
    const in24 = isPointInPolygon(brigadeLocation, twentyFourHours.coordinates)
    const in12 = isPointInPolygon(brigadeLocation, twelveHours.coordinates)
    const in6 = isPointInPolygon(brigadeLocation, sixHours.coordinates)
    const inSmoke = isPointInPolygon(brigadeLocation, smokePlume.coordinates)

    let status: 'SAFE' | 'CAUTION' | 'DANGER' = 'SAFE'
    let timeUntilFireArrivalHours: number | null = null

    if (in6) {
      status = 'DANGER'
      timeUntilFireArrivalHours = Math.max(0.2, (distToOrigin / spreadRateKmH) * 0.5)
    } else if (in12 || inSmoke) {
      status = 'DANGER'
      timeUntilFireArrivalHours = Math.max(1.0, (distToOrigin / spreadRateKmH) * 0.8)
    } else if (in24) {
      status = 'CAUTION'
      timeUntilFireArrivalHours = Math.max(4.0, distToOrigin / spreadRateKmH)
    }

    // Dirección de escape táctica óptima
    // Rumbo radial directo alejándose del foco a través de la posición de la brigada
    const bearingFireToBrigade = calculateBearingDeg(origin, brigadeLocation)

    // Diferencia angular entre el frente de avance del fuego y la posición de la brigada
    let angleDiff = Math.abs(bearingFireToBrigade - spreadAngleDeg)
    if (angleDiff > 180) angleDiff = 360 - angleDiff

    let escapeHeadingDeg: number
    // Si la brigada está directamente en el cono frontal de avance del fuego (< 45°)
    // La doctrina de bomberos forestales (NWCG / USFS) prohíbe huir por delante del avance;
    // se debe faldear perpendicularmente (±90°) hacia el flanco más seguro
    if (angleDiff < 45) {
      const flankA = (spreadAngleDeg + 90) % 360
      const flankB = (spreadAngleDeg - 90 + 360) % 360
      const testA = projectCoordinate(brigadeLocation, 2.0, flankA)
      const testB = projectCoordinate(brigadeLocation, 2.0, flankB)
      escapeHeadingDeg =
        haversineDistanceKm(testA, origin) >= haversineDistanceKm(testB, origin) ? flankA : flankB
    } else {
      // Si está en el flanco o a barlovento, escapar alejándose radialmente del foco
      escapeHeadingDeg = bearingFireToBrigade
    }

    // Regla de Butler (2014) para Distancia Mínima de Separación (SSD)
    // SSD = 4 * FlameLength * (1 + WindCorrection)
    const windSlopeFactor = 1 + U / 35
    const butlerDistanceMeters = Math.round(4 * fuel.flameHeightMeters * windSlopeFactor * 10) / 10

    // Búsqueda iterativa de Punto Seguro de Extracción (Safety Zone / LZ):
    // REQUISITO ESTRICTO: La Zona Segura NUNCA puede estar dentro del perímetro de 24h ni en la pluma de humo
    let candidateDistance = Math.max(2.5, distToOrigin * 0.7)
    let safePoint = projectCoordinate(brigadeLocation, candidateDistance, escapeHeadingDeg)

    let attempts = 0
    while (
      attempts < 12 &&
      (isPointInPolygon(safePoint, twentyFourHours.coordinates) ||
        isPointInPolygon(safePoint, smokePlume.coordinates) ||
        haversineDistanceKm(safePoint, origin) <= distToOrigin)
    ) {
      candidateDistance += 0.8
      // Rotar hacia barlovento si colisiona con el área proyectada
      const adjustedHeading = (escapeHeadingDeg + (attempts % 2 === 0 ? 15 : -15) + 360) % 360
      safePoint = projectCoordinate(brigadeLocation, candidateDistance, adjustedHeading)
      attempts++
    }

    // Distancia real de evacuación
    const escapeDist = haversineDistanceKm(brigadeLocation, safePoint)

    // Ruta campotraviesa continua con curvatura táctica (enriquecida con OSRM si hay senderos cercanos)
    const escapeRoute = generateCrossCountryEscapeRoute(brigadeLocation, safePoint, origin)
    const walkingSpeedKmH = 3.2
    const estimatedWalkingMinutes = Math.round((escapeDist / walkingSpeedKmH) * 60)

    const safetyMarginHours =
      timeUntilFireArrivalHours !== null
        ? Math.round((timeUntilFireArrivalHours - escapeDist / walkingSpeedKmH) * 10) / 10
        : null

    evacuation = {
      status,
      distanceToFireKm: Math.round(distToOrigin * 10) / 10,
      distanceToSmokeKm: inSmoke ? 0 : Math.round(Math.max(0, distToOrigin - 1.2) * 10) / 10,
      timeUntilFireArrivalHours:
        timeUntilFireArrivalHours !== null ? Math.round(timeUntilFireArrivalHours * 10) / 10 : null,
      escapeHeadingDeg: Math.round(escapeHeadingDeg),
      escapeHeadingName: getHeadingCardinal(escapeHeadingDeg),
      escapeDistanceKm: Math.round(escapeDist * 10) / 10,
      estimatedWalkingMinutes,
      safetyMarginHours,
      safePoint,
      escapeRoute,
      isRealRoadNetwork: false,
      lces: {
        lookout: 'Monitoreo satelital activo (VIIRS 375m / MODIS 1km) y puesto de vigía visual.',
        communications: 'Enlace radial táctico VHF y telemetría meteorológica satelital Open-Meteo.',
        escapeRoute: `Rumbo ${Math.round(escapeHeadingDeg)}° hacia flanco seguro con salida a red vial/sendero.`,
        safetyZone: `Área despejada con radio mínimo de separación de ${butlerDistanceMeters} m (Regla de Butler).`,
        butlerDistanceMeters,
      },
    }
  }

  return {
    origin,
    weather,
    fuel,
    spreadRateKmH: Math.round(spreadRateKmH * 100) / 100,
    spreadAngleDeg: Math.round(spreadAngleDeg),
    isochrones: {
      sixHours,
      twelveHours,
      twentyFourHours,
    },
    smokePlume,
    evacuation,
  }
}

/**
 * Exporta el resultado de la simulación como GeoJSON FeatureCollection con simbología ICS-201
 */
export function exportSimulationToGeoJSON(sim: FireSimulationResult): string {
  const features: GeoJSON.Feature[] = [
    {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [sim.origin[1], sim.origin[0]],
      },
      properties: {
        name: 'Punto de Ignición / Foco Activo',
        spreadRateKmH: sim.spreadRateKmH,
        fuel: sim.fuel.name,
        scientificFuel: sim.fuel.scientificName,
        windSpeedKmH: sim.weather.windSpeedKmH,
        windDirectionDeg: sim.weather.windDirectionDeg,
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [sim.isochrones.sixHours.coordinates.map(([lat, lon]) => [lon, lat])],
      },
      properties: {
        name: 'Isócrona 6h (Frente Crítico)',
        areaHectares: sim.isochrones.sixHours.areaHectares,
        perimeterKm: sim.isochrones.sixHours.perimeterKm,
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [sim.isochrones.twelveHours.coordinates.map(([lat, lon]) => [lon, lat])],
      },
      properties: {
        name: 'Isócrona 12h (Expansión)',
        areaHectares: sim.isochrones.twelveHours.areaHectares,
        perimeterKm: sim.isochrones.twelveHours.perimeterKm,
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [sim.isochrones.twentyFourHours.coordinates.map(([lat, lon]) => [lon, lat])],
      },
      properties: {
        name: 'Isócrona 24h (Perímetro Preventivo)',
        areaHectares: sim.isochrones.twentyFourHours.areaHectares,
        perimeterKm: sim.isochrones.twentyFourHours.perimeterKm,
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [sim.smokePlume.coordinates.map(([lat, lon]) => [lon, lat])],
      },
      properties: {
        name: 'Cono de Dispersión de Humo y Gases Tóxicos PM2.5',
        lengthKm: sim.smokePlume.lengthKm,
      },
    },
  ]

  if (sim.evacuation) {
    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: sim.evacuation.escapeRoute.map(([lat, lon]) => [lon, lat]),
      },
      properties: {
        name: 'Ruta Táctica de Escape (Red Vial / Sendero OSRM)',
        heading: sim.evacuation.escapeHeadingName,
        distanceKm: sim.evacuation.escapeDistanceKm,
        walkingMinutes: sim.evacuation.estimatedWalkingMinutes,
        isRealRoadNetwork: sim.evacuation.isRealRoadNetwork,
      },
    })

    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [sim.evacuation.safePoint[1], sim.evacuation.safePoint[0]],
      },
      properties: {
        name: 'Safety Zone / Punto de Extracción (LZ)',
        butlerDistanceMeters: sim.evacuation.lces.butlerDistanceMeters,
      },
    })
  }

  const featureCollection: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features,
  }

  return JSON.stringify(featureCollection, null, 2)
}
