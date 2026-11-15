import React, { useRef } from 'react'
import { Link } from 'react-router-dom'
import { Users, Wind } from 'lucide-react'
import { CursorGlow } from '../components/CursorGlow'
import { usePointerEffects } from '../hooks/usePointerEffects'
import { PRIMARY_BUTTON_FX, SECONDARY_BUTTON_FX } from '../utils/buttonFx'

const BarChartFilled = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <rect x="3" y="11" width="4" height="10" rx="1.5" />
    <rect x="10" y="4" width="4" height="17" rx="1.5" />
    <rect x="17" y="8" width="4" height="13" rx="1.5" />
  </svg>
)

export const Home: React.FC = () => {
  const sectionRef = useRef<HTMLDivElement>(null)
  const glowRef = useRef<HTMLDivElement>(null)
  const earthRef = useRef<HTMLDivElement>(null)
  const logoRef = useRef<HTMLDivElement>(null)
  const logoGlowRef = useRef<HTMLSpanElement>(null)

  usePointerEffects(sectionRef, {
    glowRef,
    parallaxRef: earthRef,
    parallax: { x: 14, y: 6 },
    magnetRef: logoRef,
    magnetGlowRef: logoGlowRef,
  })

  return (
    <div
      ref={sectionRef}
      className="relative min-h-[calc(100vh-73px)] flex flex-col justify-between bg-white overflow-hidden select-none"
    >
      <CursorGlow ref={glowRef} />

      {/* Contenido Central Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 pt-8 pb-4 sm:py-8 max-w-4xl mx-auto text-center z-10 w-full">
        {/* Ícono de Llama de BRASA con punta completa intacta */}
        <div ref={logoRef} className="relative mb-3 sm:mb-4 will-change-transform">
          <span
            ref={logoGlowRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 scale-150 rounded-full opacity-0 bg-[radial-gradient(circle,rgba(255,121,0,0.28)_0%,rgba(255,121,0,0)_65%)]"
          />
          <img
            src="/llama_brasa.PNG"
            alt="BRASA Logo"
            className="h-20 sm:h-24 md:h-28 w-auto mx-auto object-contain drop-shadow-xs"
          />
        </div>

        {/* Título Principal */}
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-black text-[#0B1B3D] tracking-tight leading-none">
          BRASA
        </h1>

        {/* Subtítulo Institucional */}
        <h2 className="text-lg sm:text-2xl md:text-[25px] text-[#0B1B3D] font-normal tracking-tight mt-2.5 sm:mt-3 px-2">
          Bitácora Regional de Actividad Satelital Armonizada
        </h2>

        {/* Divisor Naranja */}
        <div className="w-12 h-1 bg-[#FF7900] rounded-full mx-auto my-4 sm:my-5" />

        {/* Descripción de alcance y satélites */}
        <div className="text-slate-600 text-sm sm:text-base md:text-lg leading-relaxed space-y-0.5 max-w-xl mx-auto font-normal px-4">
          <p>Análisis de la actividad de quema a escala mundial (2005–2025)</p>
          <p>con datos satelitales MODIS y VIIRS.</p>
        </div>

        {/* Botones de Acción Principales */}
        <div className="flex flex-wrap items-center justify-center gap-3.5 sm:gap-4 pt-6 sm:pt-7">
          <Link
            to="/simulador"
            className={`inline-flex items-center gap-2.5 px-6 sm:px-8 py-3 sm:py-3.5 bg-gradient-to-r from-[#FF7900] to-[#FF5500] hover:from-[#E66D00] hover:to-[#E04800] text-white font-bold rounded-full shadow-lg shadow-[#FF7900]/25 ${PRIMARY_BUTTON_FX} text-sm sm:text-base group`}
          >
            <Wind className="w-4 h-4 sm:w-4.5 sm:h-4.5 transition-transform group-hover:rotate-45" />
            <span>Simulador Táctico FireCast</span>
          </Link>

          <Link
            to="/explorar"
            className={`inline-flex items-center gap-2.5 px-6 sm:px-8 py-3 sm:py-3.5 bg-[#0B1B3D] hover:bg-[#132A5C] text-white font-bold rounded-full shadow-lg ${PRIMARY_BUTTON_FX} text-sm sm:text-base group`}
          >
            <BarChartFilled className="w-4 h-4 sm:w-4.5 sm:h-4.5 transition-transform group-hover:scale-110" />
            <span>Explorar Dashboard</span>
          </Link>

          <Link
            to="/equipo"
            className={`inline-flex items-center gap-2.5 px-6 sm:px-8 py-3 sm:py-3.5 bg-white text-[#0B1B3D] font-bold rounded-full border border-slate-200 shadow-2xs ${SECONDARY_BUTTON_FX} text-sm sm:text-base`}
          >
            <Users className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-[#0B1B3D]" />
            <span>Acerca de nosotros</span>
          </Link>
        </div>
      </div>

      {/* Gráfico Curvo del Planeta Tierra con Ecuador iluminado en el horizonte */}
      <div className="w-full relative mt-auto flex justify-center items-end overflow-hidden pointer-events-none select-none">
        <div ref={earthRef} className="w-full -mb-2 flex justify-center will-change-transform">
          {/* PNG con fondo transparente; se recorta el margen vacío superior (aspect 4/1, anclada abajo) */}
          <img
            src="/Landing_planeta.PNG"
            alt="Ecuador iluminado desde el espacio con actividad satelital de quemas"
            className="w-full max-w-[1400px] 2xl:max-w-[1700px] aspect-[4/1] object-cover object-bottom pointer-events-none"
          />
        </div>
      </div>
    </div>
  )
}
