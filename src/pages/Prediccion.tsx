import React, { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  MapContainer,
  TileLayer,
  Polygon,
  Tooltip,
  useMap,
} from 'react-leaflet'
import {
  Brain,
  AlertTriangle,
  Info,
  Flame,
  Wind,
  ShieldCheck,
  ShieldAlert,
  Layers,
  ArrowRight,
  TrendingUp,
  Sliders,
  CheckCircle2,
  Calendar,
  CloudRain,
  Thermometer,
  Compass,
} from 'lucide-react'
import 'leaflet/dist/leaflet.css'

interface PredictionFeature {
  type: string
  geometry: {
    type: string
    coordinates: number[][][]
  }
  properties: {
    sensor: string
    fuente_clima: string
    semana_objetivo: string
    probabilidad_xgboost: number
    probabilidad_historica: number
    clasificacion_xgboost: number
    umbral: number
    modelo: string
    uso: string
    cuadricula_i: number
    cuadricula_j: number
  }
}

interface FeatureCollection {
  type: string
  features: PredictionFeature[]
}

// Función auxiliar para obtener color según probabilidad XGBoost
function getProbColor(prob: number, threshold = 0.19): { fill: string; stroke: string; label: string } {
  if (prob >= 0.6) {
    return { fill: '#b91c1c', stroke: '#7f1d1d', label: 'Riesgo Crítico (>60%)' }
  }
  if (prob >= 0.35) {
    return { fill: '#ef4444', stroke: '#b91c1c', label: 'Riesgo Alto (35-60%)' }
  }
  if (prob >= threshold) {
    return { fill: '#f97316', stroke: '#c2410c', label: 'Supera Umbral (19-35%)' }
  }
  if (prob >= 0.1) {
    return { fill: '#eab308', stroke: '#a16207', label: 'Moderado (10-19%)' }
  }
  if (prob >= 0.05) {
    return { fill: '#84cc16', stroke: '#4d7c0f', label: 'Bajo (5-10%)' }
  }
  return { fill: '#10b981', stroke: '#047857', label: 'Mínimo (<5%)' }
}

// Controlador de cámara para centrar el mapa
function MapController({ center }: { center: [number, number] }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center, 9)
  }, [center, map])
  return null
}

