import React, { useEffect, useState, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  CircleMarker,
  Popup,
  LayerGroup,
  useMap,
  Circle as LeafletCircle,
} from 'react-leaflet'
import {
  Trash2,
  Flame,
  ChevronDown,
  ChevronRight,
  Download,
  PenTool,
  ArrowUpRight,
} from 'lucide-react'
import type { HotspotsResponse, Region, Canton, CustomGeometry } from '../types'
import { formatCoordinates } from '../utils/geoUtils'
import { useFilters } from '../hooks/useFilters'
import { COUNTRIES, getCountrySilhouette } from '../utils/territoryData'

interface MapViewProps {
  region: Region | undefined
  canton?: Canton
  hotspots: HotspotsResponse | null
  isLoadingHotspots: boolean
  selectedYear: number
  selectedWeek: number
  customGeometry?: CustomGeometry | null
  onGeometryCreated?: (geom: CustomGeometry) => void
  onClearGeometry?: () => void
  onTriggerDrawPolygon?: () => void
}

function MapController({
  center,
  zoom,
}: {
  center: [number, number]
  zoom: number
}) {
  const map = useMap()
  const prevCenterRef = useRef<[number, number]>(center)

  useEffect(() => {
    if (
      Math.abs(prevCenterRef.current[0] - center[0]) > 0.0001 ||
      Math.abs(prevCenterRef.current[1] - center[1]) > 0.0001
    ) {
      prevCenterRef.current = center
      map.setView(center, zoom, { animate: true })
    }
  }, [center, zoom, map])

  return null
}

function DynamicCoverageCircle({
  center,
  radius,
}: {
  center: [number, number]
  radius: number
}) {
  const circleRef = useRef<any>(null)

  useEffect(() => {
    if (circleRef.current) {
      if (typeof circleRef.current.setRadius === 'function') {
        circleRef.current.setRadius(radius)
      }
      if (typeof circleRef.current.setLatLng === 'function') {
        circleRef.current.setLatLng(center)
      }
    }
  }, [radius, center])

  return (
    <LeafletCircle
      ref={circleRef}
      center={center}
      radius={radius}
      pathOptions={{
        color: '#071C3A',
        weight: 1.8,
        fillColor: '#7DD3FC', // Celestito translúcido idéntico a la imagen de referencia
        fillOpacity: 0.22,
      }}
    />
  )
}

// Colores exactos de las bolitas de la imagen:
// Naranja albaricoque / coral translúcido con borde terracota/naranja oscuro definido
function getFrpColor(frp: number): { fill: string; stroke: string } {
  if (frp >= 100) {
    return { fill: '#F97316', stroke: '#9A3412' }
  }
  if (frp >= 60) {
    return { fill: '#FB923C', stroke: '#C2410C' }
  }
  if (frp >= 30) {
    return { fill: '#FDBA74', stroke: '#C2410C' }
  }
  return { fill: '#FED7AA', stroke: '#EA580C' }
}

// Tamaño exacto y proporcionado como en la imagen de referencia (máximo 14.5px, mínimo 3.5px)
function getFrpRadius(frp: number): number {
  return Math.min(14.5, Math.max(3.5, Math.round(Math.sqrt(frp) * 1.45)))
}

