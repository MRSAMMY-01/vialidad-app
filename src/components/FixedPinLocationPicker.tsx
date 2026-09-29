import { useEffect, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import {
  Search,
  Loader2,
  X,
  MapPin,
  Locate,
  Check,
  AlertCircle,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import {
  NUBLE_MAP_BOUNDS,
  NUBLE_NOMINATIM_VIEWBOX,
  isWithinNubleBounds,
  OUT_OF_BOUNDS_MESSAGE,
} from '@/utils/geoBounds';

interface NominatimSearchResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  type?: string;
  address?: {
    road?: string;
    pedestrian?: string;
    street?: string;
    house_number?: string;
    neighbourhood?: string;
    suburb?: string;
    residential?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
  };
}

interface FixedPinLocationPickerProps {
  location: { lat: number; lng: number };
  onChangeLocation: (loc: { lat: number; lng: number }) => void;
  onInteract: () => void;
  locationConfirmed: boolean;
  onGpsClick: () => void;
  isLocating: boolean;
  gpsMessage?: string | null;
  onAddressResolved?: (address: string | null) => void;
}

/**
 * Controller inside Leaflet context that tracks container resizing
 * with 200ms delay to eliminate grey tiles during fullscreen transitions.
 */
function MapResizeTracker({ isFullscreen }: { isFullscreen: boolean }) {
  const map = useMap();

  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);
    return () => clearTimeout(timer);
  }, [isFullscreen, map]);

  return null;
}

/**
 * Controller inside Leaflet context that handles moveend events with debounce,
 * center programmatic pans, and map invalidation.
 */
function FixedPinMapEvents({
  onCenterChange,
  targetCoords,
}: {
  onCenterChange: (coords: { lat: number; lng: number }) => void;
  targetCoords: { lat: number; lng: number; zoom?: number } | null;
}) {
  const map = useMap();
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Invalidate map size on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);
    return () => clearTimeout(timer);
  }, [map]);

  // Programmatic pan when targetCoords changes (search result or GPS)
  useEffect(() => {
    if (targetCoords) {
      map.flyTo([targetCoords.lat, targetCoords.lng], targetCoords.zoom ?? 17, {
        duration: 0.8,
      });
    }
  }, [targetCoords, map]);

  useMapEvents({
    moveend: () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        const center = map.getCenter();
        onCenterChange({ lat: center.lat, lng: center.lng });
      }, 350);
    },
  });

  return null;
}

/**
 * Extract clean human-readable street/sector name from Nominatim response
 */
function extractCleanAddress(data: NominatimSearchResult | null | undefined): string {
  if (!data) return '';
  const addr = data.address;
  if (addr) {
    const parts: string[] = [];
    if (addr.road || addr.pedestrian || addr.street) {
      const street = addr.road || addr.pedestrian || addr.street;
      const houseNumber = addr.house_number ? ` ${addr.house_number}` : '';
      parts.push(`${street}${houseNumber}`);
    }
    const sub = addr.neighbourhood || addr.suburb || addr.residential;
    if (sub) {
      parts.push(sub);
    } else {
      const city = addr.city || addr.town || addr.village;
      if (city) {
        parts.push(city);
      }
    }
    if (parts.length > 0) {
      return parts.join(', ');
    }
  }
  if (data.display_name) {
    const segments = data.display_name.split(',');
    return segments.slice(0, 2).join(',').trim();
  }
  return '';
}

