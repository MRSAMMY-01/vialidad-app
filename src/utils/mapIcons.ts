import L from 'leaflet';

export function createSeverityIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div class="severity-pin" style="background:${color}"><div class="severity-pin-dot"></div></div>`,
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
