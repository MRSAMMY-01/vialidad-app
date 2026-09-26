import { useEffect, useState, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import { Locate, Loader2 } from 'lucide-react';
import type { ReportEvent, Severity } from '@/data/mockEvents';
import { mockGpsLocation, severityConfig } from '@/data/mockEvents';
import { createSeverityIcon, createGpsIcon } from '@/utils/mapIcons';
import {
  NUBLE_MAP_BOUNDS,
  isWithinNubleBounds,
  OUT_OF_BOUNDS_MESSAGE,
} from '@/utils/geoBounds';

interface MapViewProps {
  events: ReportEvent[];
  onSelect: (event: ReportEvent) => void;
  newReportLocation: { lat: number; lng: number } | null;
  userLocation?: { lat: number; lng: number } | null;
  selectedSeverity?: Severity | 'todos';
  onSelectSeverity?: (severity: Severity | 'todos') => void;
  severityCounts?: {
    todos: number;
    critico: number;
    moderado: number;
    leve: number;
  };
}

/**
 * Component that renders an 80m semi-transparent red danger zone circle
 * around critical events when zoom level is close enough to see individual pins.
 */
function CriticalEventCircles({ events }: { events: ReportEvent[] }) {
  const [zoom, setZoom] = useState(14);
  const map = useMapEvents({
    zoomend: () => {
      setZoom(map.getZoom());
    },
  });

  useEffect(() => {
    if (map) {
      setZoom(map.getZoom());
    }
  }, [map]);

  // Zoom threshold: only show when zoomed in enough to view individual markers
  if (zoom < 15.5) {
    return null;
  }

  const criticalEvents = events.filter((e) => e.severity === 'critico' && e.estado !== 'resuelto');

  return (
    <>
      {criticalEvents.map((event) => (
        <Circle
          key={`critical-zone-${event.id}`}
          center={[event.lat, event.lng]}
          radius={80}
          pathOptions={{
            color: '#dc2626',
            fillColor: '#dc2626',
            fillOpacity: 0.15,
            weight: 1.5,
            opacity: 0.7,
          }}
        />
      ))}
    </>
  );
}

/**
 * Sub-component that registers markers in a MarkerClusterGroup.
 */
function MarkerClusterGroup({
  events,
  onSelect,
}: {
  events: ReportEvent[];
  onSelect: (event: ReportEvent) => void;
}) {
  const map = useMap();
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);

  useEffect(() => {
    if (!map) return;

    const clusterGroup = L.markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 40,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        const childMarkers = cluster.getAllChildMarkers();

        let hasCritical = false;
        let hasModerate = false;
        let allResolved = true;

        for (const m of childMarkers) {
          const markerData = m as unknown as { severity?: Severity; estado?: string };
          if (markerData.estado === 'activo') {
            allResolved = false;
            if (markerData.severity === 'critico') {
              hasCritical = true;
              break;
            }
            if (markerData.severity === 'moderado') {
              hasModerate = true;
            }
          } else if (markerData.estado === 'intervencion_parcial') {
            allResolved = false;
            hasModerate = true;
          }
        }

        let severityClass = 'cluster-leve';
        if (hasCritical) {
          severityClass = 'cluster-critico';
        } else if (hasModerate) {
          severityClass = 'cluster-moderado';
        } else if (allResolved && childMarkers.length > 0) {
          severityClass = 'cluster-resuelto';
        }

        return L.divIcon({
          html: `<div class="cluster-bubble ${severityClass}"><span>${count}</span></div>`,
          className: 'custom-cluster-icon',
          iconSize: L.point(36, 36, true),
        });
      },
    });

    events.forEach((event) => {
      const lat = Number(event.lat);
      const lng = Number(event.lng);
      if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return;

      const isResolved = event.estado === 'resuelto';
      const isPartial = event.estado === 'intervencion_parcial';

      const pinColor = isResolved
        ? '#9ca3af'
        : isPartial
          ? '#d97706'
          : severityConfig[event.severity as Severity]?.color || '#f59e0b';

      const marker = L.marker([lat, lng], {
        icon: createSeverityIcon(pinColor, event.tipo),
        opacity: isResolved ? 0.75 : 1,
      });
      (marker as unknown as { severity: Severity; estado: string; eventId: string }).severity = event.severity;
      (marker as unknown as { severity: Severity; estado: string; eventId: string }).estado = event.estado;
      (marker as unknown as { severity: Severity; estado: string; eventId: string }).eventId = event.id;
      marker.on('click', () => onSelect(event));
      clusterGroup.addLayer(marker);
    });

    map.addLayer(clusterGroup);
    clusterGroupRef.current = clusterGroup;

    return () => {
      if (clusterGroupRef.current) {
        map.removeLayer(clusterGroupRef.current);
      }
    };
  }, [events, map, onSelect]);

  return null;
}

