import React from 'react'
import { Link } from 'react-router-dom'
import { PRIMARY_BUTTON_FX } from '../utils/buttonFx'

const STEPS = [
  {
    title: 'Fuentes satelitales',
    body: 'Focos de calor activos de NASA FIRMS: MODIS (Terra/Aqua, 1 km, desde 2001) y VIIRS (S-NPP/NOAA-20, 375 m, desde 2012).',
  },
  {
    title: 'fire_cell_days',
    body: 'Para cada semana se cuentan las combinaciones celda–día de una cuadrícula común con al menos un foco activo tipo=0 (vegetación). Así, la mayor resolución de VIIRS no multiplica artificialmente la actividad observada.',
  },
  {
    title: 'Integración multi-sensor y solapamiento',
    body: 'Para mitigar el salto instrumental entre MODIS (1 km) y VIIRS (375 m), BRASA unifica la presencia celda-día. El período de solapamiento (2012–2018) permite contrastar la sensibilidad de ambos sensores sin asumir equivalencia radiométrica directa.',
  },
  {
    title: 'Climatología y anomalías',
    body: 'Para cada semana ISO se calcula la media y los percentiles P10, P50 y P90 de 2001–2025. Una semana se compara con su propia historia mediante su percentil y su z-score.',
  },
]

const LEVELS = [
  { label: 'Normal', color: '#10B981', rule: 'z < 1.0σ y percentil < P70' },
  { label: 'Elevado', color: '#FF7900', rule: '1.0σ ≤ z < 2.0σ, o P70–P90' },
  { label: 'Inusual', color: '#E53935', rule: 'z ≥ 2.0σ o percentil ≥ P90' },
]

export const Metodologia: React.FC = () => {
  return (
    <div className="bg-white text-[#0B1B3D]">
      {/* Encabezado */}
      <section className="max-w-6xl mx-auto px-6 sm:px-10 pt-16 sm:pt-24 pb-16">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#FF7900]">Metodología</p>
        <h1 className="mt-4 max-w-3xl text-4xl sm:text-6xl font-black tracking-tight leading-[1.02]">
          De focos dispersos a una <span className="text-[#FF7900]">serie armonizada</span>.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-slate-600 leading-relaxed">
          Dos sensores, dos resoluciones y 25 años de datos, convertidos en un calendario de actividad de quema que se
          puede comparar semana a semana.
        </p>
      </section>

      {/* Pasos */}
      <section className="max-w-6xl mx-auto px-6 sm:px-10 pb-20 sm:pb-28">
        <ol className="grid md:grid-cols-2 gap-x-16 border-t border-slate-200/70">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-6 py-8 border-b border-slate-200/70">
              <span className="text-sm font-black text-[#FF7900] tabular-nums pt-1">{String(i + 1).padStart(2, '0')}</span>
              <div>
                <h2 className="text-xl font-black tracking-tight">{step.title}</h2>
                <p className="mt-2 text-slate-600 leading-relaxed">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Semáforo + limitaciones */}
      <section className="bg-[#0B1B3D] text-white rounded-t-[48px] sm:rounded-t-[80px]">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-20 sm:py-24 grid lg:grid-cols-2 gap-14 lg:gap-20">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#FF7900]">Semáforo</p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-black tracking-tight">Tres niveles, una regla clara.</h2>
            <ul className="mt-8 divide-y divide-white/10 border-y border-white/10">
              {LEVELS.map((l) => (
                <li key={l.label} className="flex items-center justify-between gap-4 py-4">
                  <span className="flex items-center gap-3 font-bold">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: l.color }} />
                    {l.label}
                  </span>
                  <span className="text-sm text-slate-300 text-right">{l.rule}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#FF7900]">Limitaciones</p>
            <ul className="mt-6 space-y-4 text-slate-300 leading-relaxed">
              <li>La nubosidad y los horarios de paso del satélite pueden ocultar focos activos.</li>
              <li>Un foco de calor no siempre es un incendio forestal descontrolado: incluye quemas agrícolas controladas.</li>
              <li>MODIS (1 km) y VIIRS (375 m) difieren en resolución instrumental; fire_cell_days reduce la disparidad, pero la serie pre-2012 y post-2012 debe interpretarse considerando el cambio de sensor.</li>
              <li>
                Los niveles son estadísticos orientativos y <strong className="text-white">no constituyen alertas oficiales</strong> ni sustituyen a las autoridades de emergencia.
              </li>
            </ul>
            <Link
              to="/explorar"
              className={`mt-10 inline-flex items-center gap-2.5 px-7 py-3.5 bg-gradient-to-r from-[#FF7900] to-[#FF5500] text-white font-bold rounded-full shadow-lg shadow-[#FF7900]/25 ${PRIMARY_BUTTON_FX} group`}
            >
              <span>Explorar los datos</span>
              <span className="text-lg leading-none transition-transform group-hover:translate-x-1">→</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