export const MapView: React.FC<MapViewProps> = ({
  region,
  canton,
  hotspots,
  isLoadingHotspots,
  selectedYear,
  selectedWeek,
  customGeometry,
  onClearGeometry,
  onTriggerDrawPolygon,
}) => {
  const [mapLayer, setMapLayer] = useState<'osm' | 'topo' | 'satellite'>('osm')
  const [showHotspotsDrawer, setShowHotspotsDrawer] = useState<boolean>(false)
  const mapCardRef = useRef<HTMLDivElement>(null)

  const { filters, coverageRadiusMeters } = useFilters()
  const points = hotspots?.points || []

  const currentCountry = COUNTRIES.find((c) => c.code === filters.country)
  const hasCitySelected = Boolean(filters.cantonId && filters.cantonId !== '')
  const countrySilhouette = getCountrySilhouette(filters.country)

  // Focos a desplegar: mostrar todos los focos satelitales detectados en el país para la fecha activa
  const displayPoints = points

  // Desplazamiento radial sutil para puntos coincidentes en la misma coordenada de celda (ej. -1.5, -78.5)
  // para que cada evento del satélite sea visible y clickeable individualmente
  const positionedPoints = useMemo(() => {
    const coordsMap = new Map<string, number>()
    return displayPoints.map((pt) => {
      const coordKey = `${pt.lat.toFixed(2)},${pt.lon.toFixed(2)}`
      const count = coordsMap.get(coordKey) || 0
      coordsMap.set(coordKey, count + 1)

      if (count === 0) {
        return { ...pt, displayLat: pt.lat, displayLon: pt.lon }
      }
      const angle = (count * 2 * Math.PI) / 6
      const offsetDeg = 0.035 * Math.ceil(count / 6)
      return {
        ...pt,
        displayLat: pt.lat + Math.sin(angle) * offsetDeg,
        displayLon: pt.lon + Math.cos(angle) * offsetDeg,
      }
    })
  }, [displayPoints])

  // Centro activo en tiempo real: ciudad seleccionada > país > Riobamba
  const activeCenter: [number, number] =
    hasCitySelected && canton
      ? [canton.lat, canton.lon]
      : customGeometry?.center ??
        (currentCountry ? [currentCountry.lat, currentCountry.lon] : region?.center ?? [-1.8312, -78.1834])
  const zoom: number = hasCitySelected ? 11 : (currentCountry?.zoom || 7)

  const tileUrls = {
    osm: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    topo: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  }

  const attributions = {
    osm: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    topo: 'OpenTopoMap',
    satellite: 'Esri, Maxar, Earthstar Geographics',
  }

  const defaultRadius = 18500
  const activeRadius = customGeometry?.radiusMeters ?? coverageRadiusMeters ?? defaultRadius

  return (
    <div ref={mapCardRef} className="bg-white rounded-[28px] p-6 sm:p-7 border border-slate-200/70 space-y-4">
      {/* 1. Header principal */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#FF7900]">
            Mapa · {canton ? `${canton.name} · ` : ''}{currentCountry?.name || filters.countryName || 'Ecuador'}
          </p>
          <h2 className="mt-2 text-xl sm:text-2xl font-black tracking-tight text-[#0B1B3D]">Focos detectados</h2>
          <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs">
            <span className="font-bold text-[#FF7900] bg-orange-50 px-2.5 py-0.5 rounded-lg border border-orange-200">
              Semana {selectedWeek} · {selectedYear}
            </span>
            <span className="font-semibold text-slate-600">
              {displayPoints.length} {displayPoints.length === 1 ? 'foco detectado' : 'focos detectados'}
            </span>
            {isLoadingHotspots && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 font-bold border border-amber-200 text-[11px] animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                Actualizando satélites...
              </span>
            )}
          </div>
        </div>

        {/* Capas y conteo de focos */}
        <div className="flex items-center gap-2.5">
          <div className="bg-[#F4F6F9] p-1 rounded-xl border border-slate-200/80 flex items-center text-xs">
            <button
              type="button"
              onClick={() => setMapLayer('osm')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                mapLayer === 'osm'
                  ? 'bg-[#0B2D5B] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-[#0B2D5B]'
              }`}
            >
              Estándar
            </button>
            <button
              type="button"
              onClick={() => setMapLayer('topo')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                mapLayer === 'topo'
                  ? 'bg-[#0B2D5B] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-[#0B2D5B]'
              }`}
            >
              Relieve
            </button>
            <button
              type="button"
              onClick={() => setMapLayer('satellite')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                mapLayer === 'satellite'
                  ? 'bg-[#0B2D5B] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-[#0B2D5B]'
              }`}
            >
              Satélite
            </button>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 bg-[#FFF2E6] text-[#FF7900] rounded-xl border border-[#FF7900]/30 text-xs font-bold">
            <Flame className="w-3.5 h-3.5 fill-current" />
            <span>{displayPoints.length} focos</span>
          </div>
        </div>
      </div>

      {/* 2. Barra informativa de silueta y territorio */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 text-xs">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 text-[#0B2D5B] font-bold border border-slate-200">
            <span className="w-2 h-2 rounded-full bg-[#FF7900]" />
            <span>Silueta de {currentCountry?.name || filters.country} activa</span>
          </span>
          {hasCitySelected && canton && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-orange-50 text-orange-700 font-bold border border-orange-200">
              <span>Foco en {canton.name}</span>
            </span>
          )}
        </div>
      </div>

      {/* 3. Contenedor del Mapa Leaflet */}
      <div className="relative w-full h-[490px] rounded-2xl overflow-hidden border border-slate-200 bg-[#F4F6F9]">
        <MapContainer
          center={activeCenter}
          zoom={zoom}
          scrollWheelZoom={true}
          className="w-full h-full"
        >
          <MapController center={activeCenter} zoom={zoom} />

          <TileLayer url={tileUrls[mapLayer]} attribution={attributions[mapLayer]} />

          {/* Silueta del país seleccionado */}
          {countrySilhouette && (
            <GeoJSON
              key={`country-silhouette-${filters.country}`}
              data={countrySilhouette as any}
              pathOptions={{
                color: mapLayer === 'satellite' ? '#38BDF8' : '#0B2D5B',
                weight: 2.2,
                dashArray: '5, 5',
                fillColor: mapLayer === 'satellite' ? '#38BDF8' : '#FF7900',
                fillOpacity: 0.04,
              }}
            />
          )}

          {/* Círculo de cobertura espacial dinámico (cuando hay ciudad seleccionada o radio activo) */}
          {hasCitySelected && (
            <DynamicCoverageCircle
              center={activeCenter}
              radius={activeRadius}
            />
          )}

          {/* Focos de calor como bolitas en el tamaño y color exacto de la imagen */}
          <LayerGroup key={`hotspots-layer-${filters.country}-${selectedYear}-${selectedWeek}`}>
            {positionedPoints.map((pt, idx) => {
              const { fill, stroke } = getFrpColor(pt.frp)
              const radius = getFrpRadius(pt.frp)

              return (
                <CircleMarker
                  key={`hotspot-${filters.country}-${selectedYear}-${selectedWeek}-${idx}-${pt.date}-${pt.frp}`}
                  center={[pt.displayLat, pt.displayLon]}
                  radius={radius}
                  pathOptions={{
                    color: stroke,
                    fillColor: fill,
                    fillOpacity: 0.78,
                    weight: 1.1,
                  }}
                >
                  <Popup className="custom-popup" autoPan={false}>
                    <div className="p-1 space-y-1.5 text-xs font-sans">
                      <div className="font-black text-[#0B2D5B] border-b pb-1 flex items-center justify-between gap-3">
                        <span className="flex items-center gap-1 text-[#FF7900]">
                          <Flame className="w-3.5 h-3.5 fill-current" />
                          <span>Foco Térmico</span>
                        </span>
                        <span className="px-1.5 py-0.5 rounded-sm bg-[#F4F6F9] text-[10px] uppercase font-mono font-bold text-[#0B2D5B]">
                          {pt.sensor}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-[11px]">
                        <span className="text-slate-500 font-medium">Fecha:</span>
                        <span className="font-bold text-slate-800">{pt.date}</span>

                        <span className="text-slate-500 font-medium">Potencia (FRP):</span>
                        <span className="font-black text-[#E53935]">
                          {typeof pt.frp === 'number' ? Math.round(pt.frp * 10) / 10 : pt.frp} MW
                        </span>

                        <span className="text-slate-500 font-medium">Ubicación:</span>
                        <span className="font-mono text-slate-700 text-[10px]">
                          {formatCoordinates(pt.lat, pt.lon)}
                        </span>
                      </div>

                      <Link
                        to={`/simulador?lat=${pt.lat}&lon=${pt.lon}&frp=${typeof pt.frp === 'number' ? Math.round(pt.frp * 10) / 10 : pt.frp}&sensor=${pt.sensor}&date=${pt.date}`}
                        style={{ color: '#ffffff' }}
                        className="mt-2.5 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-[#FF7900] to-[#E66D00] text-white !text-white text-xs font-bold shadow-xs hover:shadow-md transition-all text-center no-underline"
                      >
                        <Flame className="w-3.5 h-3.5 fill-current text-white shrink-0" />
                        <span style={{ color: '#ffffff' }} className="text-white !text-white font-bold">Simular en FireCast Táctico</span>
                      </Link>
                    </div>
                  </Popup>
                </CircleMarker>
              )
            })}
          </LayerGroup>
        </MapContainer>

        {/* Indicador flotante cuando se están descargando datos de satélite */}
        {isLoadingHotspots && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-white/95 backdrop-blur-xs px-4 py-1.5 rounded-full border border-orange-200 shadow-md flex items-center gap-2 text-xs font-bold text-[#0B2D5B]">
            <span className="w-2 h-2 rounded-full bg-[#FF7900] animate-ping" />
            <span>Consultando satélites (Semana {selectedWeek}, {selectedYear})...</span>
          </div>
        )}

        {/* Leyenda idéntica a la imagen: "Potencia térmica (FRP en MW) [15 MW] [30 MW] [60 MW] [100 MW]" */}
        <div className="absolute bottom-3 right-3 z-20 bg-white/95 backdrop-blur-xs px-3.5 py-2 rounded-xl border border-slate-200/90 shadow-md text-xs">
          <span className="font-bold text-slate-800 block mb-1 text-[11px]">
            Potencia térmica (FRP en MW)
          </span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FED7AA] border border-[#EA580C] inline-block" />
              <span className="text-[11px] text-slate-600 font-medium">15 MW</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-full bg-[#FDBA74] border border-[#C2410C] inline-block" />
              <span className="text-[11px] text-slate-600 font-medium">30 MW</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4.5 h-4.5 rounded-full bg-[#FB923C] border border-[#C2410C] inline-block" />
              <span className="text-[11px] text-slate-600 font-medium">60 MW</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-5.5 h-5.5 rounded-full bg-[#F97316] border border-[#9A3412] inline-block" />
              <span className="text-[11px] text-slate-600 font-medium">100 MW</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Barra inferior de la tarjeta de mapa */}
      <div className="flex items-center justify-between pt-1 text-xs">
        <button
          type="button"
          onClick={() => setShowHotspotsDrawer(!showHotspotsDrawer)}
          className="flex items-center gap-1.5 font-bold text-[#0B2D5B] hover:text-[#FF7900] transition-colors"
        >
          {showHotspotsDrawer ? <ChevronDown className="w-3.5 h-3.5 text-[#FF7900]" /> : <ChevronRight className="w-3.5 h-3.5 text-[#FF7900]" />}
          <span>Focos en la semana ({points.length})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            alert('Descarga de captura de mapa iniciada.')
          }}
          className="flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-[#0B2D5B] transition-colors"
        >
          <Download className="w-3 h-3 text-[#FF7900]" />
          <span>Descargar PNG</span>
        </button>
      </div>

      {showHotspotsDrawer && (
        <div className="pt-2 border-t border-slate-100 max-h-56 overflow-y-auto space-y-1.5">
          {points.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">No se registran focos activos en esta semana.</p>
          ) : (
            points.slice(0, 15).map((pt, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-[11px] py-1.5 px-2.5 rounded-xl bg-slate-50 border border-slate-100 hover:bg-orange-50/50 hover:border-orange-200 transition-colors"
              >
                <div className="flex flex-col">
                  <span className="font-mono text-slate-700 font-semibold">
                    {pt.date} • {formatCoordinates(pt.lat, pt.lon)}
                  </span>
                  <span className="font-bold text-[#E53935]">
                    {typeof pt.frp === 'number' ? Math.round(pt.frp * 10) / 10 : pt.frp} MW ({pt.sensor})
                  </span>
                </div>
                <Link
                  to={`/simulador?lat=${pt.lat}&lon=${pt.lon}&frp=${typeof pt.frp === 'number' ? Math.round(pt.frp * 10) / 10 : pt.frp}&sensor=${pt.sensor}&date=${pt.date}`}
                  style={{ color: '#ffffff' }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0B1B3D] text-white !text-white text-[10px] font-bold hover:bg-[#FF7900] transition-colors no-underline"
                >
                  <span className="text-white !text-white">Simular</span>
                  <ArrowUpRight className="w-3 h-3 text-white" />
                </Link>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
