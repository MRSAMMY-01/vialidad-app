import L from 'leaflet';
import type { EventType } from '@/data/mockEvents';

export function createSeverityIcon(color: string, tipo?: EventType): L.DivIcon {
  let innerHtml = '<div class="severity-pin-dot"></div>';

  if (tipo === 'peligro_via') {
    innerHtml = `
      <div class="severity-pin-icon" style="transform: rotate(45deg); display: flex; align-items: center; justify-content: center; color: white;">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </div>
    `;
  } else if (tipo === 'corte_calle') {
    innerHtml = `
      <div class="severity-pin-icon" style="transform: rotate(45deg); display: flex; align-items: center; justify-content: center; color: white;">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="m4.9 4.9 14.2 14.2"/>
        </svg>
      </div>
    `;
  } else if (tipo === 'otro') {
    innerHtml = `
      <div class="severity-pin-icon" style="transform: rotate(45deg); display: flex; align-items: center; justify-content: center; color: white;">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </div>
    `;
  } else {
    innerHtml = '<div class="severity-pin-dot"></div>';
  }

  return L.divIcon({
    className: '',
    html: `<div class="severity-pin" style="background:${color}">${innerHtml}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
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
