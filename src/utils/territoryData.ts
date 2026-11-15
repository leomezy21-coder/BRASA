// Catálogo de Territorios Jerárquicos: País -> Ciudad / Cantón
// Para BRASA - NASA Space Apps Challenge 2026
import type { Canton, CountryItem, Region } from '../types'
import PAISES_177 from './paises177.json'
import WORLD_CITIES from './worldCities.json'
import COUNTRY_BOUNDARIES_DATA from './countryBoundaries.json'

// Catálogo completo de los 177 países del dataset espacial oficial
export const COUNTRIES: CountryItem[] = [...(PAISES_177 as CountryItem[])].sort((a, b) =>
  a.name.localeCompare(b.name, 'es')
)

// Catálogo de Continentes
export const CONTINENTS: string[] = [
  'América del Sur',
  'América Central',
  'América del Norte',
  'Europa',
  'Asia',
  'África',
  'Oceanía',
  'Antártida',
]

/**
 * Filtra los países por continente. Si no se especifica, entrega todos los 177 países.
 */
export function getCountriesForContinent(continent?: string): CountryItem[] {
  if (!continent || continent === '' || continent === 'all') {
    return COUNTRIES
  }
  return COUNTRIES.filter((c) => c.continent === continent)
}

/**
 * Obtiene todas las ciudades o cantones disponibles en un país.
 * Para Ecuador (ECU): entrega los 221 cantones oficiales del país.
 * Para los demás 176 países: entrega sus principales urbes y capitales regionales.
 */
export function getCitiesForCountry(countryCode: string): Canton[] {
  const code = (countryCode || 'ECU').toUpperCase()
  const list = (WORLD_CITIES as Record<string, Canton[]>)[code]
  if (list && list.length > 0) {
    return list
  }

  // Fallback a nivel de país
  const country = COUNTRIES.find((c) => c.code === code)
  if (!country) return []
  return [
    {
      id: `${code.toLowerCase()}_general`,
      name: country.name,
      lat: country.lat,
      lon: country.lon,
    },
  ]
}

/**
 * Obtiene la silueta GeoJSON oficial del país seleccionado para dibujarla en el mapa.
 * Soporta los 177 países de la cobertura espacial de BRASA.
 */
export function getCountrySilhouette(countryCode: string) {
  const code = (countryCode || 'ECU').toUpperCase()
  const geom = (COUNTRY_BOUNDARIES_DATA as Record<string, any>)[code]
  if (!geom) return null
  return {
    type: 'Feature',
    properties: { countryCode: code },
    geometry: geom,
  }
}

/**
 * Función de compatibilidad territorial
 */
export function getProvincesForCountry(countryCode: string): Region[] {
  const cities = getCitiesForCountry(countryCode)
  const country = COUNTRIES.find((c) => c.code === countryCode.toUpperCase())
  const center: [number, number] = country ? [country.lat, country.lon] : [-1.8312, -78.1834]

  return [
    {
      id: `${countryCode.toLowerCase()}_nacional`,
      name: country?.name || countryCode,
      center,
      zoom: country?.zoom || 6,
      cantons: cities,
    },
  ]
}

/**
 * Función de compatibilidad territorial
 */
export function getCantonsForProvince(countryCode: string, _provinceId: string): Canton[] {
  return getCitiesForCountry(countryCode)
}
