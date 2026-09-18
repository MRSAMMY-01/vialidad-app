import { useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { createGpsIcon } from '@/utils/mapIcons';

interface LocationPickerEventsProps {
  location: { lat: number; lng: number };
  onChangeLocation: (loc: { lat: number; lng: number }) => void;
  onInteract?: () => void;
}

function LocationPickerEvents({
  location,
  onChangeLocation,
  onInteract,
}: LocationPickerEventsProps) {
  const map = useMap();
  const markerRef = useRef<L.Marker | null>(null);

  // Invalidate size on mount to ensure tiles render cleanly
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);
    return () => clearTimeout(timer);
  }, [map]);

  // When location changes externally (e.g. GPS button clicked), pan to it
  useEffect(() => {
    map.flyTo([location.lat, location.lng], map.getZoom(), { duration: 0.5 });
  }, [location.lat, location.lng, map]);

  useMapEvents({
    click(e) {
      onChangeLocation({ lat: e.latlng.lat, lng: e.latlng.lng });
      if (onInteract) onInteract();
    },
  });

  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          const newLatLng = marker.getLatLng();
          onChangeLocation({ lat: newLatLng.lat, lng: newLatLng.lng });
          if (onInteract) onInteract();
        }
      },
    }),
    [onChangeLocation, onInteract]
  );

  return (
    <Marker
      draggable={true}
      eventHandlers={eventHandlers}
      position={[location.lat, location.lng]}
      ref={markerRef}
      icon={createGpsIcon()}
    />
  );
}

interface LocationPickerMapProps {
  location: { lat: number; lng: number };
  onChangeLocation: (loc: { lat: number; lng: number }) => void;
  onInteract?: () => void;
  heightClassName?: string;
  hintText?: string;
  zoom?: number;
}

export default function LocationPickerMap({
  location,
  onChangeLocation,
  onInteract,
  heightClassName = 'h-44',
  hintText = 'Arrastra el marcador azul o toca el mapa',
  zoom = 16,
}: LocationPickerMapProps) {
  return (
    <div className={`relative w-full rounded-2xl border border-gray-200 shadow-inner overflow-hidden z-0 ${heightClassName}`}>
      <MapContainer
        center={[location.lat, location.lng]}
        zoom={zoom}
        scrollWheelZoom={false}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LocationPickerEvents
          location={location}
          onChangeLocation={onChangeLocation}
          onInteract={onInteract}
        />
      </MapContainer>
      {hintText && (
        <div className="absolute top-2 left-2 pointer-events-none bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] font-medium text-white shadow">
          {hintText}
        </div>
      )}
    </div>
  );
}