export const Prediccion: React.FC = () => {
  const [data, setData] = useState<FeatureCollection | null>(null)
  const [selectedFeature, setSelectedFeature] = useState<PredictionFeature | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mapLayer, setMapLayer] = useState<'osm' | 'satellite' | 'topo'>('osm')

  const tileUrls = {
    osm: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    topo: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
  }

  const attributions = {
    osm: '&copy; OpenStreetMap contributors',
    satellite: 'Tiles &copy; Esri, Maxar, Earthstar',
    topo: '&copy; OpenTopoMap contributors',
  }

  // Carga del archivo GeoJSON generado por el modelo
  useEffect(() => {
    fetch('/data/prediccion_xgboost_recall_modis_era5_2019_2025.geojson')
      .then((res) => {
        if (!res.ok) throw new Error('No se pudo cargar el archivo de predicción GeoJSON')
        return res.json()
      })
      .then((geojsonData: FeatureCollection) => {
        setData(geojsonData)
        // Seleccionar por defecto la cuadrícula con mayor probabilidad
        if (geojsonData.features && geojsonData.features.length > 0) {
          const sorted = [...geojsonData.features].sort(
            (a, b) => b.properties.probabilidad_xgboost - a.properties.probabilidad_xgboost
          )
          setSelectedFeature(sorted[0])
        }
        setLoading(false)
      })
      .catch((err) => {
        console.error('Error cargando predicción:', err)
        setError(err.message)
        setLoading(false)
      })
  }, [])

  // Estadísticas del conjunto de 36 cuadrículas
  const stats = useMemo(() => {
    if (!data || !data.features.length) return null
    const feats = data.features
    const aboveThreshold = feats.filter((f) => f.properties.clasificacion_xgboost === 1).length
    const probs = feats.map((f) => f.properties.probabilidad_xgboost)
    const maxProb = Math.max(...probs)
    const avgProb = probs.reduce((a, b) => a + b, 0) / probs.length

    return {
      totalGrids: feats.length,
      aboveThreshold,
      maxProb: (maxProb * 100).toFixed(1),
      avgProb: (avgProb * 100).toFixed(1),
      targetWeek: feats[0].properties.semana_objetivo,
      threshold: (feats[0].properties.umbral * 100).toFixed(0),
    }
  }, [data])

  // Cálculo del centroide de la cuadrícula seleccionada
  const selectedCenter = useMemo(() => {
    if (!selectedFeature) return { lat: -1.8, lon: -78.8 }
    const coords = selectedFeature.geometry.coordinates[0]
    const lats = coords.map((c) => c[1])
    const lons = coords.map((c) => c[0])
    const avgLat = lats.reduce((a, b) => a + b, 0) / lats.length
    const avgLon = lons.reduce((a, b) => a + b, 0) / lons.length
    return { lat: Number(avgLat.toFixed(4)), lon: Number(avgLon.toFixed(4)) }
  }, [selectedFeature])

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1680px] mx-auto space-y-6">
      {/* Encabezado Principal */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                <Brain className="w-3.5 h-3.5 text-purple-600" />
                Machine Learning Predictivo
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                MODIS FIRMS + ERA5
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                Zona Chimborazo
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0B1B3D] tracking-tight mt-2">
              Predicción Semanal de Actividad Térmica
            </h1>
            <p className="text-slate-500 text-sm mt-1 max-w-3xl">
              Modelo supervisado <strong>XGBoost con ponderación de clase positiva (peso 12)</strong>. Estima la probabilidad
              de que el sensor satelital MODIS registre anomalías térmicas en cuadrículas de 0.2° × 0.2° cruzando recurrencia
              satelital histórica con reanálisis meteorológico (ERA5).
            </p>
          </div>

          {/* KPI Resumen Rápido */}
          {stats && (
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200/80 rounded-xl p-3 shrink-0">
              <div className="text-center px-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Semana</span>
                <span className="text-sm font-bold text-slate-700">{stats.targetWeek}</span>
              </div>
              <div className="w-px h-8 bg-slate-200" />
              <div className="text-center px-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Superan Umbral</span>
                <span className="text-sm font-extrabold text-[#FF7900]">
                  {stats.aboveThreshold} / {stats.totalGrids}
                </span>
              </div>
              <div className="w-px h-8 bg-slate-200" />
              <div className="text-center px-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Riesgo Máx</span>
                <span className="text-sm font-extrabold text-red-600">{stats.maxProb}%</span>
              </div>
            </div>
          )}
        </div>

        {/* Nota Metodológica Obligatoria de Rigor Científico */}
        <div className="mt-4 bg-amber-50/80 border border-amber-200/80 rounded-xl p-3.5 flex items-start gap-3">
          <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-900 leading-relaxed">
            <strong>Aviso de rigor metodológico (NASA Space Apps):</strong> Estimación experimental retrospectiva de actividad
            térmica detectada por MODIS para la semana del <strong>29-12-2025</strong>. No constituye una alerta confirmada de incendio forestal
            ni un pronóstico en tiempo real para semanas posteriores sin nueva inferencia con datos meteorológicos actualizados.
          </p>
        </div>
      </div>

      {/* Grid Principal: Mapa (70%) + Detalle de Zona (30%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Mapa Leaflet de las 36 Cuadrículas */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between bg-slate-50/60 gap-2">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-600" />
              <h2 className="text-sm font-bold text-[#0B1B3D]">
                Cuadrícula Espacial de Probabilidad (36 celdas de 0.2°)
              </h2>
            </div>
            
            {/* Selector de capa base sin marca de agua */}
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setMapLayer('osm')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  mapLayer === 'osm'
                    ? 'bg-[#0B1B3D] text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Estándar
              </button>
              <button
                type="button"
                onClick={() => setMapLayer('satellite')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  mapLayer === 'satellite'
                    ? 'bg-[#0B1B3D] text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Satélite
              </button>
              <button
                type="button"
                onClick={() => setMapLayer('topo')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  mapLayer === 'topo'
                    ? 'bg-[#0B1B3D] text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Relieve
              </button>
            </div>
          </div>

          <div className="relative flex-1 min-h-[460px] sm:min-h-[520px]">
            {loading && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/80">
                <div className="flex items-center gap-2 text-slate-600 font-semibold text-sm">
                  <span className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                  Cargando cuadrículas del modelo XGBoost...
                </div>
              </div>
            )}

            {error && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/90 p-6 text-center">
                <div className="text-red-600 space-y-2">
                  <AlertTriangle className="w-8 h-8 mx-auto" />
                  <p className="font-bold text-sm">Error al cargar datos de predicción</p>
                  <p className="text-xs text-slate-500">{error}</p>
                </div>
              </div>
            )}

            <MapContainer
              center={[-1.9, -78.8]}
              zoom={9}
              className="w-full h-full min-h-[460px] sm:min-h-[520px]"
              scrollWheelZoom={true}
            >
              <MapController center={[-1.9, -78.8]} />
              <TileLayer
                attribution={attributions[mapLayer]}
                url={tileUrls[mapLayer]}
              />

              {data &&
                data.features.map((feature, idx) => {
                  const props = feature.properties
                  const prob = props.probabilidad_xgboost
                  const colors = getProbColor(prob, props.umbral)
                  const isSelected =
                    selectedFeature?.properties.cuadricula_i === props.cuadricula_i &&
                    selectedFeature?.properties.cuadricula_j === props.cuadricula_j

                  // GeoJSON usa [lon, lat], Leaflet Polygon usa [lat, lon]
                  const leafPositions = feature.geometry.coordinates[0].map(
                    (coord) => [coord[1], coord[0]] as [number, number]
                  )

                  return (
                    <Polygon
                      key={`${props.cuadricula_i}-${props.cuadricula_j}-${idx}`}
                      positions={leafPositions}
                      pathOptions={{
                        color: isSelected ? '#0B1B3D' : colors.stroke,
                        weight: isSelected ? 3.5 : 1.5,
                        fillColor: colors.fill,
                        fillOpacity: isSelected ? 0.85 : 0.65,
                        dashArray: isSelected ? '4, 4' : undefined,
                      }}
                      eventHandlers={{
                        click: () => setSelectedFeature(feature),
                      }}
                    >
                      <Tooltip direction="top" opacity={0.95}>
                        <div className="text-xs font-sans space-y-1 py-0.5">
                          <p className="font-bold text-slate-800">
                            Cuadrícula [{props.cuadricula_i}, {props.cuadricula_j}]
                          </p>
                          <p className="text-purple-700 font-extrabold">
                            P(XGBoost): {(prob * 100).toFixed(1)}%
                          </p>
                          <p className="text-slate-500 text-[11px]">
                            Histórica: {(props.probabilidad_historica * 100).toFixed(1)}%
                          </p>
                          <p className="text-[10px] font-semibold text-slate-600">
                            {props.clasificacion_xgboost === 1
                              ? '⚠️ Supera umbral (19%)'
                              : '✓ Bajo umbral'}
                          </p>
                        </div>
                      </Tooltip>
                    </Polygon>
                  )
                })}
            </MapContainer>

            {/* Leyenda Visual Superpuesta */}
            <div className="absolute bottom-4 left-4 z-[400] bg-white/95 backdrop-blur-xs p-3 rounded-xl border border-slate-200/90 shadow-md text-xs space-y-1.5 max-w-[240px]">
              <div className="flex items-center justify-between font-bold text-slate-700 pb-1 border-b border-slate-100">
                <span>Riesgo de Actividad</span>
                <span className="text-[10px] text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">
                  Umbral 19%
                </span>
              </div>
              <div className="space-y-1 font-medium text-slate-600 text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded bg-[#b91c1c] border border-[#7f1d1d]" />
                  <span>&gt; 60% — Muy Alto</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded bg-[#ef4444] border border-[#b91c1c]" />
                  <span>35% - 60% — Alto</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded bg-[#f97316] border border-[#c2410c]" />
                  <span>19% - 35% — Supera Umbral</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded bg-[#eab308] border border-[#a16207]" />
                  <span>10% - 19% — Moderado</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded bg-[#10b981] border border-[#047857]" />
                  <span>&lt; 10% — Bajo / Mínimo</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Panel Lateral: Detalle de Zona Seleccionada */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-[#FF7900]" />
                <h3 className="text-sm font-bold text-[#0B1B3D]">Zona Seleccionada</h3>
              </div>
              {selectedFeature && (
                <span className="text-xs font-mono font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                  Celda [{selectedFeature.properties.cuadricula_i}, {selectedFeature.properties.cuadricula_j}]
                </span>
              )}
            </div>

            {selectedFeature ? (
              <div className="mt-4 space-y-5">
                {/* Coordenadas */}
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-xs flex justify-between items-center">
                  <span className="text-slate-500">Centro aproximado:</span>
                  <span className="font-mono font-bold text-slate-700">
                    {selectedCenter.lat.toFixed(3)}°, {selectedCenter.lon.toFixed(3)}°
                  </span>
                </div>

                {/* Probabilidad XGBoost vs Histórica */}
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-xs font-semibold mb-1">
                      <span className="text-slate-700 flex items-center gap-1.5">
                        <Brain className="w-3.5 h-3.5 text-purple-600" />
                        Probabilidad Modelo XGBoost
                      </span>
                      <span className="text-base font-extrabold text-purple-700">
                        {(selectedFeature.properties.probabilidad_xgboost * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, selectedFeature.properties.probabilidad_xgboost * 100)}%`,
                          backgroundColor: getProbColor(selectedFeature.properties.probabilidad_xgboost).fill,
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs font-semibold mb-1">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
                        Referencia Histórica de la Zona
                      </span>
                      <span className="text-xs font-bold text-slate-600">
                        {(selectedFeature.properties.probabilidad_historica * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-slate-400 rounded-full"
                        style={{
                          width: `${Math.min(100, selectedFeature.properties.probabilidad_historica * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Clasificación de Decisión Operativa */}
                <div
                  className={`p-3.5 rounded-xl border text-xs ${
                    selectedFeature.properties.clasificacion_xgboost === 1
                      ? 'bg-amber-50/90 border-amber-300 text-amber-900'
                      : 'bg-emerald-50/90 border-emerald-200 text-emerald-900'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold mb-1">
                    {selectedFeature.properties.clasificacion_xgboost === 1 ? (
                      <>
                        <ShieldAlert className="w-4 h-4 text-amber-600" />
                        <span>SUPERÓ EL UMBRAL OPERATIVO (19%)</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <span>BAJO EL UMBRAL DE DECISIÓN</span>
                      </>
                    )}
                  </div>
                  <p className="text-[11px] leading-relaxed opacity-90">
                    {selectedFeature.properties.clasificacion_xgboost === 1
                      ? 'El modelo estima una probabilidad superior al umbral calibrado de 0.19 para la presencia de anomalías térmicas en la semana.'
                      : 'La probabilidad estimada se sitúa por debajo del umbral de decisión 0.19. No se activan medidas de alerta prioritaria.'}
                  </p>
                </div>

                {/* Botón de Enlace al Simulador Táctico */}
                <Link
                  to={`/simulador?lat=${selectedCenter.lat}&lon=${selectedCenter.lon}&sensor=MODIS&date=2025-12-29`}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-[#FF7900] hover:bg-[#E56D00] text-white rounded-xl font-bold text-xs shadow-sm hover:shadow transition-all"
                >
                  <Flame className="w-4 h-4" />
                  <span>Simular propagación en esta zona</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 text-xs">
                Selecciona una cuadrícula en el mapa para examinar sus variables
              </div>
            )}
          </div>

          {/* Tarjeta de Variables del Modelo */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3">
            <h4 className="text-xs font-bold text-[#0B1B3D] uppercase tracking-wider flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-purple-600" />
              14 Variables del Modelo XGBoost
            </h4>
            <div className="text-xs text-slate-600 space-y-2">
              <div className="flex items-start gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-500 mt-1 shrink-0" />
                <div>
                  <strong className="text-slate-700">Recurrencia MODIS (6):</strong>
                  <span className="text-slate-500 text-[11px] block">
                    count, count_lag1, count_lag2, sum_last4, sum_last12, active_last4
                  </span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500 mt-1 shrink-0" />
                <div>
                  <strong className="text-slate-700">Espaciotemporales (4):</strong>
                  <span className="text-slate-500 text-[11px] block">
                    latitude, longitude, sin_week, cos_week
                  </span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1 shrink-0" />
                <div>
                  <strong className="text-slate-700">Clima ERA5 Open-Meteo (4):</strong>
                  <span className="text-slate-500 text-[11px] block">
                    temperatura media, lluvia 7d, humedad relativa, viento medio
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Panel Inferior: Evaluación Retrospectiva y Desempeño (Año 2025) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
          <div>
            <h3 className="text-base font-bold text-[#0B1B3D] flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Desempeño y Validación Científica (Evaluación 2025)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Evaluación rigurosa sobre 1,836 casos de prueba (86 detecciones positivas y 1,750 negativas)
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-full self-start sm:self-auto">
            Configuración: XGBoost Peso 12 | Umbral 0.19
          </span>
        </div>

        {/* Grilla de Métricas */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mt-5">
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 text-center">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Recall (Sensibilidad)</span>
            <span className="text-xl font-extrabold text-purple-700 block mt-1">55.81%</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">48 de 86 detectados</span>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 text-center">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Precisión</span>
            <span className="text-xl font-extrabold text-blue-700 block mt-1">59.26%</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">33 falsas alarmas</span>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 text-center">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">ROC-AUC</span>
            <span className="text-xl font-extrabold text-emerald-700 block mt-1">0.8685</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Discriminación alta</span>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 text-center">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">F1-Score</span>
            <span className="text-xl font-extrabold text-amber-700 block mt-1">57.49%</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Balance P/R</span>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 text-center">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Accuracy Total</span>
            <span className="text-xl font-extrabold text-slate-800 block mt-1">96.13%</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Base sin modelo: 95.3%</span>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 text-center">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Brier Score</span>
            <span className="text-xl font-extrabold text-slate-800 block mt-1">0.0288</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Histórico: 0.0280</span>
          </div>
        </div>

        {/* Tabla de Matriz de Confusión Compacta */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between text-xs text-slate-500 gap-3">
          <div className="flex flex-wrap items-center gap-4">
            <span><strong>Verdaderos Positivos:</strong> 48</span>
            <span className="text-slate-300">•</span>
            <span><strong>Falsos Negativos (No detectados):</strong> 38</span>
            <span className="text-slate-300">•</span>
            <span><strong>Falsas Alarmas:</strong> 33</span>
            <span className="text-slate-300">•</span>
            <span><strong>Negativos Correctos:</strong> 1,717</span>
          </div>
          <span className="text-[11px] text-slate-400 italic">
            Entrenamiento: 2019-2023 | Calibración y Umbral: 2024
          </span>
        </div>
      </div>
    </div>
  )
}
export default Prediccion
