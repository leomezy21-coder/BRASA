import React, { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { MapPin, Satellite, Target } from 'lucide-react'
import { CursorGlow } from '../components/CursorGlow'
import { usePointerEffects } from '../hooks/usePointerEffects'
import { PRIMARY_BUTTON_FX } from '../utils/buttonFx'

/* Imagen del hero (planeta + satélite). Colócala en /public con este nombre. */
const HERO_IMAGE = '/hero-satellite.jpeg'

const RECOGNITIONS = [
  { name: 'Hult Prize On Campus', detail: 'ESPOCH' },
  { name: 'AIRON Tech Fest', detail: 'Podio · Innovación y tecnología' },
  { name: 'Hult Prize', detail: 'National Competition' },
  { name: 'NASA Space Apps', detail: 'Challenge 2025' },
]

const TEAM_TABS = [
  {
    title: 'Quiénes somos',
    body: 'Estudiantes de Ingeniería en Tecnologías de la Información de la Escuela Superior Politécnica de Chimborazo (ESPOCH).',
  },
  {
    title: 'Experiencia',
    body: 'Aplicaciones web y móviles, inteligencia artificial, cloud computing, ciberseguridad y gestión de TI en el sector público, con certificaciones nacionales e internacionales.',
  },
  {
    title: 'Liderazgo',
    body: 'Liderados por Luis Manzano, convertimos problemas complejos en soluciones funcionales, escalables y orientadas a resultados.',
  },
  {
    title: 'Misión',
    body: 'Transformar datos en inteligencia, inteligencia en decisiones y decisiones en acciones que protejan vidas y ecosistemas: de la reacción a la anticipación.',
  },
]

/* Acordeón minimalista: una pestaña abierta a la vez */
const TeamAccordion: React.FC = () => {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <div className="mt-3 border-t border-slate-100">
      {TEAM_TABS.map((tab, i) => {
        const isOpen = open === i
        return (
          <div key={tab.title} className="border-b border-slate-100">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="w-full flex items-center justify-between gap-4 py-4 text-left group"
            >
              <span
                className={`text-base sm:text-lg font-extrabold transition-colors ${isOpen ? 'text-[#FF7900]' : 'text-[#0B1B3D] group-hover:text-[#FF7900]'
                  }`}
              >
                {tab.title}
              </span>
              <span
                className={`relative w-4 h-4 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-45' : ''}`}
                aria-hidden="true"
              >
                <span className="absolute top-1/2 left-0 w-4 h-0.5 -translate-y-1/2 rounded-full bg-[#FF7900]" />
                <span className="absolute left-1/2 top-0 h-4 w-0.5 -translate-x-1/2 rounded-full bg-[#FF7900]" />
              </span>
            </button>
            <div
              className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                }`}
            >
              <p className="overflow-hidden text-slate-600 leading-relaxed">
                <span className="block pb-5 pr-8">{tab.body}</span>
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* Visual de respaldo si la imagen aún no existe en /public */
const FallbackVisual: React.FC = () => (
  <div className="absolute inset-0 bg-gradient-to-br from-[#0B2D5B] via-[#071D3B] to-[#040E20]">
    <div className="absolute -bottom-[45%] -right-[25%] w-[130%] aspect-square rounded-full shadow-[0_0_120px_30px_rgba(96,165,250,0.35)] bg-[radial-gradient(circle_at_35%_25%,#3B82F6_0%,#1E40AF_35%,#0B2D5B_70%)]">
      {[
        ['38%', '30%'],
        ['46%', '42%'],
        ['33%', '52%'],
      ].map(([top, left]) => (
        <span
          key={top + left}
          className="absolute w-3 h-3 rounded-full bg-[#FFB347] shadow-[0_0_18px_6px_rgba(255,121,0,0.85)]"
          style={{ top, left }}
        />
      ))}
    </div>
    <div className="absolute top-[14%] left-[22%] w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
      <Satellite className="w-7 h-7 text-white" />
    </div>
  </div>
)

export const AboutTeam: React.FC = () => {
  const [imageOk, setImageOk] = useState(true)
  const heroRef = useRef<HTMLElement>(null)
  const glowRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLDivElement>(null)

  usePointerEffects(heroRef, { glowRef, parallaxRef: imageRef, parallax: { x: 12, y: 10 } })

  return (
    <div className="bg-white text-[#0B1B3D] overflow-hidden">
      {/* ───────── HERO ───────── */}
      <section
        ref={heroRef}
        className="relative grid lg:grid-cols-[1fr_1.2fr] items-center gap-y-4 min-h-[calc(100vh-73px)]"
      >
        <CursorGlow ref={glowRef} />

        <div className="relative z-10 flex flex-col justify-center px-6 sm:px-10 lg:pl-12 xl:pl-24 lg:pr-10 py-14 lg:py-10">
          <span className="inline-flex w-fit items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#FDE8E8] text-[#E53935] text-xs font-bold tracking-wide">
            <span className="w-2 h-2 rounded-full bg-[#E53935] animate-pulse motion-reduce:animate-none" />
            Emergency Ops
          </span>

          <h1 className="mt-6 text-5xl sm:text-6xl xl:text-7xl font-black tracking-tight leading-[0.95]">
            Code <span className="text-[#E53935]">Red</span>
          </h1>

          <p className="mt-4 text-sm sm:text-base font-bold uppercase tracking-[0.2em] text-slate-400">
            Detect<span className="text-[#FF7900]">.</span> Predict<span className="text-[#FF7900]">.</span>{' '}
            Respond<span className="text-[#E53935]">.</span>
          </p>

          <p className="mt-6 max-w-lg text-base sm:text-lg text-slate-600 leading-relaxed">
            Estudiantes de Tecnologías de la Información de la{' '}
            <strong className="text-[#0B1B3D]">ESPOCH</strong> que construyen tecnología para{' '}
            <strong className="text-[#0B1B3D]">anticipar riesgos</strong> y{' '}
            <span className="font-bold text-[#FF7900]">optimizar la respuesta ante emergencias</span>.
          </p>

          <div className="flex flex-wrap items-center gap-3.5 sm:gap-4 pt-8">
            <Link
              to="/explorar"
              className={`inline-flex items-center gap-2.5 px-6 sm:px-8 py-3 sm:py-3.5 bg-gradient-to-r from-[#FF7900] to-[#FF5500] hover:from-[#E66D00] hover:to-[#E04800] text-white font-bold rounded-full shadow-lg shadow-[#FF7900]/25 ${PRIMARY_BUTTON_FX} text-sm sm:text-base group`}
            >
              <span>Ver nuestra solución</span>
            </Link>
          </div>
        </div>

        {/* Imagen con borde curvo (como la referencia) */}
        <div className="relative w-full aspect-[4/3] lg:max-h-[82vh] ml-auto overflow-hidden rounded-tl-[96px] sm:rounded-tl-[160px] lg:rounded-tl-[260px] rounded-bl-[32px] lg:rounded-bl-[56px] bg-[#071D3B] shadow-2xl shadow-[#0B1B3D]/20">
          {imageOk ? (
            /* Margen de 16px por lado para que el parallax nunca muestre bordes */
            <div ref={imageRef} className="absolute -inset-4 will-change-transform">
              <img
                src={HERO_IMAGE}
                alt="Satélite observando Ecuador desde el espacio"
                onError={() => setImageOk(false)}
                className="w-full h-full object-cover object-[50%_30%]"
              />
            </div>
          ) : (
            <FallbackVisual />
          )}
        </div>
      </section>

      {/* ───────── EL EQUIPO + TRAYECTORIA ───────── */}
      <section className="max-w-6xl mx-auto px-6 sm:px-10 py-20 sm:py-28">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#FF7900]">El equipo</p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-black tracking-tight leading-tight">
              Talento, experiencia competitiva y visión estratégica.
            </h2>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Sobre nosotros</p>
            <TeamAccordion />
          </div>
        </div>

        {/* Trayectoria horizontal */}
        <div className="mt-24 sm:mt-32">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Trayectoria</p>
          <ol className="relative mt-8 grid grid-cols-2 md:grid-cols-4 gap-y-10 gap-x-6">
            <span className="hidden md:block absolute top-[5px] left-0 right-0 h-0.5 bg-slate-100" aria-hidden="true" />
            {RECOGNITIONS.map((r) => (
              <li key={r.name + r.detail} className="relative pt-8 group">
                <span className="absolute top-0 left-0 w-3 h-3 rounded-full bg-white border-2 border-[#FF7900] group-hover:bg-[#FF7900] transition-colors" />
                <span className="block text-lg font-extrabold">{r.name}</span>
                <span className="block text-sm text-slate-500">{r.detail}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ───────── EL RETO ───────── */}
      <section className="relative bg-[#0B1B3D] text-white rounded-t-[48px] sm:rounded-t-[80px]">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-20 sm:py-28">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#FF7900]">El reto</p>
          <h2 className="mt-3 text-3xl sm:text-5xl font-black tracking-tight leading-tight">
            Más de dos décadas de focos de calor,
            <span className="text-[#FF7900]"> divididos entre sensores.</span>
          </h2>
          <div className="mt-8 grid md:grid-cols-2 gap-8 text-slate-300 leading-relaxed">
            <p>
              Entender cómo se distribuye la actividad de quema en el tiempo —incendios forestales y quemas
              agrícolas detectables por satélite— permite anticipar periodos críticos, orientar el monitoreo y
              mejorar la respuesta. Pero los registros de MODIS y VIIRS no pueden compararse directamente.
            </p>
            <p>
              El desafío: una aplicación web que armonice estos registros en un{' '}
              <strong className="text-white">calendario de actividad de quema</strong>, para que equipos de alerta
              temprana, científicos y gestores del territorio examinen patrones históricos, condiciones inusuales
              y periodos críticos en un área de interés.
            </p>
          </div>

          {/* Información del equipo */}
          <div className="mt-16 pt-8 border-t border-white/10 flex flex-col sm:flex-row gap-6 sm:gap-14 text-sm">
            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5 text-[#FF7900] shrink-0" />
              <div>
                <span className="block text-[11px] uppercase tracking-[0.18em] text-slate-400">Evento local</span>
                <span className="font-bold">Riobamba, Ecuador</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Target className="w-5 h-5 text-[#FF7900] shrink-0" />
              <div>
                <span className="block text-[11px] uppercase tracking-[0.18em] text-slate-400">Reto</span>
                <span className="font-bold">Armonización de puntos calientes MODIS y VIIRS</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
