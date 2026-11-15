# BRASA — Bitácora Regional de Actividad Satelital Armonizada
### NASA Space Apps Challenge 2026 • Desarrollado por el Equipo CODE RED
**Institución:** Escuela Superior Politécnica de Chimborazo (ESPOCH), Riobamba, Ecuador.

---

## 🛰️ 1. Problema Abordado

Comprender la distribución global y temporal de la actividad de fuego y anomalías térmicas es un desafío complejo para investigadores, gestores territoriales y tomadores de decisiones. 

NASA FIRMS ofrece un catálogo extraordinario de observaciones satelitales globales, pero presenta dos barreras científicas cruciales:
1. **Disparidad de resolución instrumental:** MODIS observa con una resolución nominal de 1 km (desde 2000/2001), mientras que VIIRS opera a 375 m (desde 2012 con Suomi-NPP y 2018 con NOAA-20). Sumar detecciones sin tratamiento genera un salto artificial a partir de 2012 que puede interpretarse erróneamente como un incremento drástico en la cantidad de incendios.
2. **Volumen masivo no indexado para la web:** Decenas de millones de registros distribuidos en múltiples archivos anuales impiden una exploración fluida e interactiva en navegadores web sin infraestructura de procesamiento optimizada.

---

## 🔥 2. La Solución BRASA

**BRASA** transforma millones de observaciones satelitales de NASA FIRMS en una plataforma web interactiva, responsiva y científicamente fundamentada que permite:
- **Explorar:** Navegar espacialmente anomalías térmicas activas y consultar series temporales de 2001 a 2025.
- **Calendario Histórico:** Visualizar la actividad semanal agregada en matrices de calor (*heatmaps*) de 52/53 semanas ISO por año.
- **Comparar:** Contrastar año contra año (ej. 2024 vs 2012) para evaluar temporadas secas críticas, duración y desplazamientos fenológicos.
- **Alertas Estadísticas:** Diagnosticar la semana observada respecto a su propia climatología histórica (media, percentiles P10, P50, P90 y Z-score), clasificando el régimen en *Normal*, *Elevado* o *Inusual*.
- **Alcance Global y Enfoque Regional:** Cobertura de 177 países de referencia mundial con subdivisiones detalladas para Ecuador.

---

## 🌍 3. Why BRASA Matters (International Scientific Summary)

> **Why BRASA Matters:**  
> Satellite thermal anomaly monitoring often struggles with the instrumental transition between sensor generations. The introduction of VIIRS (375 m) in 2012 dramatically increased raw hotspot counts compared to legacy MODIS (1 km), creating potential misinterpretations in multi-decadal fire trend studies.
>
> BRASA addresses this challenge by aggregating daily vegetation fire detections (`type=0`) into uniform spatial grids using the **fire_cell_days** metric, allowing researchers and civil authorities to explore 2001–2025 historical patterns across 177 countries without false pixel-multiplication artifacts. By coupling climatological percentiles (P10–P90) and z-scores with interactive mapping, BRASA provides an open, accessible diagnostic tool to identify unseasonal burning activity worldwide.
>
> *Note: BRASA is an exploratory scientific platform designed for the NASA Space Apps Challenge 2026; its statistical alert levels do not replace official emergency or disaster response systems.*

---

## 🔬 4. Fuentes de Datos y Fundamento Científico

### 4.1. Sensores Satelitales NASA FIRMS
- **MODIS (Terra y Aqua):** Resolución nominal ~1 km. Registros disponibles y consolidados desde 2000/2001.
- **VIIRS (Suomi-NPP y NOAA-20):** Resolución nominal ~375 m en bandas I. Registros disponibles desde 2012 (S-NPP) y 2018 (NOAA-20).
- **Filtro de clasificación:** Se procesan exclusivamente observaciones clasificadas como `type=0` (fuegos de vegetación/quema biológica), excluyendo offshore, actividad industrial y volcanes.

### 4.2. Métrica `fire_cell_days` (fcd)
Un incendio forestal extenso puede activar decenas de píxeles VIIRS vecinos en una misma pasada satelital. Para evitar sesgos instrumentales:
- El espacio se discretiza en una cuadrícula homogénea (celdas de 1 grado en el resumen espacial mundial).
- Si en una celda se detecta al menos un foco térmico activo en un día y para una familia de sensor, se cuenta como **1 celda-día**.
- Esto amortigua la diferencia de densidad de píxeles entre MODIS (1 km) y VIIRS (375 m).

### 4.3. Diferencias Instrumentales y Solapamiento
MODIS y VIIRS **no son idénticos radiométricamente**. Durante el período de solapamiento (2012–2018), ambos sensores observaron simultáneamente. BRASA presenta sus curvas comparativas y advierte explícitamente a los usuarios sobre el cambio de sensibilidad a partir de 2012 en lugar de alterar arbitrariamente los registros con factores no demostrados.

---

## 🏛️ 5. Arquitectura del Sistema

