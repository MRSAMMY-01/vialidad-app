import type { LatLngBoundsExpression } from 'leaflet';

/**
 * Geographic limits for Región de Ñuble (Chile)
 * Latitud: entre -37.05 y -35.95
 * Longitud: entre -72.65 y -71.30
 *
 * Cubre desde Cobquecura/Quirihue al oeste hasta San Fabián al oriente,
 * y desde el límite con Biobío al sur hasta el límite con Maule al norte.
 */
export const NUBLE_BOUNDS = {
  minLat: -37.05,
  maxLat: -35.95,
  minLng: -72.65,
  maxLng: -71.30,
} as const;

export const OUT_OF_BOUNDS_MESSAGE =
  'Por ahora Reporte Vial solo cubre la Región de Ñuble. ¡Próximamente más regiones!';

/**
 * Leaflet LatLngBoundsExpression representation for maxBounds
 * [[South-West], [North-East]] -> [[minLat, minLng], [maxLat, maxLng]]
 */
export const NUBLE_MAP_BOUNDS: LatLngBoundsExpression = [
  [NUBLE_BOUNDS.minLat, NUBLE_BOUNDS.minLng],
  [NUBLE_BOUNDS.maxLat, NUBLE_BOUNDS.maxLng],
];

/**
 * Nominatim viewbox parameter format: <left>,<top>,<right>,<bottom>
 * Corresponding to <minLng>,<maxLat>,<maxLng>,<minLat>
 */
export const NUBLE_NOMINATIM_VIEWBOX = `${NUBLE_BOUNDS.minLng},${NUBLE_BOUNDS.maxLat},${NUBLE_BOUNDS.maxLng},${NUBLE_BOUNDS.minLat}`;

/**
 * Valida si un par de coordenadas (lat, lng) cae dentro de la Región de Ñuble.
 */
export function isWithinNubleBounds(lat: number, lng: number): boolean {
  if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
    return false;
  }
  return (
    lat >= NUBLE_BOUNDS.minLat &&
    lat <= NUBLE_BOUNDS.maxLat &&
    lng >= NUBLE_BOUNDS.minLng &&
    lng <= NUBLE_BOUNDS.maxLng
  );
}
