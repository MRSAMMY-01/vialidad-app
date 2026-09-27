import L from 'leaflet';
import type { EventType } from '@/data/mockEvents';

export interface MarkerIconOptions {
  isNew?: boolean;
  isCriticalActive?: boolean;
}

/**
 * Returns clean SVG string for event type with customizable color and size.
 */
export function getTipoIconSvg(tipo?: EventType, strokeColor = 'currentColor', size = 13): string {
  if (tipo === 'peligro_via') {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${strokeColor}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
        <line x1="12" y1="9" x2="12" y2="13"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    `;
  } else if (tipo === 'corte_calle') {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${strokeColor}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <path d="m4.9 4.9 14.2 14.2"/>
      </svg>
    `;
  } else if (tipo === 'otro') {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${strokeColor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
    `;
  } else {
    // bache / default
    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${strokeColor}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="7"/>
        <circle cx="12" cy="12" r="2.5" fill="${strokeColor}"/>
      </svg>
    `;
  }
}

/**
 * Short label for compact zoom-in map bubbles.
 */
export function getTipoShortLabel(tipo?: EventType): string {
  switch (tipo) {
    case 'bache':
      return 'Bache';
    case 'corte_calle':
      return 'Obstrucción';
    case 'peligro_via':
      return 'Peligro';
    case 'otro':
    default:
      return 'Reporte';
  }
}

/**
 * Classic pin marker used at standard zoom levels (< 15.5) or in clusters.
 */
export function createSeverityIcon(
  color: string,
  tipo?: EventType,
  options?: MarkerIconOptions
): L.DivIcon {
  const innerSvg = tipo && tipo !== 'bache' ? getTipoIconSvg(tipo, 'white', 13) : null;
  const innerHtml = innerSvg
    ? `<div class="severity-pin-icon" style="transform: rotate(45deg); display: flex; align-items: center; justify-content: center; color: white;">${innerSvg}</div>`
    : '<div class="severity-pin-dot"></div>';

  const animClasses = [
    'severity-pin-wrapper',
    options?.isNew ? 'marker-pop-in' : '',
    options?.isCriticalActive ? 'marker-critical-pulse' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return L.divIcon({
    className: 'custom-severity-icon',
    html: `
      <div class="${animClasses}">
        <div class="severity-pin" style="background:${color}">${innerHtml}</div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  });
}

/**
 * Compact white bubble with text and downward pointing triangle,
 * displayed when zooming close (>= 15.5).
 */
export function createBubbleIcon(
  color: string,
  tipo?: EventType,
  options?: MarkerIconOptions
): L.DivIcon {
  const label = getTipoShortLabel(tipo);
  const iconSvg = getTipoIconSvg(tipo, color, 14);

  const animClasses = [
    'map-bubble-wrapper',
    options?.isNew ? 'marker-pop-in' : '',
    options?.isCriticalActive ? 'marker-critical-pulse' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const html = `
    <div class="${animClasses}">
      <div class="map-bubble-body" style="border-color: ${color};">
        <span class="map-bubble-icon" style="color: ${color};">${iconSvg}</span>
        <span class="map-bubble-text">${label}</span>
      </div>
      <div class="map-bubble-triangle" style="border-top-color: ${color};"></div>
    </div>
  `;

  return L.divIcon({
    className: 'custom-map-bubble-icon',
    html,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    popupAnchor: [0, -32],
  });
}

export function createGpsIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:24px;height:24px;">
        <div class="pulse-ring" style="position:absolute;inset:0;border-radius:50%;background:#2563eb;opacity:0.4;"></div>
        <div style="position:absolute;inset:4px;border-radius:50%;background:#2563eb;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}