/**
 * Controller to handle programmatic map movements (recenter, initial GPS fix, new report focus).
 */
function MapController({
  targetLocation,
  newReportLocation,
}: {
  targetLocation: { lat: number; lng: number; zoom?: number; timestamp: number } | null;
  newReportLocation: { lat: number; lng: number } | null;
}) {
  const map = useMap();

  // Invalidate map size on mount and window resize / orientation change to prevent grey tiles on mobile
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);

    const handleResize = () => {
      map.invalidateSize();
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [map]);

  useEffect(() => {
    if (targetLocation) {
      map.flyTo([targetLocation.lat, targetLocation.lng], targetLocation.zoom ?? 15, {
        duration: 1,
      });
    }
  }, [targetLocation, map]);

  useEffect(() => {
    if (newReportLocation) {
      map.flyTo([newReportLocation.lat, newReportLocation.lng], 16, {
        duration: 0.8,
      });
    }
  }, [newReportLocation, map]);

  return null;
}

/**
 * Listener to detect when user reaches the Ñuble bounds and notify discreetly
 */
function NubleBoundsListener({ onOutOfBounds }: { onOutOfBounds: () => void }) {
  const map = useMap();
  const lastNoticeRef = useRef(0);

  useMapEvents({
    drag: () => {
      const center = map.getCenter();
      if (!isWithinNubleBounds(center.lat, center.lng)) {
        const now = Date.now();
        if (now - lastNoticeRef.current > 4000) {
          lastNoticeRef.current = now;
          onOutOfBounds();
        }
      }
    },
  });

  return null;
}

function parseEventDate(dateStr?: string): number | null {
  if (!dateStr) return null;
  // If YYYY-MM-DD
  const ymdMatch = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    return new Date(year, month, day, 12, 0, 0).getTime();
  }
  const timestamp = new Date(dateStr).getTime();
  return isNaN(timestamp) ? null : timestamp;
}

