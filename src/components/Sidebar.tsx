import React from 'react'
import { NavLink } from 'react-router-dom'
import { NAV_ITEMS } from '../utils/navItems'

export const Sidebar: React.FC = () => {
  return (
    <aside className="w-56 bg-[#071C3A] text-slate-300 sticky top-[72px] h-[calc(100vh-72px)] self-start flex flex-col py-6 px-3 shrink-0 hidden lg:flex overflow-y-auto z-30">
      <nav className="space-y-1 flex-1" aria-label="Navegación lateral">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-colors ${
                  isActive ? 'bg-white/10 text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-[#FF7900]' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

      <div className="pt-6 border-t border-white/10 px-3 text-xs text-slate-400">
        <p className="font-bold text-white">Equipo CODE RED</p>
        <p className="mt-0.5">NASA Space Apps 2026</p>
      </div>
    </aside>
  )
}
