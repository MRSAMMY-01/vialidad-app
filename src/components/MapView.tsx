import { useEffect, useState, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import { Locate, Loader2 } from 'lucide-react';
import type { ReportEvent, Severity } from '@/data/mockEvents';
import { mockGpsLocation, severityConfig } from '@/data/mockEvents';
import { createSeverityIcon, createGpsIcon } from '@/utils/mapIcons';

interface MapViewProps {
  events: ReportEvent[];
  onSelect: (event: ReportEvent) => void;
  newReportLocation: { lat: number; lng: number } | null;
  userLocation?: { lat: number; lng: number } | null;
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

export default function MapView({
  events,
  onSelect,
  newReportLocation,
  userLocation: propUserLocation,
}: MapViewProps) {
  const [internalUserLocation, setInternalUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [targetLocation, setTargetLocation] = useState<{
    lat: number;
    lng: number;
    zoom?: number;
    timestamp: number;
  } | null>(null);

  const activeUserLocation = propUserLocation ?? internalUserLocation;

  // Initial Geolocation lookup on mount if not provided as prop
  useEffect(() => {
    if (propUserLocation) {
      setTargetLocation({ ...propUserLocation, zoom: 15, timestamp: Date.now() });
      return;
    }

    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setInternalUserLocation(coords);
          setTargetLocation({ ...coords, zoom: 15, timestamp: Date.now() });
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

  // Recenter to user's location or fallback to Chillán
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
        zoomControl={false}
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

        {/* 80m Danger radius circles around critical events (visible at close zoom) */}
        <CriticalEventCircles events={events} />

        <MarkerClusterGroup events={events} onSelect={onSelect} />

        {/* User Location Marker (if available) */}
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

      {/* Floating Legend */}
      <div className="absolute top-16 left-4 z-[1000] pointer-events-auto select-none rounded-2xl bg-white/90 px-3.5 py-2.5 shadow-lg backdrop-blur-md border border-gray-100/90 text-xs">
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
          Severidad
        </p>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-gray-700">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-red-200" />
            <span>Crítico</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-semibold text-gray-700">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-amber-200" />
            <span>Moderado</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-semibold text-gray-700">
            <span className="h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-green-200" />
            <span>Leve</span>
          </div>
        </div>
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
