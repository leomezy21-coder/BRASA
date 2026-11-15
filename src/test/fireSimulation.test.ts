import { describe, it, expect } from 'vitest'
import {
  simulateFireSpread,
  calculateFirePerimeterAtHour,
  calculateSmokePlumeAtHour,
  exportSimulationToGeoJSON,
  haversineDistanceKm,
  isPointInPolygon,
  projectCoordinate,
  type WeatherData,
} from '../utils/fireSimulation'

describe('Motor de Simulación Física FireCast & Evacuación Táctica', () => {
  const origin: [number, number] = [-1.685, -78.532] // Chambo, Ecuador

  const mockWeather: WeatherData = {
    temperatureC: 18,
    relativeHumidity: 50,
    windSpeedKmH: 20,
    windDirectionDeg: 90, // Viento soplando desde el Este hacia el Oeste (270°)
    elevationMeters: 2900,
    isRealTime: true,
  }

  it('calcula la propagación de fuego y genera isócronas a 6h, 12h y 24h', () => {
    const sim = simulateFireSpread(origin, mockWeather, 'paramo')

    expect(sim.spreadRateKmH).toBeGreaterThan(0)
    expect(sim.spreadAngleDeg).toBe(270) // (90 + 180) % 360

    // Verificar isócronas elípticas
    expect(sim.isochrones.sixHours.coordinates.length).toBeGreaterThan(10)
    expect(sim.isochrones.twelveHours.coordinates.length).toBeGreaterThan(10)
    expect(sim.isochrones.twentyFourHours.coordinates.length).toBeGreaterThan(10)

    // El área debe ser creciente en el tiempo
    expect(sim.isochrones.twelveHours.areaHectares).toBeGreaterThan(
      sim.isochrones.sixHours.areaHectares
    )
    expect(sim.isochrones.twentyFourHours.areaHectares).toBeGreaterThan(
      sim.isochrones.twelveHours.areaHectares
    )
  })

  it('calcula el cono de humo y gases tóxicos a favor del viento', () => {
    const sim = simulateFireSpread(origin, mockWeather, 'paramo')

    expect(sim.smokePlume.coordinates.length).toBeGreaterThanOrEqual(4)
    expect(sim.smokePlume.lengthKm).toBeGreaterThan(0)
  })

  it('calcula la evolución temporal dinámica hora a hora (1h a 24h)', () => {
    const h1 = calculateFirePerimeterAtHour(origin, mockWeather, 'paramo', 1)
    const h6 = calculateFirePerimeterAtHour(origin, mockWeather, 'paramo', 6)
    const h12 = calculateFirePerimeterAtHour(origin, mockWeather, 'paramo', 12)
    const h24 = calculateFirePerimeterAtHour(origin, mockWeather, 'paramo', 24)

    expect(h1.areaHectares).toBeGreaterThan(0)
    expect(h6.areaHectares).toBeGreaterThan(h1.areaHectares)
    expect(h12.areaHectares).toBeGreaterThan(h6.areaHectares)
    expect(h24.areaHectares).toBeGreaterThan(h12.areaHectares)

    const smokeH1 = calculateSmokePlumeAtHour(origin, mockWeather, 'paramo', 1)
    const smokeH24 = calculateSmokePlumeAtHour(origin, mockWeather, 'paramo', 24)
    expect(smokeH24.lengthKm).toBeGreaterThan(smokeH1.lengthKm)
  })

  it('evalúa correctamente el estado de evacuación de la brigada y traza la ruta segura', () => {
    // Posicionar brigada en el frente de avance (al oeste del foco)
    const brigadeInDanger: [number, number] = [-1.685, -78.555]
    const simDanger = simulateFireSpread(origin, mockWeather, 'paramo', brigadeInDanger)

    expect(simDanger.evacuation).toBeDefined()
    expect(simDanger.evacuation?.status).toBe('DANGER')
    expect(simDanger.evacuation?.escapeRoute.length).toBeGreaterThanOrEqual(2)
    expect(simDanger.evacuation?.escapeDistanceKm).toBeGreaterThan(0)
    expect(simDanger.evacuation?.estimatedWalkingMinutes).toBeGreaterThan(0)

    // Posicionar brigada a barlovento (lejos y a salvo al este del foco)
    const brigadeSafe: [number, number] = [-1.685, -78.48]
    const simSafe = simulateFireSpread(origin, mockWeather, 'paramo', brigadeSafe)

    expect(simSafe.evacuation).toBeDefined()
    expect(simSafe.evacuation?.status).toBe('SAFE')

    // REGLA CRÍTICA DE SEGURIDAD: La Zona Segura NUNCA debe estar dentro del perímetro de 24h ni del humo
    expect(
      isPointInPolygon(
        simDanger.evacuation!.safePoint,
        simDanger.isochrones.twentyFourHours.coordinates
      )
    ).toBe(false)
    expect(
      isPointInPolygon(simDanger.evacuation!.safePoint, simDanger.smokePlume.coordinates)
    ).toBe(false)
    expect(
      isPointInPolygon(
        simSafe.evacuation!.safePoint,
        simSafe.isochrones.twentyFourHours.coordinates
      )
    ).toBe(false)
  })

  it('exporta un GeoJSON válido y parseable con todas las capas tácticas', () => {
    const brigade: [number, number] = [-1.68, -78.54]
    const sim = simulateFireSpread(origin, mockWeather, 'paramo', brigade)
    const jsonStr = exportSimulationToGeoJSON(sim)

    const parsed = JSON.parse(jsonStr)
    expect(parsed.type).toBe('FeatureCollection')
    expect(parsed.features.length).toBeGreaterThanOrEqual(5)

    const featureNames = parsed.features.map((f: any) => f.properties?.name)
    expect(featureNames).toContain('Punto de Ignición / Foco Activo')
    expect(featureNames).toContain('Isócrona 6h (Frente Crítico)')
    expect(featureNames).toContain('Isócrona 24h (Perímetro Preventivo)')
    expect(featureNames.some((n: string) => n.includes('Ruta Táctica'))).toBe(true)
  })

  it('calcula distancias y traslados geográficos con precisión', () => {
    const p1: [number, number] = [0, 0]
    const p2: [number, number] = [0, 1] // ~111 km en el ecuador
    const dist = haversineDistanceKm(p1, p2)
    expect(dist).toBeGreaterThan(110)
    expect(dist).toBeLessThan(112)

    const projected = projectCoordinate([0, 0], 111.19, 0) // hacia el norte
    expect(projected[0]).toBeCloseTo(1, 0)
  })
})