```text
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND WEB                           │
│  React 19 • TypeScript • Vite • Tailwind CSS v4 • ECharts    │
│  Leaflet / React Leaflet • Lucide React • React Router v7   │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP REST (JSON)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND FASTAPI                          │
│  Python 3.11+ • FastAPI • SQLite3 (Modo Solo Lectura)       │
│  endpoints: /health, /api/regions, /api/calendar,           │
│  /api/climatology, /api/season, /api/anomalies, /api/hotspots│
└──────────────────────────────┬──────────────────────────────┘
                               │ Consultas indexadas
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                BASES DE DATOS GEOESPACIALES                 │
│  • brasa_render.db: Resumen semanal preprocesado             │
│    (919.814 filas agregadas, 177 países, 2004–2026)         │
│  • brasa_mapa.db: Capa espacial de focos (2.846.750 puntos) │
│  • geografia/paises_referencia.json: Polígonos y centros    │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 6. Instalación y Ejecución Local

### 6.1. Prerrequisitos
- **Node.js:** Versión 18+ (recomendado Node 20 o superior).
- **Python:** Versión 3.10+ (con virtualenv).

### 6.2. Backend (FastAPI)
```bash
# 1. Acceder al directorio backend
cd backend

# 2. Activar el entorno virtual existente o crear uno
# En Windows PowerShell:
.\.venv\Scripts\Activate.ps1
# En Linux / macOS:
# source .venv/bin/activate

# 3. Instalar dependencias si fuera necesario
pip install -r requirements.txt

# 4. Iniciar la API REST
uvicorn main:app --reload --port 8000
```
La API estará disponible en `http://localhost:8000` y su documentación interactiva Swagger en `http://localhost:8000/docs`.

### 6.3. Frontend (React + Vite)
```bash
# 1. En la raíz del repositorio, instalar dependencias
npm install

# 2. Configurar variables de entorno (.env)
# Por defecto se conecta al backend local en http://localhost:8000
npm run dev
```
La aplicación web se abrirá en `http://localhost:5173`.

---

## ⚙️ 7. Variables de Entorno

Configurables en `.env` (basado en `.env.example`):

| Variable | Valor por defecto | Descripción |
| :--- | :--- | :--- |
| `VITE_API_URL` | `http://localhost:8000` | URL base de la API REST del backend (local o desplegada en Render). |
| `VITE_USE_MOCK` | `false` | `false` para consultar datos reales NASA FIRMS del backend; `true` para activar modo demo / simulación. |

---

## 🧪 8. Pruebas Automatizadas

El proyecto incluye suites completas de pruebas unitarias y de integración:

### Pruebas de Frontend (Vitest)
```bash
npm test
```
Ejecuta las pruebas de utilidades geográficas (`geoUtils`), fechas ISO (`dateUtils`), generador determinista (`apiMock`) y componentes UI (`components.test.tsx`).

### Comprobación de Tipos y Compilación
```bash
npm run build
```
Ejecuta el compilador de TypeScript (`tsc -b`) y empaqueta los assets de producción con Vite.

### Linter
```bash
npm run lint
```
Ejecuta Oxlint sobre todos los archivos TypeScript y JSX del proyecto.

### Verificación del Backend Python
```bash
backend\.venv\Scripts\python.exe backend\verify_main.py
```
Verifica la integridad de las bases SQLite, la conexión en solo lectura y la validez de los endpoints `/health`, `/api/regions`, `/api/calendar`, `/api/climatology`, `/api/season`, `/api/anomalies`, `/api/current-status` y `/api/hotspots`.

---

## ☁️ 9. Despliegue en la Nube (Render)

El archivo `render.yaml` en la raíz define el servicio web para Render:
- **Build command:** `cd backend && python -m pip install -r requirements_render.txt && python descomprimir_render.py && python descomprimir_mapa.py`
- **Start command:** `cd backend && python -m uvicorn main:app --host 0.0.0.0 --port $PORT`
- **Health check path:** `/health`
- **Runtime:** Python 3.11.9

Tanto `brasa_render.db.gz` (~5 MB) como `brasa_mapa.db.gz` (~51 MB) se encuentran bajo el límite de tamaño de archivos de GitHub y se descomprimen automáticamente al arrancar el contenedor en Render.

---

## ⚠️ 10. Limitaciones Científicas Identificadas

1. **Resolución de agregación:** La base espacial mundial se encuentra precalculada a nivel de celdas de 1° por día y familia de sensor. Los puntos visibles en el mapa representan los centros de celdas activas con su FRP representativo, no la latitud/longitud exacta de cada píxel FIRMS.
2. **Subdivisiones territoriales:** El selector permite navegar los 177 países del catálogo de referencia. Para Ecuador se incluyen las provincias y cantones históricos; para otros países la consulta se ejecuta a escala nacional y continental.
3. **Sensores:** Las observaciones anteriores a 2012 corresponden exclusivamente a MODIS; las series posteriores combinan MODIS y VIIRS.
4. **Naturaleza orientativa:** Los umbrales estadísticos (Normal, Elevado, Inusual) son herramientas de análisis exploratorio y **no constituyen declaraciones oficiales de desastre ni alertas tempranas operativas**.

---

## 👥 11. Equipo CODE RED EMERGENCY OPS
- **Institución:** Escuela Superior Politécnica de Chimborazo (ESPOCH), Riobamba, Ecuador.
- **Competencia:** NASA Space Apps Challenge 2026.
- **Licencia:** MIT.
