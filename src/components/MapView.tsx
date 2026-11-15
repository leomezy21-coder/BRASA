import React, { useEffect, useState, useRef } from 'react'
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  CircleMarker,
  Popup,
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
} from 'lucide-react'
import type { HotspotsResponse, Region, Canton, CustomGeometry } from '../types'
import { formatCoordinates } from '../utils/geoUtils'
import { useFilters } from '../hooks/useFilters'

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
  const [geomType, setGeomType] = useState<'polygon' | 'circle'>('circle')
  const [showHotspotsDrawer, setShowHotspotsDrawer] = useState<boolean>(false)
  const mapCardRef = useRef<HTMLDivElement>(null)

  const { coverageRadiusMeters } = useFilters()
  const points = hotspots?.points || []

  // Centro activo en tiempo real: geometría personalizada > cantón > provincia/país > Riobamba
  const activeCenter: [number, number] =
    customGeometry?.center ??
    (canton ? [canton.lat, canton.lon] : region?.center ?? [-1.6709, -78.6545])
  const zoom: number = canton ? 10 : (region?.zoom ?? 5)

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
            Mapa · {canton ? `${canton.name}, ${region?.name}` : (region?.name || 'Ecuador')}
          </p>
          <h2 className="mt-2 text-xl sm:text-2xl font-black tracking-tight text-[#0B1B3D]">Focos detectados</h2>
          <p className="mt-1 text-sm text-slate-500">Tamaño según potencia radiativa (FRP).</p>
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
            <span>{points.length} focos</span>
          </div>
        </div>
      </div>

      {/* 2. Sub-barra de controles de dibujo de área */}
      <div className="flex items-center gap-2 pt-0.5">
        <div className="relative">
          <select
            value={geomType}
            onChange={(e) => setGeomType(e.target.value as 'polygon' | 'circle')}
            className="appearance-none bg-white border border-slate-200 rounded-xl px-3 py-1.5 pr-8 text-xs font-bold text-slate-700 shadow-2xs focus:outline-hidden focus:ring-1 focus:ring-[#FF7900]"
          >
            <option value="circle">Círculo de cobertura</option>
            <option value="polygon">Polígono</option>
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        <button
          type="button"
          onClick={onTriggerDrawPolygon}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-[#F4F6F9] text-slate-700 rounded-xl text-xs font-bold border border-slate-200 shadow-2xs transition-colors"
        >
          <PenTool className="w-3 h-3 text-[#FF7900]" />
          <span>Dibujar área</span>
        </button>

        {customGeometry && (
          <button
            type="button"
            onClick={onClearGeometry}
            className="ml-auto text-xs text-[#E53935] hover:underline font-bold flex items-center gap-1"
          >
            <Trash2 className="w-3 h-3" />
            <span>Restablecer radio</span>
          </button>
        )}
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

          {/* Círculo de cobertura espacial dinámico (responde de inmediato al slider de filtros sin parpadeos) */}
          {(!customGeometry || customGeometry.type === 'circle') && (
            <DynamicCoverageCircle
              center={activeCenter}
              radius={activeRadius}
            />
          )}

          {/* Polígono personalizado si el usuario dibujó uno */}
          {customGeometry?.type === 'polygon' && customGeometry.geojson && (
            <GeoJSON
              key={JSON.stringify(customGeometry.geojson)}
              data={customGeometry.geojson}
              style={{
                color: '#071C3A',
                weight: 2,
                fillColor: '#7DD3FC',
                fillOpacity: 0.22,
              }}
            />
          )}

          {/* Focos de calor como bolitas en el tamaño y color exacto de la imagen */}
          {points.map((pt, idx) => {
            const { fill, stroke } = getFrpColor(pt.frp)
            const radius = getFrpRadius(pt.frp)

            return (
              <CircleMarker
                key={`${pt.lat}-${pt.lon}-${idx}`}
                center={[pt.lat, pt.lon]}
                radius={radius}
                pathOptions={{
                  color: stroke,
                  fillColor: fill,
                  fillOpacity: 0.78,
                  weight: 1.1,
                }}
              >
                <Popup className="custom-popup">
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
                      <span className="font-black text-[#E53935]">{pt.frp} MW</span>

                      <span className="text-slate-500 font-medium">Ubicación:</span>
                      <span className="font-mono text-slate-700 text-[10px]">
                        {formatCoordinates(pt.lat, pt.lon)}
                      </span>
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            )
          })}
        </MapContainer>

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
          <span>Focos en la semana ({points.length}{points.length >= 5000 ? ' · muestra limitada a 5.000' : ''})</span>
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
        <div className="pt-2 border-t border-slate-100 max-h-48 overflow-y-auto space-y-1">
          <p className="text-[10px] text-slate-400 pb-1">
            Muestra de celdas activas (1°) con FRP máximo registrado por día y sensor de NASA FIRMS.
          </p>
          {points.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">No se registran focos activos en esta semana.</p>
          ) : (
            points.slice(0, 10).map((pt, i) => (
              <div key={i} className="flex items-center justify-between text-[11px] py-1 px-2 rounded-lg hover:bg-[#F4F6F9]">
                <span className="font-mono text-slate-600">{pt.date} • {formatCoordinates(pt.lat, pt.lon)}</span>
                <span className="font-bold text-[#E53935]">{pt.frp} MW ({pt.sensor})</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