function formatRelativeTime(dateStr?: string, createdAt?: string): string {
  const timestamp = parseEventDate(createdAt) ?? parseEventDate(dateStr);
  if (!timestamp) return 'Reciente';

  const now = Date.now();
  const diffMs = now - timestamp;

  if (diffMs < 0) return 'Hoy';

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // If createdAt has precise time and it's within 24 hours
  if (createdAt && diffDays === 0) {
    if (diffMinutes < 5) return 'Hace un momento';
    if (diffMinutes < 60) return `Hace ${diffMinutes} min`;
    if (diffHours < 24) return `Hace ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
    return 'Hoy';
  }

  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Hace 1 día';
  if (diffDays < 7) return `Hace ${diffDays} días`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `Hace ${weeks} ${weeks === 1 ? 'semana' : 'semanas'}`;
  }
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `Hace ${months} ${months === 1 ? 'mes' : 'meses'}`;
  }
  const years = Math.floor(diffDays / 365);
  return `Hace ${years} ${years === 1 ? 'año' : 'años'}`;
}

export default function MapView({
  events,
  onSelect,
  newReportLocation,
  userLocation: propUserLocation,
  selectedSeverity = 'todos',
  onSelectSeverity,
  severityCounts,
}: MapViewProps) {
  const [internalUserLocation, setInternalUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [showBoundsNotice, setShowBoundsNotice] = useState(false);
  const [isReportListOpen, setIsReportListOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const [targetLocation, setTargetLocation] = useState<{
    lat: number;
    lng: number;
    zoom?: number;
    timestamp: number;
  } | null>(null);

  const hasInitiallyCenteredRef = useRef(false);
  const boundsTimerRef = useRef<NodeJS.Timeout | null>(null);

  const activeUserLocation = propUserLocation ?? internalUserLocation;

  // Close filter menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) {
        setIsFilterOpen(false);
      }
    };

    if (isFilterOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isFilterOpen]);

  const handleOutOfBounds = useCallback(() => {
    setShowBoundsNotice(true);
    if (boundsTimerRef.current) clearTimeout(boundsTimerRef.current);
    boundsTimerRef.current = setTimeout(() => {
      setShowBoundsNotice(false);
    }, 3500);
  }, []);

  // Initial Geolocation lookup on mount: Auto-center ONLY ONCE on first fix
  useEffect(() => {
    if (propUserLocation && !hasInitiallyCenteredRef.current) {
      hasInitiallyCenteredRef.current = true;
      if (isWithinNubleBounds(propUserLocation.lat, propUserLocation.lng)) {
        setTargetLocation({ ...propUserLocation, zoom: 15, timestamp: Date.now() });
      } else {
        setTargetLocation({ ...mockGpsLocation, zoom: 14, timestamp: Date.now() });
      }
      return;
    }

    if (!propUserLocation && !hasInitiallyCenteredRef.current && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          if (isWithinNubleBounds(lat, lng)) {
            const coords = { lat, lng };
            setInternalUserLocation(coords);
            if (!hasInitiallyCenteredRef.current) {
              hasInitiallyCenteredRef.current = true;
              setTargetLocation({ ...coords, zoom: 15, timestamp: Date.now() });
            }
          } else {
            // User is outside Ñuble: center on default Chillán reference without error
            if (!hasInitiallyCenteredRef.current) {
              hasInitiallyCenteredRef.current = true;
              setTargetLocation({ ...mockGpsLocation, zoom: 14, timestamp: Date.now() });
            }
          }
          setIsLocating(false);
        },
        () => {
          setInternalUserLocation(null);
          setIsLocating(false);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
      );
    }
  }, [propUserLocation]);

  // Recenter ONLY when user clicks the "Centrar en mi ubicación" button
  const handleRecenter = useCallback(() => {
    setIsLocating(true);

    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          if (!isWithinNubleBounds(lat, lng)) {
            handleOutOfBounds();
            const fallback = activeUserLocation ?? mockGpsLocation;
            setTargetLocation({ ...fallback, zoom: 15, timestamp: Date.now() });
            setIsLocating(false);
            return;
          }
          const coords = { lat, lng };
          setInternalUserLocation(coords);
          setTargetLocation({ ...coords, zoom: 16, timestamp: Date.now() });
          setIsLocating(false);
        },
        () => {
          // Fallback: if existing activeUserLocation or Chillán center
          const fallback = activeUserLocation ?? mockGpsLocation;
          setTargetLocation({ ...fallback, zoom: 15, timestamp: Date.now() });
          setIsLocating(false);
        },
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 10000 }
      );
    } else {
      const fallback = activeUserLocation ?? mockGpsLocation;
      setTargetLocation({ ...fallback, zoom: 15, timestamp: Date.now() });
      setIsLocating(false);
    }
  }, [activeUserLocation, handleOutOfBounds]);

  // Card click: close list, fly to position, and open detail modal
  const handleCardClick = (event: ReportEvent) => {
    setIsReportListOpen(false);
    setTargetLocation({ lat: event.lat, lng: event.lng, zoom: 17, timestamp: Date.now() });
    setTimeout(() => {
      onSelect(event);
    }, 350);
  };

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={[mockGpsLocation.lat, mockGpsLocation.lng]}
        zoom={14}
        minZoom={9}
        maxBounds={NUBLE_MAP_BOUNDS}
        maxBoundsViscosity={1.0}
        zoomControl={false}
        touchZoom={true}
        doubleClickZoom={true}
        scrollWheelZoom={true}
        className="absolute inset-0 h-full w-full"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors'
        />

        <MapController
          targetLocation={targetLocation}
          newReportLocation={newReportLocation}
        />

        <NubleBoundsListener onOutOfBounds={handleOutOfBounds} />

        {/* 80m Danger radius circles around critical events (visible at close zoom) */}
        <CriticalEventCircles events={events} />

        <MarkerClusterGroup events={events} onSelect={onSelect} />

        {/* User Location Marker (moves dynamically without moving camera) */}
        {activeUserLocation && (
          <Marker
            position={[activeUserLocation.lat, activeUserLocation.lng]}
            icon={createGpsIcon()}
          />
        )}

        {/* New Report Location Marker */}
        {newReportLocation && (
          <Marker
            position={[newReportLocation.lat, newReportLocation.lng]}
            icon={createGpsIcon()}
          />
        )}
      </MapContainer>

      {/* Discrete Notification when hitting Ñuble bounds */}
      {showBoundsNotice && (
        <div className="absolute top-20 left-1/2 z-[1100] -translate-x-1/2 animate-slide-down w-[90%] max-w-sm pointer-events-none">
          <div className="flex items-center justify-center gap-2 rounded-2xl bg-gray-900/95 px-4 py-2.5 text-center text-xs font-medium text-white shadow-2xl backdrop-blur-md border border-gray-700">
            <span>{OUT_OF_BOUNDS_MESSAGE}</span>
          </div>
        </div>
      )}

      {/* Top Left Widget: "🟢 {N} Reportes" (Opens Bottom Sheet) */}
      <div className="absolute top-4 left-4 z-[1000] pointer-events-auto">
        <button
          type="button"
          onClick={() => setIsReportListOpen(true)}
          className="flex items-center gap-2 rounded-full bg-white/95 px-4 py-2.5 text-xs sm:text-sm font-bold text-gray-900 shadow-md backdrop-blur-md border border-gray-100/80 hover:bg-gray-50 active:scale-95 transition-all cursor-pointer"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 ring-2 ring-emerald-200"></span>
          </span>
          <span>{severityCounts?.todos ?? events.length} Reportes</span>
        </button>
      </div>

      {/* Top Right Widget: "🚦 Semáforo" (Filter Menu) */}
      <div ref={filterMenuRef} className="absolute top-4 right-4 z-[1000] pointer-events-auto">
        {/* Toggle Button */}
        <button
          type="button"
          onClick={() => setIsFilterOpen(!isFilterOpen)}
          className="flex items-center gap-1.5 rounded-full bg-white/95 px-4 py-2.5 text-xs sm:text-sm font-bold text-gray-900 shadow-md backdrop-blur-md border border-gray-100/80 hover:bg-gray-50 active:scale-95 transition-all cursor-pointer"
        >
          <span>
            🚦{' '}
            {selectedSeverity === 'critico'
              ? 'Altos'
              : selectedSeverity === 'moderado'
                ? 'Medios'
                : selectedSeverity === 'leve'
                  ? 'Leves'
                  : 'Todos'}
          </span>
          <span className={`text-[10px] text-gray-500 transition-transform duration-200 ${isFilterOpen ? 'rotate-180' : ''}`}>▾</span>
        </button>

        {/* Floating Filter Menu Pop-in */}
        {isFilterOpen && (
          <div className="absolute top-12 right-0 mt-1 min-w-[155px] rounded-2xl bg-white/95 p-1.5 shadow-xl backdrop-blur-md border border-gray-100 flex flex-col gap-1 animate-scale-in">
            <button
              type="button"
              onClick={() => {
                onSelectSeverity?.('critico');
                setIsFilterOpen(false);
              }}
              className={`flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition text-left ${
                selectedSeverity === 'critico'
                  ? 'bg-red-50 text-red-700 ring-1 ring-red-200'
                  : 'text-gray-700 hover:bg-gray-100/80'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-red-200 shrink-0" />
                <span>Altos</span>
              </div>
              <span className="text-[11px] font-mono opacity-75">({severityCounts?.critico ?? 0})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onSelectSeverity?.('moderado');
                setIsFilterOpen(false);
              }}
              className={`flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition text-left ${
                selectedSeverity === 'moderado'
                  ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                  : 'text-gray-700 hover:bg-gray-100/80'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-amber-200 shrink-0" />
                <span>Medios</span>
              </div>
              <span className="text-[11px] font-mono opacity-75">({severityCounts?.moderado ?? 0})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onSelectSeverity?.('leve');
                setIsFilterOpen(false);
              }}
              className={`flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition text-left ${
                selectedSeverity === 'leve'
                  ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                  : 'text-gray-700 hover:bg-gray-100/80'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-200 shrink-0" />
                <span>Leves</span>
              </div>
              <span className="text-[11px] font-mono opacity-75">({severityCounts?.leve ?? 0})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onSelectSeverity?.('todos');
                setIsFilterOpen(false);
              }}
              className={`flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition text-left ${
                selectedSeverity === 'todos'
                  ? 'bg-gray-100 text-gray-900 font-bold'
                  : 'text-gray-600 hover:bg-gray-100/80'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-300 shrink-0" />
                <span>Todos</span>
              </div>
              <span className="text-[11px] font-mono opacity-75">({severityCounts?.todos ?? 0})</span>
            </button>
          </div>
        )}
      </div>

      {/* Bottom Sheet: Lista de Reportes (Tarjetas) */}
      {isReportListOpen && (
        <>
          {/* Backdrop Overlay */}
          <div
            className="fixed inset-0 z-[1500] bg-black/40 backdrop-blur-xs transition-opacity animate-fade-in"
            onClick={() => setIsReportListOpen(false)}
          />

          {/* Sliding Bottom Sheet */}
          <div
            className="fixed bottom-0 left-0 right-0 z-[1501] max-w-lg mx-auto w-full rounded-t-3xl bg-white p-5 shadow-2xl animate-slide-up max-h-[72vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag Handle */}
            <div className="w-10 h-1.5 bg-gray-300 rounded-full mx-auto -mt-1 mb-3" />

            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <h2 className="text-base font-extrabold text-gray-900">Reportes activos</h2>
                <p className="text-[11px] text-gray-500 font-medium">Selecciona un reporte para ver su ubicación y detalle</p>
              </div>
              <button
                type="button"
                onClick={() => setIsReportListOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition font-bold"
              >
                ✕
              </button>
            </div>

            {/* Report Cards List */}
            <div className="mt-3.5 overflow-y-auto space-y-2.5 flex-1 overscroll-contain pr-0.5 pb-2">
              {events.length === 0 ? (
                <div className="py-12 text-center text-xs text-gray-500">
                  No hay reportes disponibles en este momento.
                </div>
              ) : (
                events.map((ev) => {
                  const isCritico = ev.severity === 'critico';
                  const isModerado = ev.severity === 'moderado';

                  return (
                    <div
                      key={`card-${ev.id}`}
                      onClick={() => handleCardClick(ev)}
                      className="flex items-start gap-3 rounded-2xl bg-gray-50/90 hover:bg-gray-100/80 border border-gray-200/80 p-3.5 transition active:scale-[0.98] cursor-pointer shadow-xs"
                    >
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-lg ${
                          isCritico
                            ? 'bg-red-50 border border-red-200 text-red-600'
                            : isModerado
                              ? 'bg-amber-50 border border-amber-200 text-amber-600'
                              : 'bg-emerald-50 border border-emerald-200 text-emerald-600'
                        }`}
                      >
                        {isCritico ? '⚠️' : isModerado ? '🚧' : '📍'}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-sm font-bold text-gray-900 truncate">
                            {ev.title}{' '}
                            <span className="text-[11px] font-semibold text-gray-500 font-normal">
                              ({isCritico ? 'Crítico' : isModerado ? 'Moderado' : 'Leve'})
                            </span>
                          </p>
                        </div>
                        <p className="text-xs text-gray-600 truncate mt-0.5">
                          📍 {ev.description || ev.title}
                        </p>
                        <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wider text-blue-600">
                          {formatRelativeTime(ev.date, ev.createdAt)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}

      {/* Floating Recenter / Geolocation Button */}
      <button
        type="button"
        onClick={handleRecenter}
        disabled={isLocating}
        title="Centrar en mi ubicación"
        aria-label="Centrar en mi ubicación"
        className="absolute bottom-24 right-5 z-[1000] flex h-11 w-11 items-center justify-center rounded-full bg-white text-gray-700 shadow-xl border border-gray-100 backdrop-blur-sm transition-all hover:bg-gray-50 hover:text-blue-600 active:scale-95 disabled:opacity-75"
      >
        {isLocating ? (
          <Loader2 size={20} className="animate-spin text-blue-600" />
        ) : (
          <Locate size={20} className="text-gray-700" />
        )}
      </button>
    </div>
  );
}
