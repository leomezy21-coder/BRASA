# BRASA — Bitácora Regional de Actividad Satelital Armonizada
### NASA Space Apps Challenge 2026 • Desarrollado por el Equipo CODE RED

BRASA es una plataforma web interactiva para explorar y comparar la actividad térmica histórica a escala mundial, con un período principal de referencia de 2005 a 2025. Utiliza observaciones de NASA FIRMS provenientes de MODIS y VIIRS. La cobertura temporal varía según el sensor, el territorio y los archivos disponibles.

El frontend React consume la API REST de FastAPI. El modo de datos reales se activa con VITE_USE_MOCK=false; el modo Mock se conserva exclusivamente para demostraciones y pruebas identificadas como datos simulados.

---

## 🚀 Tecnologías Principales

- **Framework:** React 19 + TypeScript + Vite
- **Estilos:** Tailwind CSS v4
- **Navegación:** React Router v7
- **Mapas Geoespaciales:** Leaflet + React Leaflet + Leaflet Draw
- **Visualización Científica:** ECharts (`echarts` y `echarts-for-react`)
- **Iconografía:** Lucide React
- **Pruebas:** Vitest + React Testing Library + JSDOM

---

## 📂 Estructura del Proyecto

```text
├── .env.example              # Variables de entorno de ejemplo
├── .env                      # Configuración local activa
├── index.html                # Entrada HTML con metadatos y favicon
├── package.json              # Dependencias y scripts
├── vite.config.ts            # Configuración de Vite, Tailwind y Vitest
├── src/
│   ├── api/
│   │   ├── client.ts         # Cliente HTTP con soporte de AbortSignal y selector de modo Mock
│   │   └── mock.ts           # Generador de datos simulados para demostración
│   ├── components/
│   │   ├── Navbar.tsx        # Navegación principal y badges de estado
│   │   ├── MockBanner.tsx    # Banner informativo "Datos simulados de demostración"
│   │   ├── FiltersPanel.tsx  # Filtros territoriales, sensores, cobertura, radio y GeoJSON
│   │   ├── MapView.tsx       # Mapa Leaflet de símbolos proporcionales por FRP y capas
│   │   ├── KpiCards.tsx      # 4 indicadores clave (Pico, Año récord, Tendencia, Estado)
│   │   ├── FireCalendar.tsx  # Matriz Heatmap (Años vs Semanas ISO) en fire_cell_days
│   │   ├── ClimatologyChart.tsx # Gráfico de banda percentil P10-P90, media y año en foco
│   │   ├── AnomalyList.tsx   # Períodos inusuales ordenados por Z-Score
│   │   ├── TimelinePlayer.tsx# Reproductor de semanas temporal interactivo
│   │   ├── ExportControls.tsx# Exportación de datos a CSV y gráficos a PNG
│   │   ├── SkeletonLoader.tsx# Skeletons de carga
│   │   └── ErrorMessage.tsx  # Estado de error con botón de reintento
│   ├── hooks/
│   │   ├── useFilters.tsx    # Contexto global y estado compartido de filtros
│   │   ├── useBrasaData.ts   # Hook central de consultas con cancelación y reintentos
│   │   └── useTimeline.ts    # Controlador de animación temporal
│   ├── pages/
│   │   ├── Home.tsx          # Presentación ejecutiva y acceso directo
│   │   ├── Explore.tsx       # Dashboard interactivo principal
│   │   ├── Compare.tsx       # Herramienta de comparación interanual
│   │   ├── Alertas.tsx       # Diagnóstico de semana actual (Semáforo y Z-score)
│   │   ├── Methodology.tsx   # Documentación científica MODIS vs VIIRS y fire_cell_days
│   │   └── AboutTeam.tsx     # Información del equipo CODE RED y visión del proyecto
│   ├── utils/
│   │   ├── dateUtils.ts      # Cálculo de semanas ISO y rangos de fechas
│   │   ├── exportUtils.ts    # Exportadores a CSV y PNG
│   │   └── geoUtils.ts       # Geometrías circulares, polígonos y bounding boxes
│   ├── types.ts              # Definiciones de tipos y contrato de API REST
│   └── test/                 # Pruebas unitarias y de integración
```

---

## 🛠️ Instalación y Ejecución

### Prerrequisitos
- Node.js versión 18+ (recomendado Node 20 o superior).
- npm versión 9+.

