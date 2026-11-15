import React from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { FiltersProvider } from './hooks/useFilters'
import { Navbar } from './components/Navbar'
import { Sidebar } from './components/Sidebar'
import { MockBanner } from './components/MockBanner'
import { Home } from './pages/Home'
import { Explore } from './pages/Explore'
import { Compare } from './pages/Compare'
import { Alertas } from './pages/Alertas'
import { AboutTeam } from './pages/AboutTeam'
import { Metodologia } from './pages/Metodologia'
import { Simulador } from './pages/Simulador'
import { Prediccion } from './pages/Prediccion'
import { isLandingPath } from './utils/routes'

const AppLayout: React.FC = () => {
  const location = useLocation()
  const isHomePage = isLandingPath(location.pathname)

  return (
    <div
      className={`min-h-screen ${
        isHomePage ? 'bg-white' : 'bg-[#F4F6F9]'
      } text-slate-800 flex flex-col font-sans`}
    >
      {/* Banner de datos simulados - solo en páginas de análisis interior */}
      {!isHomePage && <MockBanner />}

      {/* Barra superior de encabezado */}
      <Navbar />

      {/* Contenedor Principal */}
      <div className="flex-1 flex w-full">
        {/* Sidebar lateral fijo solo en páginas interiores de análisis */}
        {!isHomePage && <Sidebar />}

        {/* Área de contenido principal */}
        <main className="flex-1 overflow-x-hidden min-w-0">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/explorar" element={<Explore />} />
            <Route path="/prediccion" element={<Prediccion />} />
            <Route path="/simulador" element={<Simulador />} />
            <Route path="/comparar" element={<Compare />} />
            <Route path="/alertas" element={<Alertas />} />
            <Route path="/equipo" element={<AboutTeam />} />
            <Route path="/metodologia" element={<Metodologia />} />
            <Route path="*" element={<Navigate to="/explorar" replace />} />
          </Routes>
        </main>
      </div>

      {/* Pie de página institucional solo en páginas interiores */}
      {!isHomePage && (
        <footer className="bg-white border-t border-slate-200 text-slate-500 py-5 px-4 text-xs shadow-2xs">
          <div className="max-w-[1680px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img
                src="/llama_brasa.PNG"
                alt="BRASA"
                className="h-6 w-auto object-contain"
              />
              <span className="font-bold text-[#0B1B3D]">BRASA</span>
              <span className="text-slate-300">|</span>
              <span className="font-semibold text-slate-600">
                Bitácora Regional de Actividad Satelital Armonizada
              </span>
            </div>
            <div className="flex items-center gap-4 font-bold text-slate-600">
              <span>Equipo CODE RED</span>
              <span className="text-slate-300">•</span>
              <span className="text-[#FF7900]">NASA Space Apps Challenge 2026</span>
            </div>
          </div>
        </footer>
      )}
    </div>
  )
}

export const App: React.FC = () => {
  return (
    <FiltersProvider>
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    </FiltersProvider>
  )
}

export default App
