import React from 'react'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return {
    ...actual,
    IS_MOCK_MODE: true,
  }
})

import { MockBanner } from '../components/MockBanner'
import { Navbar } from '../components/Navbar'
import { Sidebar } from '../components/Sidebar'
import { ErrorMessage } from '../components/ErrorMessage'
import { KpiCards } from '../components/KpiCards'
import type { CurrentStatusResponse, SeasonResponse } from '../types'

describe('Componentes UI de BRASA', () => {
  it('renderiza el banner de datos simulados', () => {
    render(<MockBanner />)
    expect(screen.getByText(/Datos simulados de demostración/i)).toBeInTheDocument()
  })

  it('renderiza la barra de navegación con enlaces a todas las secciones', () => {
    render(
      <MemoryRouter>
        <Navbar />
        <Sidebar />
      </MemoryRouter>
    )
    expect(screen.getByAltText(/BRASA Logo/i)).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Inicio/i })[0]).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Explorar/i })[0]).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Análisis histórico/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Alertas/i })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Acerca de nosotros/i })[0]).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Metodología/i })[0]).toBeInTheDocument()
  })

  it('no muestra los enlaces de navegación superior en páginas interiores', () => {
    render(
      <MemoryRouter initialEntries={['/explorar']}>
        <Navbar />
      </MemoryRouter>
    )
    expect(screen.getByText(/MODIS & VIIRS/i)).toBeInTheDocument()
    // Los enlaces del menú superior de inicio no deben existir en el navbar en páginas interiores
    expect(screen.queryByRole('link', { name: /^Metodología$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^Acerca de nosotros$/i })).not.toBeInTheDocument()
  })

  it('renderiza mensaje de error con botón de reintento', () => {
    let retried = false
    render(
      <ErrorMessage
        message="Fallo al obtener satélites"
        onRetry={() => {
          retried = true
        }}
      />
    )
    expect(screen.getByText('Fallo al obtener satélites')).toBeInTheDocument()
    const retryBtn = screen.getByRole('button', { name: /Reintentar/i })
    expect(retryBtn).toBeInTheDocument()
    retryBtn.click()
    expect(retried).toBe(true)
  })

  it('renderiza los 4 indicadores KPI', () => {
    const mockSeason: SeasonResponse = {
      years: [
        {
          year: 2024,
          start_week: 28,
          peak_week: 36,
          end_week: 42,
          total: 1850,
        },
        {
          year: 2012,
          start_week: 29,
          peak_week: 35,
          end_week: 43,
          total: 1620,
        },
      ],
    }

    const mockStatus: CurrentStatusResponse = {
      week: 36,
      value: 145.5,
      percentile: 94.2,
      zscore: 2.85,
      level: 'inusual',
    }

    render(
      <MemoryRouter>
        <KpiCards
          season={mockSeason}
          currentStatus={mockStatus}
          selectedYear={2024}
          isLoading={false}
        />
      </MemoryRouter>
    )

    expect(screen.getByText(/Actividad total 2024/i)).toBeInTheDocument()
    expect(screen.getByText(/Mes más activo/i)).toBeInTheDocument()
    expect(screen.getByText(/Periodos inusuales 2024/i)).toBeInTheDocument()
    expect(screen.getByText(/Estado de esta semana/i)).toBeInTheDocument()
    expect(screen.getByText(/^Inusual$/i)).toBeInTheDocument()
  })
})