### Pasos
1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Iniciar servidor de desarrollo:**
   ```bash
   npm run dev
   ```
   Abre [http://localhost:5173](http://localhost:5173) en tu navegador.

3. **Ejecutar pruebas unitarias:**
   ```bash
   npm run test
   ```

4. **Compilar para producción:**
   ```bash
   npm run build
   ```

---

## ⚙️ Variables de Entorno

Configurables en `.env` (basado en `.env.example`):

| Variable | Valor por defecto | Descripción |
| :--- | :--- | :--- |
| `VITE_API_URL` | `http://localhost:8000` | URL base de la API REST del backend. |
| `VITE_USE_MOCK` | `true` | `true` para usar datos simulados deterministas; `false` para conectar al backend real. |

> En modo mock (`VITE_USE_MOCK=true`), la aplicación muestra el banner superior: **"Datos simulados de demostración"**.

---

## 📡 Contrato de API REST

El frontend se comunica exclusivamente mediante las funciones tipadas en `src/api/client.ts`. Todas las peticiones `POST` envían los parámetros base de filtrado y reciben respuestas en formato JSON estructurado:

### Parámetros Base de Filtrado (Peticiones POST)
```json
{
  "year_from": 2005,
  "year_to": 2025,
  "sensor": "harmonized",
  "confidence": "all",
  "daynight": "all",
  "country_code": "BRA"
}
```

### Endpoints Oficiales

#### 1. Calendario Histórico
- **Método:** `POST /api/calendar`
- **Respuesta:**
  ```json
  {
    "unit": "fire_cell_days",
    "weeks": [
      {
        "year": 2024,
        "week": 36,
        "value": 142.5,
        "source": "BOTH" // "MODIS" | "BOTH" | "VIIRS_CAL"
      }
    ]
  }
  ```

#### 2. Climatología Semanal (Línea Base Histórica)
- **Método:** `POST /api/climatology`
- **Respuesta:**
  ```json
  {
    "weeks": [
      {
        "week": 36,
        "mean": 48.2,
        "p10": 12.0,
        "p50": 42.5,
        "p90": 98.4
      }
    ]
  }
  ```

#### 3. Temporadas Anuales
- **Método:** `POST /api/season`
- **Respuesta:**
  ```json
  {
    "years": [
      {
        "year": 2024,
        "start_week": 29,
        "peak_week": 36,
        "end_week": 43,
        "total": 1845.2
      }
    ]
  }
  ```

#### 4. Anomalías Estadísticas
- **Método:** `POST /api/anomalies`
- **Respuesta:**
  ```json
  {
    "items": [
      {
        "year": 2024,
        "week": 36,
        "value": 142.5,
        "zscore": 2.85,
        "percentile": 94.2
      }
    ]
  }
  ```

#### 5. Focos de Calor Activos
- **Método:** `POST /api/hotspots`
- **Parámetros adicionales:** `year`, `week` o `date_from`, `date_to`.
- **Respuesta:**
  ```json
  {
    "points": [
      {
        "lat": -1.6709,
        "lon": -78.6545,
        "date": "2024-09-04",
        "frp": 68.4,
        "sensor": "VIIRS"
      }
    ]
  }
  ```

#### 6. Estado de la Semana Actual
- **Método:** `POST /api/current-status`
- **Respuesta:**
  ```json
  {
    "week": 37,
    "value": 84.1,
    "percentile": 82.5,
    "zscore": 1.64,
    "level": "elevado" // "normal" | "elevado" | "inusual"
  }
  ```

#### 7. Regiones y Provincias
- **Método:** `GET /api/regions`
- **Respuesta:**
  ```json
  [
    {
      "id": "chimborazo",
      "name": "Chimborazo",
      "center": [-1.6709, -78.6545],
      "zoom": 10,
      "cantons": [
        { "id": "riobamba", "name": "Riobamba", "lat": -1.6709, "lon": -78.6545 }
      ],
      "geojson": {
        "type": "Polygon",
        "coordinates": [...]
      }
    }
  ]
  ```

---

## 🌐 Despliegue en Producción

### Despliegue en Netlify
1. Conecta tu repositorio de GitHub en Netlify.
2. Configura los parámetros de compilación:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
3. Agrega la variable de entorno:
   - `VITE_USE_MOCK=true` (o la URL de tu backend en `VITE_API_URL`).
4. Añade un archivo `public/_redirects` con el siguiente contenido para dar soporte al enrutamiento de React Router:
   ```text
   /*    /index.html   200
   ```

### Despliegue en GitHub Pages
1. Instala el paquete opcional `gh-pages` o configura GitHub Actions.
2. En GitHub Actions, utiliza el flujo de trabajo estándar de Vite estático desplegando la carpeta `dist`.

---

## 🔬 Consideraciones Metodológicas de NASA FIRMS
1. **Píxeles activos ≠ Incendios individuales:** Los sensores detectan anomalías térmicas en píxeles de superficie (1km en MODIS y 375m en VIIRS). Un mismo incendio extenso activa múltiples píxeles vecinos a lo largo de varios días.
2. **fire_cell_days:** La métrica estandarizada cuenta la presencia diaria de actividad en cuadrículas regulares de 0.05°, evitando el sesgo artificial de incremento de conteo derivado del salto tecnológico de MODIS a VIIRS en 2012.
3. **Potencia Radiativa de Fuego (FRP):** Representa la tasa instantánea de energía radiativa liberada en megavatios (MW), directamente proporcional a la biomasa consumida y emisión de carbono.

---

## 👥 Equipo CODE RED
Proyecto desarrollado con fines científicos y educativos para el **NASA Space Apps Challenge 2026**.
Licencia MIT.
