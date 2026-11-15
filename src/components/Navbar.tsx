import React, { useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Satellite, Menu, X } from 'lucide-react'
import { isLandingPath } from '../utils/routes'
import { IS_MOCK_MODE } from '../api/client'
import { NAV_ITEMS } from '../utils/navItems'

/* Enlaces superiores de las páginas informativas */
const TOP_LINKS = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/explorar', label: 'Explorar' },
  { to: '/prediccion', label: 'Predicción ML' },
  { to: '/simulador', label: 'Simulador Táctico' },
  { to: '/metodologia', label: 'Metodología' },
  { to: '/equipo', label: 'Acerca de nosotros' },
]

export const Navbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const location = useLocation()
  const isLanding = isLandingPath(location.pathname)

  /* En páginas interiores el sidebar aparece desde lg: el menú móvil cubre todo lo anterior */
  const mobileOnly = isLanding ? 'md:hidden' : 'lg:hidden'

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-100">
      <div className="w-full max-w-[1680px] mx-auto px-6 sm:px-10 lg:px-12 h-18 flex items-center justify-between">
        {/* Marca */}
        <Link to="/" className="flex items-center gap-2.5 sm:gap-3 group focus:outline-hidden py-1">
          <img
            src="/llama_brasa.PNG"
            alt="BRASA Logo"
            className="h-8 sm:h-9 w-auto object-contain transition-transform group-hover:scale-105"
          />
          <span className="text-2xl sm:text-[26px] font-black tracking-wider text-[#0B1B3D]">BRASA</span>
          {!isLanding && (
            <div className="hidden sm:block pl-3 ml-1 border-l border-slate-200">
              <span className="block font-black text-xs uppercase tracking-wider text-[#0B1B3D]">
                NASA Space Apps <span className="text-[#FF7900]">2026</span>
              </span>
              <p className="text-xs text-slate-500">Bitácora Regional de Actividad Satelital Armonizada</p>
            </div>
          )}
        </Link>

        {isLanding ? (
          <nav className="hidden md:flex items-center gap-8 lg:gap-10">
            {TOP_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  `relative py-2 text-sm sm:text-base font-semibold transition-colors ${
                    isActive ? 'text-[#FF7900]' : 'text-[#0B1B3D] hover:text-[#FF7900]'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span>{link.label}</span>
                    {isActive && (
                      <span className="absolute -bottom-1 left-0 right-0 h-0.75 bg-[#FF7900] rounded-full" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        ) : (
          <div className="hidden lg:flex items-center gap-2">
            {/* Indicador persistente mientras no haya base de datos conectada (el banner se puede cerrar) */}
            {IS_MOCK_MODE && (
              <span className="inline-flex items-center gap-2 text-xs font-bold text-[#B45309] px-3.5 py-1.5 rounded-full bg-[#FFF9E6]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF7900]" />
                Datos simulados
              </span>
            )}
            <span className="inline-flex items-center gap-2 text-xs font-bold text-[#0B1B3D] px-3.5 py-1.5 rounded-full border border-slate-200">
              <Satellite className="w-4 h-4 text-[#FF7900]" />
              MODIS & VIIRS
            </span>
          </div>
        )}

        {/* Botón de menú (móvil y tablet) */}
        <div className={`flex items-center ${mobileOnly}`}>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-xl text-slate-600 hover:text-[#0B1B3D] hover:bg-slate-50 focus:outline-hidden"
            aria-expanded={mobileMenuOpen}
            aria-label="Abrir menú de navegación"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Menú desplegable */}
      {mobileMenuOpen && (
        <div className={`${mobileOnly} border-t border-slate-100 bg-white px-5 pt-3 pb-6 space-y-1 shadow-xl`}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-colors ${
                    isActive ? 'bg-[#0B1B3D] text-white font-bold' : 'text-slate-600 hover:text-[#0B1B3D] hover:bg-slate-50'
                  }`
                }
              >
                <Icon className="w-5 h-5 text-[#FF7900]" />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 px-3">
            <span>Equipo CODE RED</span>
            <span className="font-bold text-[#FF7900]">NASA Space Apps 2026</span>
          </div>
        </div>
      )}
    </header>
  )
}