export default function FixedPinLocationPicker({
  location,
  onChangeLocation,
  onInteract,
  locationConfirmed,
  onGpsClick,
  isLocating,
  gpsMessage,
  onAddressResolved,
}: FixedPinLocationPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<NominatimSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  const [addressName, setAddressName] = useState<string | null>(null);
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const [boundaryNotice, setBoundaryNotice] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Close fullscreen on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  const [programmaticTarget, setProgrammaticTarget] = useState<{
    lat: number;
    lng: number;
    zoom?: number;
  } | null>(null);

  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const reverseDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Reverse Geocoding with Nominatim on location change
  const fetchReverseGeocode = useCallback((lat: number, lng: number) => {
    if (reverseDebounceRef.current) clearTimeout(reverseDebounceRef.current);

    setIsLoadingAddress(true);
    reverseDebounceRef.current = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&zoom=18`;
        const res = await fetch(url, {
          headers: {
            'Accept-Language': 'es-CL,es;q=0.9',
          },
        });
        if (res.ok) {
          const data = await res.json();
          const clean = extractCleanAddress(data);
          const finalName = clean || 'Sector Chillán';
          setAddressName(finalName);
          onAddressResolved?.(finalName);
        } else {
          setAddressName(null);
          onAddressResolved?.(null);
        }
      } catch (err) {
        console.warn('Error en reverse geocoding de Nominatim:', err);
        setAddressName(null);
        onAddressResolved?.(null);
      } finally {
        setIsLoadingAddress(false);
      }
    }, 400);
  }, [onAddressResolved]);

  // Initial reverse geocode on mount
  useEffect(() => {
    fetchReverseGeocode(location.lat, location.lng);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle map center change when user stops dragging
  const handleMapCenterChange = useCallback(
    (newCenter: { lat: number; lng: number }) => {
      if (!isWithinNubleBounds(newCenter.lat, newCenter.lng)) {
        setBoundaryNotice(OUT_OF_BOUNDS_MESSAGE);
        setTimeout(() => setBoundaryNotice(null), 4000);
        return;
      }
      setBoundaryNotice(null);
      onChangeLocation(newCenter);
      onInteract();
      fetchReverseGeocode(newCenter.lat, newCenter.lng);
    },
    [onChangeLocation, onInteract, fetchReverseGeocode]
  );

  // 2. Search Address with Nominatim on typing (500ms debounce)
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (!text.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    setIsSearching(true);

    searchDebounceRef.current = setTimeout(async () => {
      try {
        // Query bounded to entire Ñuble region
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          text.trim()
        )}&format=json&limit=5&countrycodes=cl&viewbox=${NUBLE_NOMINATIM_VIEWBOX}&bounded=1&addressdetails=1`;

        const res = await fetch(url, {
          headers: {
            'Accept-Language': 'es-CL,es;q=0.9',
          },
        });
        if (res.ok) {
          const data: NominatimSearchResult[] = await res.json();
          setSearchResults(data);
          setShowSearchResults(data.length > 0);
        } else {
          setSearchResults([]);
        }
      } catch (err) {
        console.warn('Error en búsqueda de dirección Nominatim:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 500);
  };

  const handleSelectSearchResult = (result: NominatimSearchResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    if (!isNaN(lat) && !isNaN(lng)) {
      if (!isWithinNubleBounds(lat, lng)) {
        setBoundaryNotice(OUT_OF_BOUNDS_MESSAGE);
        setShowSearchResults(false);
        setSearchQuery('');
        setTimeout(() => setBoundaryNotice(null), 4000);
        return;
      }
      setBoundaryNotice(null);
      const coords = { lat, lng };
      setProgrammaticTarget({ lat, lng, zoom: 17 });
      onChangeLocation(coords);
      onInteract();
      const clean = extractCleanAddress(result);
      const finalName = clean || result.display_name.split(',')[0];
      setAddressName(finalName);
      onAddressResolved?.(finalName);
      setShowSearchResults(false);
      setSearchQuery('');
    }
  };

  return (
    <div className="space-y-3">
      {/* 1. Nominatim Address Search Bar */}
      <div className="relative z-20">
        <div className="flex items-center gap-2 rounded-2xl border border-gray-300 bg-white px-3.5 py-2.5 shadow-sm transition focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
          <Search size={17} className="text-gray-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={() => {
              if (searchResults.length > 0) setShowSearchResults(true);
            }}
            placeholder="Buscar calle o sector (ej. Av. Libertad 500)"
            className="w-full text-xs text-gray-800 placeholder-gray-400 outline-none bg-transparent"
          />
          {isSearching ? (
            <Loader2 size={15} className="animate-spin text-blue-600 shrink-0" />
          ) : searchQuery ? (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSearchResults([]);
                setShowSearchResults(false);
              }}
              className="text-gray-400 hover:text-gray-600 p-0.5"
            >
              <X size={15} />
            </button>
          ) : null}
        </div>

        {/* Search Results Dropdown */}
        {showSearchResults && searchResults.length > 0 && (
          <div className="absolute top-12 left-0 right-0 z-50 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl animate-scale-in max-h-56 overflow-y-auto divide-y divide-gray-100">
            {searchResults.map((res) => {
              const clean = extractCleanAddress(res);
              return (
                <button
                  key={res.place_id}
                  type="button"
                  onClick={() => handleSelectSearchResult(res)}
                  className="flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left text-xs transition hover:bg-blue-50/70 active:bg-blue-100"
                >
                  <MapPin size={15} className="text-blue-600 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">
                      {clean || res.display_name.split(',')[0]}
                    </p>
                    <p className="text-[11px] text-gray-500 truncate">{res.display_name}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Large Map Container with Fixed Center Pin (with Fullscreen Mode Support) */}
      <div
        className={
          isFullscreen
            ? 'fixed inset-0 z-[2500] h-[100dvh] w-screen overflow-hidden rounded-none border-none shadow-none bg-slate-100 animate-fade-in'
            : 'relative h-64 sm:h-72 w-full overflow-hidden rounded-3xl border border-gray-200 shadow-inner z-10 bg-slate-100'
        }
      >
        <MapContainer
          center={[location.lat, location.lng]}
          zoom={16}
          minZoom={9}
          maxBounds={NUBLE_MAP_BOUNDS}
          maxBoundsViscosity={1.0}
          zoomControl={false}
          scrollWheelZoom={true}
          touchZoom={true}
          doubleClickZoom={true}
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapResizeTracker isFullscreen={isFullscreen} />
          <FixedPinMapEvents
            onCenterChange={handleMapCenterChange}
            targetCoords={programmaticTarget}
          />
        </MapContainer>

        {/* Visual Fixed Center Pin Overlay (HTML Element - Map moves beneath) */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-[400]">
          <div className="relative flex flex-col items-center">
            {/* The Drop Pin Icon */}
            <div className="relative -translate-y-5 animate-bounce-subtle drop-shadow-xl">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-600 border-2 border-white shadow-lg text-white">
                <MapPin size={22} className="fill-white text-blue-600" />
              </div>
              {/* Pointing triangle below circle */}
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-6 border-t-blue-600" />
            </div>

            {/* Ground Anchor Shadow / Pulse Dot */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-600/80"></span>
              </span>
            </div>
          </div>
        </div>

        {/* Toggle Fullscreen Button (Top-Right) */}
        <button
          type="button"
          onClick={() => setIsFullscreen((prev) => !prev)}
          title={isFullscreen ? 'Minimizar mapa' : 'Expandir mapa a pantalla completa'}
          className={`absolute z-[400] flex items-center gap-1.5 rounded-full font-bold shadow-xl backdrop-blur-md transition active:scale-95 cursor-pointer ${
            isFullscreen
              ? 'top-4 right-4 bg-gray-900/90 text-white hover:bg-black px-3.5 py-2 text-xs border border-white/20'
              : 'top-3 right-3 bg-white/95 text-gray-800 hover:bg-white px-3 py-1.5 text-xs border border-gray-100'
          }`}
        >
          {isFullscreen ? (
            <>
              <Minimize2 size={14} />
              <span>Cerrar mapa</span>
            </>
          ) : (
            <>
              <Maximize2 size={13} className="text-blue-600" />
              <span>Expandir</span>
            </>
          )}
        </button>

        {/* Floating Hint Overlay on top of Map */}
        <div className="pointer-events-none absolute top-3 left-3 z-[400] bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full text-[11px] font-medium text-white shadow-md">
          Mueve el mapa para posicionar el pin
        </div>

        {/* Floating Out-of-Bounds Notification */}
        {(boundaryNotice || (gpsMessage === OUT_OF_BOUNDS_MESSAGE ? gpsMessage : null)) && (
          <div className="absolute top-12 left-3 right-3 z-[450] animate-slide-down pointer-events-none">
            <div className="flex items-center gap-2 rounded-2xl bg-gray-900/95 px-3.5 py-2.5 text-xs font-medium text-white shadow-xl backdrop-blur-md border border-gray-700">
              <AlertCircle size={15} className="text-amber-400 shrink-0" />
              <span>{boundaryNotice || gpsMessage}</span>
            </div>
          </div>
        )}

        {/* Floating "Mi GPS Actual" Quick Button */}
        <button
          type="button"
          onClick={onGpsClick}
          disabled={isLocating}
          title="Usar mi ubicación actual"
          className={`absolute z-[400] flex items-center gap-1.5 rounded-2xl bg-white px-3.5 py-2 text-xs font-bold text-gray-800 shadow-xl border border-gray-100 backdrop-blur-sm transition hover:bg-gray-50 active:scale-95 disabled:opacity-75 cursor-pointer ${
            isFullscreen ? 'bottom-24 right-4' : 'bottom-3 right-3'
          }`}
        >
          {isLocating ? (
            <Loader2 size={15} className="animate-spin text-blue-600" />
          ) : (
            <Locate size={15} className="text-blue-600" />
          )}
          <span>{isLocating ? 'Obteniendo GPS...' : 'Mi GPS actual'}</span>
        </button>

        {/* Bottom Fullscreen Confirmation Bar */}
        {isFullscreen && (
          <div className="absolute bottom-6 left-4 right-4 z-[400] flex items-center justify-between gap-3 rounded-2xl bg-white/95 p-3.5 shadow-2xl backdrop-blur-md border border-gray-200 animate-slide-up max-w-md mx-auto">
            <div className="min-w-0 flex-1 pl-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Punto seleccionado
              </p>
              <p className="text-xs font-bold text-gray-900 truncate">
                {addressName || 'Ubicación seleccionada'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsFullscreen(false)}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-blue-700 active:scale-95 shrink-0 cursor-pointer"
            >
              <Check size={14} />
              <span>Listo</span>
            </button>
          </div>
        )}
      </div>

      {/* 3. Visual Confirmation Card with Reverse Geocoded Sector & Coords */}
      <div className="space-y-2">
        <div className="rounded-2xl border border-gray-200 bg-gray-50/90 p-3.5 shadow-xs transition">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="p-2 rounded-xl bg-blue-100 text-blue-700 shrink-0 mt-0.5">
                <MapPin size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  Ubicación seleccionada
                </p>
                {isLoadingAddress ? (
                  <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-500">
                    <Loader2 size={12} className="animate-spin text-blue-600" />
                    <span>Identificando calle o sector...</span>
                  </div>
                ) : (
                  <p className="text-sm font-bold text-gray-900 truncate mt-0.5">
                    {addressName || 'Chillán, Región de Ñuble'}
                  </p>
                )}
                <p className="font-mono text-[11px] text-gray-500 mt-0.5">
                  {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                </p>
              </div>
            </div>

            {locationConfirmed && (
              <span className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                <Check size={12} /> Confirmada
              </span>
            )}
          </div>
        </div>

        {/* Location not confirmed alert helper */}
        {!locationConfirmed ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 flex items-center gap-2 text-xs font-medium text-amber-900 animate-pulse">
            <MapPin size={14} className="text-amber-600 shrink-0" />
            <span>Desplaza el mapa o usa tu GPS para confirmar el punto exacto.</span>
          </div>
        ) : gpsMessage && gpsMessage !== OUT_OF_BOUNDS_MESSAGE ? (
          <p className="text-[11px] text-blue-600 px-1 font-medium">{gpsMessage}</p>
        ) : null}
      </div>
    </div>
  );
}
