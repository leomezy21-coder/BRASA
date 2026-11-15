import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import {
  MapContainer,
  TileLayer,
  Polygon,
  Polyline,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import L from 'leaflet'
import {
  Wind,
  Flame,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Compass,
  Clock,
  Download,
  Copy,
  Check,
  Layers,
  RefreshCw,
  Sliders,
  MapPin,
  Play,
  Pause,
  AlertTriangle,
  Info,
  Footprints,
  Radio,
  Eye,
  Route,
  Activity,
  Award,
  Thermometer,
  Droplets,
  ArrowUpRight,
} from 'lucide-react'
import {
  FUEL_MODELS,
  ECUADOR_PRESETS,
  fetchLiveWeather,
  fetchOSRMRoute,
  simulateFireSpread,
  calculateFirePerimeterAtHour,
  calculateSmokePlumeAtHour,
  isPointInPolygon,
  exportSimulationToGeoJSON,
  type FuelType,
  type WeatherData,
  type FireSimulationResult,
} from '../utils/fireSimulation'
import { formatCoordinates } from '../utils/geoUtils'

// Custom DivIcons compactos con simbología táctica oficial de bomberos / ICS
const flameIcon = L.divIcon({
  className: 'custom-flame-icon',
  html: `<div class="relative flex items-center justify-center w-7 h-7">
    <span class="absolute inline-flex w-full h-full rounded-full bg-red-500 opacity-40 animate-ping"></span>
    <span class="relative flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-tr from-amber-500 via-orange-600 to-red-600 text-white shadow-md border-[1.5px] border-white ring-1 ring-red-400">
      <svg class="w-3.5 h-3.5 fill-current text-white" viewBox="0 0 24 24"><path d="M12 2c-.3 0-.6.1-.8.3-2.1 2.1-4.2 5.5-4.2 9.2 0 4.1 3.1 7.5 7 7.5s7-3.4 7-7.5c0-3.7-2.1-7.1-4.2-9.2-.2-.2-.5-.3-.8-.3zm0 15c-2.8 0-5-2.2-5-5 0-2.3 1.3-4.7 3-6.5.6.8 1.4 1.7 2 2.5 1.7 2 2 4.3 2 4.3.4-.6.8-1.4 1-2.2.6 1.4 1 2.8 1 4.4 0 1.4-.4 2.5-4 2.5z"/></svg>
    </span>
  </div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
})

const brigadeIcon = L.divIcon({
  className: 'custom-brigade-icon',
  html: `<div class="relative flex items-center justify-center w-7 h-7">
    <div class="flex items-center justify-center w-6 h-6 rounded-full bg-[#0B1B3D] text-white shadow-md border-[1.5px] border-white ring-1 ring-sky-400">
      <svg class="w-3.5 h-3.5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
    </div>
  </div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
})

const safePointIcon = L.divIcon({
  className: 'custom-safepoint-icon',
  html: `<div class="relative flex items-center justify-center w-7 h-7">
    <div class="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-600 text-white shadow-md border-[1.5px] border-white ring-1 ring-emerald-400">
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
    </div>
  </div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
})

// Controlador de cámara
function MapCameraController({ center }: { center: [number, number] }) {
  const map = useMap()
  const prevCenter = useRef<[number, number]>(center)

  useEffect(() => {
    if (
      Math.abs(prevCenter.current[0] - center[0]) > 0.001 ||
      Math.abs(prevCenter.current[1] - center[1]) > 0.001
    ) {
      prevCenter.current = center
      map.setView(center, 12, { animate: true })
    }
  }, [center, map])

  return null
}

function MapClickHandler({
  clickMode,
  onMapClick,
}: {
  clickMode: 'fire' | 'brigade' | 'none'
  onMapClick: (lat: number, lon: number) => void
}) {
  useMapEvents({
    click(e) {
      if (clickMode !== 'none') {
        onMapClick(e.latlng.lat, e.latlng.lng)
      }
    },
  })
  return null
}

export const Simulador: React.FC = () => {
  const [searchParams] = useSearchParams()
  const queryLat = searchParams.get('lat')
  const queryLon = searchParams.get('lon')
  const queryFrp = searchParams.get('frp')
  const querySensor = searchParams.get('sensor')
  const queryDate = searchParams.get('date')

  const isCustomHotspot = Boolean(queryLat && queryLon)

  // Coordenadas iniciales: del parámetro URL o preset por defecto (Chambo)
  const initialLat = queryLat ? parseFloat(queryLat) : -1.685
  const initialLon = queryLon ? parseFloat(queryLon) : -78.532

  const [fireOrigin, setFireOrigin] = useState<[number, number]>([initialLat, initialLon])
  const [brigadePos, setBrigadePos] = useState<[number, number]>([
    initialLat + 0.012,
    initialLon - 0.018,
  ])
  const [clickMode, setClickMode] = useState<'fire' | 'brigade' | 'none'>('none')

  // Si los parámetros en la URL cambian (por ejemplo seleccionando otro foco en Explorar)
  useEffect(() => {
    if (queryLat && queryLon) {
      const lat = parseFloat(queryLat)
      const lon = parseFloat(queryLon)
      if (!isNaN(lat) && !isNaN(lon)) {
        setFireOrigin([lat, lon])
        setBrigadePos([lat + 0.012, lon - 0.018])
      }
    }
  }, [queryLat, queryLon])

  // Modelo de combustible y variables físicas
  const [fuelType, setFuelType] = useState<FuelType>('paramo')
  const [weather, setWeather] = useState<WeatherData>({
    temperatureC: 17,
    relativeHumidity: 55,
    windSpeedKmH: 18,
    windDirectionDeg: 80,
    elevationMeters: 2950,
    isRealTime: false,
  })
  const [isLoadingWeather, setIsLoadingWeather] = useState(false)
  const [manualWeatherOverride, setManualWeatherOverride] = useState(false)

  // Capas del mapa
  const [showSmoke, setShowSmoke] = useState(true)
  const [showIsochrons, setShowIsochrons] = useState({ h6: true, h12: true, h24: true })
  const [mapLayer, setMapLayer] = useState<'satellite' | 'topo' | 'osm'>('satellite')

  // Ruteo real sobre red vial y senderos de OpenStreetMap (OSRM)
  const [osrmRoute, setOsrmRoute] = useState<[number, number][] | null>(null)
  const [osrmStats, setOsrmStats] = useState<{ distanceKm: number; walkingMinutes: number } | null>(null)
  const [isLoadingRoute, setIsLoadingRoute] = useState(false)

  // Reproductor de tiempo
  const [timeStepHours, setTimeStepHours] = useState<number>(24)
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [copied, setCopied] = useState(false)

  // 1. Cargar clima en tiempo real desde Open-Meteo
  useEffect(() => {
    let isMounted = true
    setIsLoadingWeather(true)
    fetchLiveWeather(fireOrigin[0], fireOrigin[1])
      .then((data) => {
        if (isMounted) {
          setWeather(data)
          setIsLoadingWeather(false)
        }
      })
      .catch(() => {
        if (isMounted) setIsLoadingWeather(false)
      })

    return () => {
      isMounted = false
    }
  }, [fireOrigin[0], fireOrigin[1]])

  // 2. Animación del reproductor de tiempo
  useEffect(() => {
    if (!isPlaying) return
    const interval = setInterval(() => {
      setTimeStepHours((prev) => {
        if (prev >= 24) return 1
        return prev + 1
      })
    }, 700)
    return () => clearInterval(interval)
  }, [isPlaying])

  // 3. Simulación física (Rothermel / Huygens / Butler)
  const simulation: FireSimulationResult = useMemo(() => {
    return simulateFireSpread(fireOrigin, weather, fuelType, brigadePos)
  }, [fireOrigin, weather, fuelType, brigadePos])

  // 3b. Perímetro y humo dinámicos según el tiempo T seleccionado (1h a 24h)
  const currentStepIsochrone = useMemo(() => {
    return calculateFirePerimeterAtHour(fireOrigin, weather, fuelType, timeStepHours)
  }, [fireOrigin, weather, fuelType, timeStepHours])

  const currentStepSmoke = useMemo(() => {
    return calculateSmokePlumeAtHour(fireOrigin, weather, fuelType, timeStepHours)
  }, [fireOrigin, weather, fuelType, timeStepHours])

  // ¿El frente de fuego activo ya alcanzó la posición inicial de la brigada en la hora T?
  const isBrigadeImpactedAtTime = useMemo(() => {
    return isPointInPolygon(brigadePos, currentStepIsochrone.coordinates)
  }, [brigadePos, currentStepIsochrone])

  // 4. Ruteo real sobre carreteras y senderos (OSRM) hacia la Zona de Seguridad
  useEffect(() => {
    if (!simulation.evacuation) {
      setOsrmRoute(null)
      setOsrmStats(null)
      return
    }

    let isMounted = true
    setIsLoadingRoute(true)

    fetchOSRMRoute(brigadePos, simulation.evacuation.safePoint)
      .then((result) => {
        if (!isMounted) return
        if (result && result.coordinates.length > 2) {
          setOsrmRoute(result.coordinates)
          setOsrmStats({
            distanceKm: Math.round((result.distanceMeters / 1000) * 10) / 10,
            walkingMinutes: Math.round(result.durationSeconds / 60),
          })
        } else {
          setOsrmRoute(null)
          setOsrmStats(null)
        }
        setIsLoadingRoute(false)
      })
      .catch(() => {
        if (isMounted) setIsLoadingRoute(false)
      })

    return () => {
      isMounted = false
    }
  }, [
    brigadePos[0],
    brigadePos[1],
    simulation.evacuation?.safePoint[0],
    simulation.evacuation?.safePoint[1],
  ])

  // Selección de preset
  const handleSelectPreset = (preset: (typeof ECUADOR_PRESETS)[0]) => {
    setFireOrigin([preset.lat, preset.lon])
    setBrigadePos([preset.brigadeLat, preset.brigadeLon])
    setFuelType(preset.fuelType)
  }

  const handleMapClick = (lat: number, lon: number) => {
    if (clickMode === 'fire') {
      setFireOrigin([lat, lon])
      setClickMode('none')
    } else if (clickMode === 'brigade') {
      setBrigadePos([lat, lon])
      setClickMode('none')
    }
  }

  // Descarga de GeoJSON con especificación ICS
  const handleDownloadGeoJSON = () => {
    const geojsonStr = exportSimulationToGeoJSON(simulation)
    const blob = new Blob([geojsonStr], { type: 'application/geo+json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `FireCast_Mision_Tactica_${new Date().toISOString().split('T')[0]}.geojson`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Copia de Ficha Táctica Oficial ICS-201
  const handleCopyBriefing = () => {
    const evac = simulation.evacuation
    const distanceKm = osrmStats?.distanceKm ?? evac?.escapeDistanceKm ?? '—'
    const walkingMin = osrmStats?.walkingMinutes ?? evac?.estimatedWalkingMinutes ?? '—'

    const text = `📋 FORMULARIO TÁCTICO OFICIAL ICS-201 / BRASA ECUADOR
============================================================
INCIDENTE: Código Fuego Andino - Fase de Respuesta
FECHA / HORA: ${new Date().toLocaleString('es-EC')}
COORDENADAS DE FOCO: ${formatCoordinates(simulation.origin[0], simulation.origin[1])}
COMBUSTIBLE PREDOMINANTE: ${simulation.fuel.name} (${simulation.fuel.scientificName})
CARGA DE BIOMASA ESTIMADA: ${simulation.fuel.fuelLoadTonHa} ton/ha

🌪️ TELEMETRÍA METEOROLÓGICA EN VIVO (OPEN-METEO SATÉLITE):
- Viento: ${simulation.weather.windSpeedKmH} km/h con rumbo ${simulation.weather.windDirectionDeg}°
- Temperatura / Humedad: ${simulation.weather.temperatureC}°C | ${simulation.weather.relativeHumidity}%
- Cota de Elevación: ${simulation.weather.elevationMeters} m s.n.m.
- Tasa de Avance Frontal (Rothermel): ${(simulation.spreadRateKmH * 1000).toFixed(0)} m/h

🛡️ PROTOCOLO INTERNACIONAL DE SEGURIDAD LCES:
- [L] Lookout: ${evac?.lces.lookout ?? 'Vigía visual activo'}
- [C] Communications: ${evac?.lces.communications ?? 'Red VHF canal táctico'}
- [E] Escape Route: ${evac?.escapeHeadingName ?? '—'} (Distancia: ${distanceKm} km, ~${walkingMin} min a pie)
- [S] Safety Zone: ${evac?.lces.safetyZone ?? 'Área segura'}
- Separación Mínima de Seguridad (Butler 2014): ${evac?.lces.butlerDistanceMeters ?? 25} metros

ESTADO DE OPERACIÓN: ${evac?.status ?? 'NO LOCALIZADA'}`

    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const evac = simulation.evacuation
  const activeEscapeRoute = osrmRoute || evac?.escapeRoute || []
  const effectiveSafePoint =
    activeEscapeRoute.length > 0 ? activeEscapeRoute[activeEscapeRoute.length - 1] : evac?.safePoint
  const effectiveDistanceKm = osrmStats?.distanceKm ?? evac?.escapeDistanceKm ?? 0
  const effectiveWalkingMin = osrmStats?.walkingMinutes ?? evac?.estimatedWalkingMinutes ?? 0

  const tileUrls = {
    satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    topo: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    osm: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  }

  return (
    <div className="py-8 sm:py-10 px-4 sm:px-6 lg:px-8 max-w-[1680px] mx-auto space-y-6 text-[#0B1B3D]">
      {/* 1. Header Principal */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-orange-100 text-[#FF7900]">
              <Flame className="w-3.5 h-3.5 animate-pulse" />
              Sistema Táctico ICS-201
            </span>
            <span className="text-xs text-slate-400 font-semibold">• Modelos FARSITE / Rothermel & LCES</span>
          </div>
          <h1 className="mt-2 text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[#0B1B3D]">
            FireCast & SafeEvac Tactical
          </h1>
          <p className="mt-2 text-slate-500 max-w-3xl text-sm sm:text-base">
            Simulador predictivo físico de propagación a 6h, 12h y 24h acoplado a la red vial y de senderos reales con cálculo de <strong>Zonas de Seguridad certificadas</strong>.
          </p>
        </div>

        {/* Acciones principales */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleCopyBriefing}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold rounded-xl text-sm shadow-xs transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
            <span>{copied ? 'Ficha ICS-201 copiada' : 'Copiar Ficha ICS-201'}</span>
          </button>

          <button
            onClick={handleDownloadGeoJSON}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#FF7900] to-[#E66D00] text-white font-bold rounded-xl text-sm shadow-md hover:shadow-lg transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Exportar Misión GeoJSON</span>
          </button>
        </div>
      </header>

      {/* Banner de Foco Importado desde Explorar */}
      {isCustomHotspot && (
        <div className="bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-transparent border-l-4 border-[#FF7900] p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#FF7900] to-red-600 text-white flex items-center justify-center shrink-0 shadow-md">
              <Flame className="w-5 h-5 fill-current animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider bg-orange-100 text-[#FF7900] px-2 py-0.5 rounded-full">
                  Foco Satelital NASA Importado
                </span>
                {queryDate && <span className="text-xs text-slate-500 font-semibold">{queryDate}</span>}
              </div>
              <p className="text-sm font-bold text-[#0B1B3D] mt-0.5">
                Ubicación: {formatCoordinates(fireOrigin[0], fireOrigin[1])}
                {queryFrp ? ` · Potencia FRP: ${queryFrp} MW` : ''}
                {querySensor ? ` (${querySensor})` : ''}
              </p>
            </div>
          </div>

          <Link
            to="/explorar"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-[#0B1B3D] self-start sm:self-auto transition-colors"
          >
            <span>Elegir otro foco</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-[#FF7900]" />
          </Link>
        </div>
      )}

      {/* 2. Barra de Presets Críticos */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-400">
          <MapPin className="w-4 h-4 text-[#FF7900]" />
          <span>Escenarios Críticos en Ecuador:</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {ECUADOR_PRESETS.map((p) => {
            const isSelected =
              Math.abs(fireOrigin[0] - p.lat) < 0.005 && Math.abs(fireOrigin[1] - p.lon) < 0.005
            return (
              <button
                key={p.id}
                onClick={() => handleSelectPreset(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${isSelected
                  ? 'bg-[#0B1B3D] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
              >
                {p.name.split(' (')[0]}
              </button>
            )
          })}
        </div>
      </div>

      {/* 3. Grid Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Mapa Leaflet Táctico */}
        <div className="lg:col-span-8 bg-white rounded-[28px] border border-slate-200/80 p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setClickMode(clickMode === 'brigade' ? 'none' : 'brigade')}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${clickMode === 'brigade'
                  ? 'bg-sky-600 text-white border-sky-600 ring-2 ring-sky-300'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-sky-50 hover:text-sky-700'
                  }`}
              >
                <Shield className="w-4 h-4 text-sky-500" />
                <span>{clickMode === 'brigade' ? 'Clic en el mapa para ubicar brigada...' : 'Ubicar Brigada (ICP)'}</span>
              </button>
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
              {(['satellite', 'topo', 'osm'] as const).map((layer) => (
                <button
                  key={layer}
                  onClick={() => setMapLayer(layer)}
                  className={`px-2.5 py-1 rounded-lg capitalize transition-colors ${mapLayer === layer ? 'bg-white text-[#0B1B3D] shadow-xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                  {layer === 'satellite' ? 'Satélite' : layer === 'topo' ? 'Relieve' : 'OSM'}
                </button>
              ))}
            </div>
          </div>

          {/* Mapa */}
          <div className="relative w-full h-[540px] sm:h-[600px] rounded-2xl overflow-hidden border border-slate-200">
            <MapContainer
              center={fireOrigin}
              zoom={12}
              scrollWheelZoom={true}
              className="w-full h-full z-0"
            >
              <MapCameraController center={fireOrigin} />
              <MapClickHandler clickMode={clickMode} onMapClick={handleMapClick} />
              <TileLayer url={tileUrls[mapLayer]} attribution="NASA | ESRI | OpenStreetMap" />

              {/* 1. Pluma de Humo Dinámica (crece con el tiempo T) */}
              {showSmoke && (
                <Polygon
                  positions={currentStepSmoke.coordinates}
                  pathOptions={{
                    color: '#64748B',
                    weight: 1.5,
                    dashArray: '6, 6',
                    fillColor: '#94A3B8',
                    fillOpacity: 0.22,
                  }}
                >
                  <Popup>
                    <div className="text-xs p-1">
                      <p className="font-bold text-slate-700">Pluma de Humo & Gases Tóxicos PM2.5</p>
                      <p className="text-slate-600">
                        Dispersión a las T+{timeStepHours}h: {currentStepSmoke.lengthKm} km a favor del viento
                      </p>
                    </div>
                  </Popup>
                </Polygon>
              )}

              {/* 2. Contornos de Referencia Fijos (24h, 12h, 6h) */}
              {showIsochrons.h24 && (
                <Polygon
                  positions={simulation.isochrones.twentyFourHours.coordinates}
                  pathOptions={{
                    color: '#D97706',
                    weight: 1.5,
                    dashArray: '5, 5',
                    fillColor: '#FBBF24',
                    fillOpacity: 0.08,
                  }}
                >
                  <Popup>
                    <div className="text-xs p-1">
                      <p className="font-bold text-amber-700">Perímetro Preventivo 24 Horas</p>
                      <p className="text-slate-600">Área: {simulation.isochrones.twentyFourHours.areaHectares} ha</p>
                      <p className="text-slate-600">Perímetro: {simulation.isochrones.twentyFourHours.perimeterKm} km</p>
                    </div>
                  </Popup>
                </Polygon>
              )}

              {showIsochrons.h12 && (
                <Polygon
                  positions={simulation.isochrones.twelveHours.coordinates}
                  pathOptions={{
                    color: '#EA580C',
                    weight: 1.5,
                    dashArray: '4, 4',
                    fillColor: '#FB923C',
                    fillOpacity: 0.1,
                  }}
                >
                  <Popup>
                    <div className="text-xs p-1">
                      <p className="font-bold text-orange-600">Expansión Térmica 12 Horas</p>
                      <p className="text-slate-600">Área: {simulation.isochrones.twelveHours.areaHectares} ha</p>
                    </div>
                  </Popup>
                </Polygon>
              )}

              {showIsochrons.h6 && (
                <Polygon
                  positions={simulation.isochrones.sixHours.coordinates}
                  pathOptions={{
                    color: '#DC2626',
                    weight: 1.8,
                    dashArray: '3, 3',
                    fillColor: '#EF4444',
                    fillOpacity: 0.12,
                  }}
                >
                  <Popup>
                    <div className="text-xs p-1">
                      <p className="font-bold text-red-600">Frente Crítico Inminente 6 Horas</p>
                      <p className="text-slate-600">Área: {simulation.isochrones.sixHours.areaHectares} ha</p>
                    </div>
                  </Popup>
                </Polygon>
              )}

              {/* 3. FRENTE ACTIVO DE FUEGO DINÁMICO EN TIEMPO REAL (T + {timeStepHours}h) */}
              <Polygon
                positions={currentStepIsochrone.coordinates}
                pathOptions={{
                  color:
                    timeStepHours <= 6
                      ? '#DC2626'
                      : timeStepHours <= 12
                      ? '#EA580C'
                      : '#D97706',
                  weight: 3,
                  fillColor:
                    timeStepHours <= 6
                      ? '#EF4444'
                      : timeStepHours <= 12
                      ? '#F97316'
                      : '#F59E0B',
                  fillOpacity: 0.48,
                }}
              >
                <Popup>
                  <div className="text-xs p-1.5 space-y-1">
                    <p className="font-black text-red-600">
                      🔥 Frente Activo en Expansión (T + {timeStepHours}h)
                    </p>
                    <p className="text-slate-700">
                      Superficie calcinada:{' '}
                      <strong>{currentStepIsochrone.areaHectares.toLocaleString()} ha</strong>
                    </p>
                    <p className="text-slate-600">
                      Perímetro térmico: {currentStepIsochrone.perimeterKm} km
                    </p>
                    <p className="text-[11px] font-semibold text-slate-500">
                      Velocidad de avance: {(simulation.spreadRateKmH * 1000).toFixed(0)} m/h
                    </p>
                  </div>
                </Popup>
              </Polygon>

              {/* Marcadores */}
              <Marker position={fireOrigin} icon={flameIcon}>
                <Popup>
                  <div className="text-xs p-1">
                    <p className="font-black text-red-600">Frente de Fuego Activo</p>
                    <p className="text-slate-600">{formatCoordinates(fireOrigin[0], fireOrigin[1])}</p>
                    <p className="mt-1 font-semibold text-slate-700">Avance: {(simulation.spreadRateKmH * 1000).toFixed(0)} m/h</p>
                  </div>
                </Popup>
              </Marker>

              <Marker position={brigadePos} icon={brigadeIcon}>
                <Popup>
                  <div className="text-xs p-1">
                    <p className="font-black text-[#0B1B3D]">Puesto de Mando de Brigada (ICP)</p>
                    <p className="text-slate-600">{formatCoordinates(brigadePos[0], brigadePos[1])}</p>
                    <p className="mt-1 font-bold text-sky-600">Estado: {evac?.status}</p>
                  </div>
                </Popup>
              </Marker>

              {/* Ruta de Evacuación Real trazada sobre carreteras/senderos */}
              {evac && activeEscapeRoute.length > 0 && effectiveSafePoint && (
                <>
                  <Polyline
                    positions={activeEscapeRoute}
                    pathOptions={{
                      color: '#10B981',
                      weight: 4.5,
                      dashArray: osrmRoute ? undefined : '6, 6',
                      opacity: 0.95,
                    }}
                  />
                  <Marker position={effectiveSafePoint} icon={safePointIcon}>
                    <Popup>
                      <div className="text-xs p-1 space-y-1">
                        <p className="font-black text-emerald-700">Safety Zone / Punto de Extracción (LZ)</p>
                        <p className="text-slate-600">Área de repliegue fuera de la zona de gases y radiación térmica.</p>
                        <p className="font-bold text-slate-800">
                          Distancia a pie: {effectiveDistanceKm} km (~{effectiveWalkingMin} min)
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Radio Mínimo Butler (2014): <strong>{evac.lces.butlerDistanceMeters} m</strong>
                        </p>
                      </div>
                    </Popup>
                  </Marker>
                </>
              )}
            </MapContainer>

            {/* Brújula Táctica */}
            <div className="absolute top-4 right-4 z-10 bg-white/95 backdrop-blur-md px-3.5 py-3 rounded-2xl border border-slate-200/90 shadow-md flex items-center gap-3">
              <div className="relative w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 border border-slate-300">
                <Compass className="w-5 h-5 text-slate-400 absolute" />
                <div
                  className="w-1.5 h-7 bg-gradient-to-t from-transparent via-[#FF7900] to-red-600 rounded-full transition-transform duration-500"
                  style={{
                    transform: `rotate(${simulation.spreadAngleDeg}deg)`,
                  }}
                />
              </div>
              <div className="text-xs">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Viento hacia</p>
                <p className="font-bold text-[#0B1B3D]">{simulation.spreadAngleDeg}° ({simulation.weather.windSpeedKmH} km/h)</p>
              </div>
            </div>

            {/* Capas flotantes */}
            <div className="absolute bottom-4 left-4 z-10 bg-white/95 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-200/90 shadow-md flex items-center gap-3 text-xs font-semibold text-slate-700">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" /> Capas:
              </span>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showIsochrons.h6}
                  onChange={(e) => setShowIsochrons((p) => ({ ...p, h6: e.target.checked }))}
                  className="rounded text-red-600 focus:ring-0"
                />
                <span className="text-red-600 font-bold">6h</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showIsochrons.h12}
                  onChange={(e) => setShowIsochrons((p) => ({ ...p, h12: e.target.checked }))}
                  className="rounded text-orange-600 focus:ring-0"
                />
                <span className="text-orange-600 font-bold">12h</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showIsochrons.h24}
                  onChange={(e) => setShowIsochrons((p) => ({ ...p, h24: e.target.checked }))}
                  className="rounded text-amber-600 focus:ring-0"
                />
                <span className="text-amber-600 font-bold">24h</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showSmoke}
                  onChange={(e) => setShowSmoke(e.target.checked)}
                  className="rounded text-slate-600 focus:ring-0"
                />
                <span className="text-slate-600">Humo</span>
              </label>
            </div>
          </div>

          {/* Timeline Player Dinámico */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className={`w-11 h-11 rounded-full text-white flex items-center justify-center transition-all shadow-md ${
                  isPlaying
                    ? 'bg-amber-600 hover:bg-amber-700 ring-4 ring-amber-200 animate-pulse'
                    : 'bg-[#0B1B3D] hover:bg-[#FF7900]'
                }`}
                title={isPlaying ? 'Pausar Simulación' : 'Reproducir Evolución'}
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Evolución Dinámica
                </p>
                <p className="text-base font-black text-[#0B1B3D]">T + {timeStepHours} h</p>
              </div>
            </div>

            <div className="flex-1 w-full max-w-xl flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                <span className="text-slate-400">T+1h</span>
                <div className="flex items-center gap-1">
                  {[1, 6, 12, 18, 24].map((h) => (
                    <button
                      key={h}
                      onClick={() => {
                        setTimeStepHours(h)
                        setIsPlaying(false)
                      }}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                        timeStepHours === h
                          ? 'bg-[#0B1B3D] text-white shadow-xs'
                          : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                      }`}
                    >
                      {h}h
                    </button>
                  ))}
                </div>
                <span className="text-[#FF7900]">T+24h</span>
              </div>
              <input
                type="range"
                min={1}
                max={24}
                value={timeStepHours}
                onChange={(e) => {
                  setTimeStepHours(Number(e.target.value))
                  setIsPlaying(false)
                }}
                className="w-full accent-[#FF7900] h-2.5 bg-slate-200 rounded-lg cursor-pointer"
              />
            </div>

            <div className="flex flex-col sm:items-end text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">Área calcinada:</span>
                <strong className="text-[#0B1B3D] font-black text-sm">
                  {currentStepIsochrone.areaHectares.toLocaleString()} ha
                </strong>
              </div>
              {isBrigadeImpactedAtTime ? (
                <span className="text-[11px] font-bold text-red-600 flex items-center gap-1 mt-0.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Frente activo sobre la posición inicial
                </span>
              ) : (
                <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1 mt-0.5">
                  <ShieldCheck className="w-3.5 h-3.5" /> Posición inicial fuera del fuego a T+{timeStepHours}h
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Panel Táctico Lateral */}
        <div className="lg:col-span-4 space-y-6">
          {/* Card 1: Evaluación Táctica y Protocolo LCES */}
          <div className="bg-white rounded-[28px] border border-slate-200/80 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                SafeEvac · Protocolo LCES
              </p>
              {evac?.status === 'DANGER' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-red-100 text-red-700 animate-pulse">
                  <AlertTriangle className="w-3.5 h-3.5" /> Peligro Inminente
                </span>
              )}
              {evac?.status === 'CAUTION' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-700">
                  <ShieldAlert className="w-3.5 h-3.5" /> Alerta Preventiva
                </span>
              )}
              {evac?.status === 'SAFE' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-700">
                  <ShieldCheck className="w-3.5 h-3.5" /> Zona Segura
                </span>
              )}
            </div>

            {/* Banner de estado */}
            <div
              className={`p-4 rounded-2xl border ${evac?.status === 'DANGER'
                ? 'bg-red-50/70 border-red-200 text-red-950'
                : evac?.status === 'CAUTION'
                  ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                  : 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                }`}
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-white shadow-xs">
                  {evac?.status === 'DANGER' ? (
                    <Flame className="w-6 h-6 text-red-600" />
                  ) : evac?.status === 'CAUTION' ? (
                    <ShieldAlert className="w-6 h-6 text-amber-600" />
                  ) : (
                    <ShieldCheck className="w-6 h-6 text-emerald-600" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-black leading-snug">
                    {evac?.status === 'DANGER'
                      ? '¡Repliegue Inmediato de Brigada!'
                      : evac?.status === 'CAUTION'
                        ? 'Perímetro Bajo Riesgo en 24h'
                        : 'Posición Táctica Segura'}
                  </h3>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                    {evac?.status === 'DANGER'
                      ? 'La brigada está en la trayectoria del frente o en la nube de gases asfixiantes. Seguir la ruta verde de escape hacia la Zona de Seguridad designada.'
                      : evac?.status === 'CAUTION'
                        ? 'El frente de 24h puede comprometer este cuadrante si las ráfagas se incrementan. Mantener ruta de escape despejada.'
                        : 'La posición se encuentra a barlovento fuera de la pluma de dispersión y radiación.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Métricas clave */}
            {evac && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                    Distancia al Foco
                  </span>
                  <span className="text-xl font-black text-[#0B1B3D]">{evac.distanceToFireKm} km</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                    Distancia de Escape
                  </span>
                  <span className="text-xl font-black text-emerald-600">{effectiveDistanceKm} km</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                    Tiempo de Marcha
                  </span>
                  <span className="text-xl font-black text-[#0B1B3D] flex items-center gap-1">
                    <Footprints className="w-4 h-4 text-slate-400" />
                    ~{effectiveWalkingMin} min
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                    Margen Butler (SSD)
                  </span>
                  <span className="text-sm font-black text-[#0B1B3D] leading-tight block mt-1">
                    {evac.lces.butlerDistanceMeters} m libres
                  </span>
                </div>
              </div>
            )}

            {/* Checklist LCES Oficial */}
            {evac && (
              <div className="pt-2 border-t border-slate-100 space-y-2 text-xs">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Checklist Operacional LCES (NFPA 1051):
                </p>
                <div className="space-y-1.5 text-slate-600">
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                      L
                    </span>
                    <span><strong>Lookout:</strong> {evac.lces.lookout}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                      C
                    </span>
                    <span><strong>Communications:</strong> {evac.lces.communications}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                      E
                    </span>
                    <span><strong>Escape Route:</strong> {evac.lces.escapeRoute}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                      S
                    </span>
                    <span><strong>Safety Zone:</strong> {evac.lces.safetyZone}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Card 2: Condiciones Meteorológicas en Tiempo Real */}
          <div className="bg-white rounded-[28px] border border-slate-200/80 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#FF7900]">
                  Meteorología Satelital
                </p>
                <p className="text-xs text-slate-400 font-semibold">Open-Meteo API en vivo</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setManualWeatherOverride(!manualWeatherOverride)}
                  className={`p-2 rounded-xl text-xs font-bold border transition-colors ${manualWeatherOverride
                    ? 'bg-orange-50 text-[#FF7900] border-orange-200'
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                    }`}
                  title="Ajustar viento y clima manualmente"
                >
                  <Sliders className="w-4 h-4" />
                </button>
                {isLoadingWeather && <RefreshCw className="w-4 h-4 text-[#FF7900] animate-spin" />}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex flex-col justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Wind className="w-3.5 h-3.5 text-sky-500" /> Viento
                </span>
                <span className="text-xl font-black text-[#0B1B3D] mt-1">{weather.windSpeedKmH} km/h</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex flex-col justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-indigo-500" /> Rumbo
                </span>
                <span className="text-xl font-black text-[#0B1B3D] mt-1">{weather.windDirectionDeg}°</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex flex-col justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Thermometer className="w-3.5 h-3.5 text-rose-500" /> Temperatura
                </span>
                <span className="text-xl font-black text-[#0B1B3D] mt-1">{weather.temperatureC} °C</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex flex-col justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Droplets className="w-3.5 h-3.5 text-blue-500" /> Humedad
                </span>
                <span className="text-xl font-black text-[#0B1B3D] mt-1">{weather.relativeHumidity} %</span>
              </div>
            </div>

            {manualWeatherOverride && (
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <p className="text-xs font-bold text-slate-600">Simulación de Ráfagas Extremas:</p>
                <div>
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>Viento: <strong>{weather.windSpeedKmH} km/h</strong></span>
                  </div>
                  <input
                    type="range"
                    min={2}
                    max={65}
                    value={weather.windSpeedKmH}
                    onChange={(e) =>
                      setWeather((w) => ({ ...w, windSpeedKmH: Number(e.target.value) }))
                    }
                    className="w-full accent-[#FF7900] h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>Dirección del viento: <strong>{weather.windDirectionDeg}°</strong></span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={360}
                    value={weather.windDirectionDeg}
                    onChange={(e) =>
                      setWeather((w) => ({ ...w, windDirectionDeg: Number(e.target.value) }))
                    }
                    className="w-full accent-[#0B1B3D] h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Card 3: Modelo de Combustible Científico */}
          <div className="bg-white rounded-[28px] border border-slate-200/80 p-6 shadow-sm space-y-4">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
              Modelo de Combustible & Bioma
            </p>
            <select
              value={fuelType}
              onChange={(e) => setFuelType(e.target.value as FuelType)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-[#0B1B3D] focus:outline-hidden focus:ring-2 focus:ring-[#FF7900]"
            >
              {Object.values(FUEL_MODELS).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-400 italic">
              Especie botánica: {FUEL_MODELS[fuelType].scientificName}
            </p>
            <p className="text-xs text-slate-500 leading-relaxed">
              {FUEL_MODELS[fuelType].description}
            </p>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-400 font-semibold">Tasa de propagación estimada:</span>
              <strong className="text-[#0B1B3D] font-black text-sm">
                {(simulation.spreadRateKmH * 1000).toFixed(0)} m/h
              </strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
