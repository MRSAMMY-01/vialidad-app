import { useEffect, useState, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import { Locate, Loader2, ChevronDown } from 'lucide-react';
import type { ReportEvent, Severity } from '@/data/mockEvents';
import { mockGpsLocation, severityConfig } from '@/data/mockEvents';
import { createSeverityIcon, createGpsIcon } from '@/utils/mapIcons';

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
      const isResolved = event.estado === 'resuelto';
      const isPartial = event.estado === 'intervencion_parcial';

      const pinColor = isResolved
        ? '#9ca3af'
        : isPartial
          ? '#d97706'
          : severityConfig[event.severity as Severity].color;

      const marker = L.marker([event.lat, event.lng], {
        icon: createSeverityIcon(pinColor),
        opacity: isResolved ? 0.75 : 1,
      });
      (marker as unknown as { severity: Severity; estado: string }).severity = event.severity;
      (marker as unknown as { severity: Severity; estado: string }).estado = event.estado;
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

const NUBLE_BOUNDS: L.LatLngBoundsExpression = [
  [-37.25, -73.10], // South-West (Límite Región de Ñuble)
  [-35.95, -71.00], // North-East (Límite Región de Ñuble)
];

/**
 * Listener to detect when user reaches the Ñuble bounds and notify discreetly
 */
function NubleBoundsListener({ onOutOfBounds }: { onOutOfBounds: () => void }) {
  const map = useMap();
  const lastNoticeRef = useRef(0);

  useMapEvents({
    drag: () => {
      const center = map.getCenter();
      const nubleBounds = L.latLngBounds([[-37.25, -73.10], [-35.95, -71.00]]);
      if (!nubleBounds.contains(center)) {
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
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  const [targetLocation, setTargetLocation] = useState<{
    lat: number;
    lng: number;
    zoom?: number;
    timestamp: number;
  } | null>(null);

  const hasInitiallyCenteredRef = useRef(false);
  const boundsTimerRef = useRef<NodeJS.Timeout | null>(null);

  const activeUserLocation = propUserLocation ?? internalUserLocation;

  // Close filter dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target as Node)) {
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
      setTargetLocation({ ...propUserLocation, zoom: 15, timestamp: Date.now() });
      return;
    }

    if (!propUserLocation && !hasInitiallyCenteredRef.current && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setInternalUserLocation(coords);
          if (!hasInitiallyCenteredRef.current) {
            hasInitiallyCenteredRef.current = true;
            setTargetLocation({ ...coords, zoom: 15, timestamp: Date.now() });
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
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
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
  }, [activeUserLocation]);

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={[mockGpsLocation.lat, mockGpsLocation.lng]}
        zoom={14}
        minZoom={9}
        maxBounds={NUBLE_BOUNDS}
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
            <span>Por ahora solo cubrimos la Región de Ñuble — próximamente más regiones</span>
          </div>
        </div>
      )}

      {/* Collapsible Severity Filter Pill & Dropdown */}
      <div ref={filterDropdownRef} className="absolute top-16 left-3.5 z-[1000] pointer-events-auto">
        {/* Toggle Pill */}
        <button
          type="button"
          onClick={() => setIsFilterOpen(!isFilterOpen)}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold shadow-md backdrop-blur-md border transition-all active:scale-95 ${
            selectedSeverity !== 'todos'
              ? 'bg-gray-900 text-white border-gray-800'
              : 'bg-white/95 text-gray-700 border-gray-100 hover:bg-gray-50'
          }`}
        >
          {selectedSeverity === 'critico' ? (
            <>
              <span className="h-2 w-2 rounded-full bg-red-500 ring-2 ring-red-200" />
              <span>Peligro alto ({severityCounts?.critico ?? 0})</span>
            </>
          ) : selectedSeverity === 'moderado' ? (
            <>
              <span className="h-2 w-2 rounded-full bg-amber-500 ring-2 ring-amber-200" />
              <span>Peligro medio ({severityCounts?.moderado ?? 0})</span>
            </>
          ) : selectedSeverity === 'leve' ? (
            <>
              <span className="h-2 w-2 rounded-full bg-green-500 ring-2 ring-green-200" />
              <span>Peligro bajo ({severityCounts?.leve ?? 0})</span>
            </>
          ) : (
            <>
              <div className="flex -space-x-1">
                <span className="h-2 w-2 rounded-full bg-red-500 ring-1 ring-white" />
                <span className="h-2 w-2 rounded-full bg-amber-500 ring-1 ring-white" />
                <span className="h-2 w-2 rounded-full bg-green-500 ring-1 ring-white" />
              </div>
              <span>Peligro vial</span>
            </>
          )}
          <ChevronDown
            size={13}
            className={`transition-transform duration-200 ${
              isFilterOpen ? 'rotate-180' : ''
            } ${selectedSeverity !== 'todos' ? 'text-gray-300' : 'text-gray-400'}`}
          />
        </button>

        {/* Dropdown Menu when open */}
        {isFilterOpen && (
          <div className="mt-1.5 rounded-2xl bg-white/95 p-1.5 shadow-xl backdrop-blur-md border border-gray-100 text-xs flex flex-col gap-1 min-w-[145px] animate-scale-in">
            <div className="flex items-center justify-between px-2 pt-1 pb-0.5 border-b border-gray-100">
              <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">
                Peligro vial
              </span>
              {selectedSeverity !== 'todos' && (
                <button
                  type="button"
                  onClick={() => {
                    onSelectSeverity?.('todos');
                    setIsFilterOpen(false);
                  }}
                  className="text-[10px] text-blue-600 font-semibold hover:underline"
                >
                  Reset
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                onSelectSeverity?.('critico');
                setIsFilterOpen(false);
              }}
              className={`flex items-center justify-between gap-2.5 px-2.5 py-1.5 rounded-xl transition text-[11px] font-semibold text-left ${
                selectedSeverity === 'critico'
                  ? 'bg-red-50 text-red-700 ring-1 ring-red-300 shadow-sm'
                  : 'text-gray-700 hover:bg-gray-100/80'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-red-200 shrink-0" />
                <span>Peligro alto</span>
              </div>
              {severityCounts && (
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                    selectedSeverity === 'critico'
                      ? 'bg-red-200/80 text-red-800'
                      : 'text-gray-400 bg-gray-100'
                  }`}
                >
                  {severityCounts.critico}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                onSelectSeverity?.('moderado');
                setIsFilterOpen(false);
              }}
              className={`flex items-center justify-between gap-2.5 px-2.5 py-1.5 rounded-xl transition text-[11px] font-semibold text-left ${
                selectedSeverity === 'moderado'
                  ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-300 shadow-sm'
                  : 'text-gray-700 hover:bg-gray-100/80'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-amber-200 shrink-0" />
                <span>Peligro medio</span>
              </div>
              {severityCounts && (
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                    selectedSeverity === 'moderado'
                      ? 'bg-amber-200/80 text-amber-800'
                      : 'text-gray-400 bg-gray-100'
                  }`}
                >
                  {severityCounts.moderado}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                onSelectSeverity?.('leve');
                setIsFilterOpen(false);
              }}
              className={`flex items-center justify-between gap-2.5 px-2.5 py-1.5 rounded-xl transition text-[11px] font-semibold text-left ${
                selectedSeverity === 'leve'
                  ? 'bg-green-50 text-green-700 ring-1 ring-green-300 shadow-sm'
                  : 'text-gray-700 hover:bg-gray-100/80'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-green-200 shrink-0" />
                <span>Peligro bajo</span>
              </div>
              {severityCounts && (
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                    selectedSeverity === 'leve'
                      ? 'bg-green-200/80 text-green-800'
                      : 'text-gray-400 bg-gray-100'
                  }`}
                >
                  {severityCounts.leve}
                </span>
              )}
            </button>

            <div className="h-px bg-gray-100 my-0.5" />

            {/* Todos option below */}
            <button
              type="button"
              onClick={() => {
                onSelectSeverity?.('todos');
                setIsFilterOpen(false);
              }}
              className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl transition text-[11px] font-semibold text-left ${
                selectedSeverity === 'todos'
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100/80'
              }`}
            >
              <span>Todos los reportes</span>
              {severityCounts && (
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                    selectedSeverity === 'todos'
                      ? 'bg-white/20 text-white'
                      : 'text-gray-400 bg-gray-100'
                  }`}
                >
                  {severityCounts.todos}
                </span>
              )}
            </button>
          </div>
        )}
      </div>

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
