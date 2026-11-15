import { Flame, Compass, GitCompare, AlertTriangle, BookOpen, Users, Wind, Brain } from 'lucide-react'

/* Navegación completa (menú móvil y sidebar comparten los mismos nombres) */
export const NAV_ITEMS = [
  { to: '/', label: 'Inicio', icon: Flame, end: true },
  { to: '/explorar', label: 'Explorar', icon: Compass },
  { to: '/prediccion', label: 'Predicción ML', icon: Brain },
  { to: '/simulador', label: 'Simulador Táctico', icon: Wind },
  { to: '/comparar', label: 'Análisis histórico', icon: GitCompare },
  { to: '/alertas', label: 'Alertas', icon: AlertTriangle },
  { to: '/metodologia', label: 'Metodología', icon: BookOpen },
  { to: '/equipo', label: 'Acerca de nosotros', icon: Users },
]
