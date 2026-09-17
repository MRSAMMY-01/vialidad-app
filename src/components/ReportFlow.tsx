import { useState, useRef, useEffect, useMemo, type ChangeEvent } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import {
  Camera,
  X,
  Check,
  MapPin,
  ChevronLeft,
  AlertTriangle,
  AlertCircle,
  OctagonAlert,
  Ban,
  Construction,
  Loader2,
  RotateCcw,
  Users,
  Locate,
} from 'lucide-react';
import type { Severity, EventType, ReportEvent } from '@/data/mockEvents';
import { severityConfig, mockGpsLocation } from '@/data/mockEvents';
import { compressAndUploadImage } from '@/services/cloudinaryService';
import { createGpsIcon } from '@/utils/mapIcons';

interface ReportFlowProps {
  onClose: () => void;
  onSubmit: (event: Omit<ReportEvent, 'id' | 'yaConfirme' | 'yaVoteEstado'>) => Promise<void> | void;
  currentUid?: string | null;
}

const hexToRgba = (hex: string, opacity: number) => {
  const value = hex.replace('#', '');
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
};

function LocationPickerEvents({
  location,
  onChangeLocation,
}: {
  location: { lat: number; lng: number };
  onChangeLocation: (loc: { lat: number; lng: number }) => void;
}) {
  const map = useMap();
  const markerRef = useRef<L.Marker | null>(null);

  // Invalidate size on mount to ensure tiles render
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);
    return () => clearTimeout(timer);
  }, [map]);

  // When location changes externally (e.g. GPS button clicked), pan to it
  useEffect(() => {
    map.flyTo([location.lat, location.lng], map.getZoom(), { duration: 0.5 });
  }, [location.lat, location.lng, map]);

  useMapEvents({
    click(e) {
      onChangeLocation({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });

  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          const newLatLng = marker.getLatLng();
          onChangeLocation({ lat: newLatLng.lat, lng: newLatLng.lng });
        }
      },
    }),
    [onChangeLocation]
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

export default function ReportFlow({ onClose, onSubmit, currentUid }: ReportFlowProps) {
  const [step, setStep] = useState(1);
  const [photo, setPhoto] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [tipo, setTipo] = useState<EventType>('bache');
  const [severity, setSeverity] = useState<Severity | null>(null);
  const [location, setLocation] = useState(mockGpsLocation);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reporterName, setReporterName] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('nombreReportero') || '';
    }
    return '';
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const typeOptions: { key: EventType; label: string; icon: typeof Ban }[] = [
    { key: 'bache', label: 'Bache / Daño', icon: AlertTriangle },
    { key: 'corte_calle', label: 'Corte de calle', icon: Ban },
    { key: 'otro', label: 'Otro problema', icon: Construction },
  ];

  const severityOptions: { key: Severity; icon: typeof AlertCircle }[] = [
    { key: 'leve', icon: AlertCircle },
    { key: 'moderado', icon: AlertTriangle },
    { key: 'critico', icon: OctagonAlert },
  ];

  const handleProcessAndUpload = async (file: File) => {
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setUploadError(null);
    setIsUploadingPhoto(true);

    try {
      const secureUrl = await compressAndUploadImage(file);
      setPhoto(secureUrl);
    } catch (err: any) {
      console.error('Error al subir imagen a Cloudinary:', err);
      setUploadError(err.message || 'No se pudo subir la foto. Comprueba tu conexión a internet.');
      setPhoto(null);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleProcessAndUpload(file);
    }
  };

  const handleRetryUpload = () => {
    if (selectedFile) {
      handleProcessAndUpload(selectedFile);
    }
  };

  const handleClearPhoto = () => {
    setPhoto(null);
    setPreviewUrl(null);
    setSelectedFile(null);
    setUploadError(null);
  };

  const handleSubmit = async () => {
    const finalSeverity: Severity = tipo === 'corte_calle' ? 'critico' : (severity || 'critico');
    if (!photo || !title.trim() || !description.trim()) return;
    if (tipo !== 'corte_calle' && !severity) return;

    try {
      setIsSubmitting(true);
      const today = new Date().toISOString().split('T')[0];
      const trimmedReporter = reporterName.trim();
      const finalReporter = trimmedReporter || 'Vecino/a de Chillán';

      if (typeof window !== 'undefined' && trimmedReporter) {
        localStorage.setItem('nombreReportero', trimmedReporter);
      }

      const newEvent: Omit<ReportEvent, 'id' | 'yaConfirme' | 'yaVoteEstado'> = {
        lat: location.lat,
        lng: location.lng,
        tipo,
        severity: finalSeverity,
        estado: 'activo',
        ultimaConfirmacion: today,
        estadoVotos: { activo: 0, intervencion_parcial: 0, resuelto: 0 },
        title: title.trim(),
        description: description.trim(),
        date: today,
        photo,
        reporter: finalReporter,
        confirmations: 0,
        uid: currentUid || undefined,
      };
      await onSubmit(newEvent);
    } catch (err) {
      console.error('Error submitting report to Firestore:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceed =
    step === 1
      ? !!photo && !isUploadingPhoto && !uploadError
      : step === 2
        ? (tipo === 'corte_calle' || !!severity)
        : !!title.trim() && !!description.trim();

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setLocation(mockGpsLocation);
      setLocationMessage('Tu navegador no admite geolocalización. Usamos la ubicación de referencia en Chillán.');
      return;
    }

    setIsLocating(true);
    setLocationMessage(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocation({ lat: coords.latitude, lng: coords.longitude });
        setLocationMessage('Ubicación actualizada con tu GPS.');
        setIsLocating(false);
      },
      (error) => {
        setLocation(mockGpsLocation);
        const message = error.code === error.PERMISSION_DENIED
          ? 'No autorizaste el acceso a tu ubicación. Usamos la ubicación de referencia en Chillán.'
          : error.code === error.TIMEOUT
            ? 'No fue posible obtener tu ubicación a tiempo. Usamos la ubicación de referencia en Chillán.'
            : 'No fue posible obtener tu ubicación. Usamos la ubicación de referencia en Chillán.';
        setLocationMessage(message);
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 }
    );
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/50 backdrop-blur-xs animate-fade-in p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl animate-slide-up overflow-hidden max-h-[90dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5 shrink-0">
          <div className="flex items-center gap-3">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="text-gray-500 hover:text-gray-700 p-1 -ml-1 rounded-lg hover:bg-gray-100 transition"
              >
                <ChevronLeft size={22} />
              </button>
            )}
            <div>
              <h2 className="text-base font-bold text-gray-900">Reportar un bache</h2>
              <p className="text-xs text-gray-500">Paso {step} de 3</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="flex gap-1.5 px-5 pt-2.5 shrink-0">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${s <= step ? 'bg-blue-600' : 'bg-gray-200'}`}
            />
          ))}
        </div>

        {/* Scrollable Step Content Body */}
        <div className="overflow-y-auto flex-1 overscroll-contain">
          {/* Step 1: Photo */}
          {step === 1 && (
            <div className="p-5 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-800">Toma o elige una foto</h3>
                <p className="text-xs text-gray-500 mt-0.5">Una foto clara ayuda a evaluar el problema.</p>
              </div>

              {previewUrl || photo ? (
                <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gray-900 shadow-inner">
                  <img
                    src={previewUrl || photo || ''}
                    alt="Reporte"
                    className={`w-full h-56 object-cover transition duration-300 ${
                      isUploadingPhoto ? 'opacity-60 blur-[1px]' : 'opacity-100'
                    }`}
                  />

                  {/* Clear/Delete photo button */}
                  {!isUploadingPhoto && (
                    <button
                      type="button"
                      onClick={handleClearPhoto}
                      aria-label="Quitar foto"
                      className="absolute top-2.5 right-2.5 rounded-full bg-black/60 p-2 text-white backdrop-blur-md transition hover:bg-black/80"
                    >
                      <X size={18} />
                    </button>
                  )}

                  {/* Uploading overlay */}
                  {isUploadingPhoto && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-black/50 p-4 text-center text-white backdrop-blur-[2px]">
                      <Loader2 size={32} className="animate-spin text-blue-400" />
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold">Comprimiendo y subiendo foto...</p>
                        <p className="text-[11px] text-gray-300">Optimizando imagen a 1200px</p>
                      </div>
                    </div>
                  )}

                  {/* Success badge */}
                  {!isUploadingPhoto && photo && !uploadError && (
                    <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 rounded-full bg-emerald-600/95 backdrop-blur-sm px-3 py-1.5 text-xs font-semibold text-white shadow-lg">
                      <Check size={15} /> Foto optimizada y lista
                    </div>
                  )}
                </div>
              ) : (
                <label className="flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-gray-300 py-10 transition hover:border-blue-400 hover:bg-blue-50/70">
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={handlePhotoChange}
                  />
                  <div className="rounded-full bg-blue-100 p-4 shadow-sm">
                    <Camera size={28} className="text-blue-600" />
                  </div>
                  <div className="text-center">
                    <span className="text-sm font-semibold text-gray-700 block">Tocar para capturar o elegir foto</span>
                    <span className="text-xs text-gray-400 mt-0.5 block">Se comprimirá y optimizará automáticamente</span>
                  </div>
                </label>
              )}

              {/* Error message with retry */}
              {uploadError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-3.5 space-y-2.5 animate-slide-up">
                  <div className="flex items-start gap-2 text-xs text-red-800">
                    <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
                    <span>{uploadError}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRetryUpload}
                      className="flex items-center gap-1.5 rounded-xl bg-red-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-red-700 active:scale-95"
                    >
                      <RotateCcw size={14} /> Reintentar subida
                    </button>
                    <button
                      type="button"
                      onClick={handleClearPhoto}
                      className="rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                    >
                      Elegir otra
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Type & Severity */}
          {step === 2 && (
            <div className="p-5 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-800">Tipo de problema</h3>
                <p className="text-xs text-gray-500 mt-0.5">Indica qué tipo de situación estás reportando.</p>
              </div>

              {/* Type selector */}
              <div className="grid grid-cols-3 gap-2">
                {typeOptions.map(({ key, label, icon: Icon }) => {
                  const isSelected = tipo === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                          try {
                            navigator.vibrate(10);
                          } catch {
                            // Ignore
                          }
                        }
                        setTipo(key);
                        if (key === 'corte_calle') {
                          setSeverity('critico');
                        }
                      }}
                      className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 p-3 transition-all duration-200 ${
                        isSelected
                          ? key === 'corte_calle'
                            ? 'border-red-500 bg-red-50/70 text-red-700 shadow-sm scale-[1.02]'
                            : 'border-blue-600 bg-blue-50/70 text-blue-700 shadow-sm scale-[1.02]'
                          : 'border-gray-200 hover:border-gray-300 text-gray-600'
                      }`}
                    >
                      <Icon size={22} className={isSelected && key === 'corte_calle' ? 'text-red-600' : ''} />
                      <span className="text-xs font-bold leading-tight text-center">{label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Severity selector (or notice if corte_calle) */}
              {tipo === 'corte_calle' ? (
                <div className="rounded-2xl border-2 border-red-200 bg-red-50/80 p-4 animate-fade-in">
                  <div className="flex items-center gap-2.5">
                    <div className="rounded-xl bg-red-600 p-2 text-white shadow-sm">
                      <Ban size={20} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-red-900">
                        Corte total / Prioridad Crítica
                      </h4>
                      <p className="text-xs text-red-700 mt-0.5">
                        Los cortes de calle se catalogan automáticamente como críticos en el mapa para alertar a los conductores.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 pt-2">
                  <h3 className="text-sm font-semibold text-gray-800">¿Qué tan peligroso es?</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {severityOptions.map(({ key, icon: Icon }) => {
                      const isSelected = severity === key;
                      const cfg = severityConfig[key];
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                              try {
                                navigator.vibrate(10);
                              } catch {
                                // Ignore
                              }
                            }
                            setSeverity(key);
                          }}
                          style={{
                            borderColor: isSelected ? cfg.color : undefined,
                            backgroundColor: isSelected ? hexToRgba(cfg.color, 0.12) : undefined,
                          }}
                          className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 p-3.5 transition-all duration-200 ${
                            isSelected
                              ? 'shadow-md scale-[1.02]'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div
                            className="flex h-7 w-7 items-center justify-center rounded-full text-white shadow-sm"
                            style={{ backgroundColor: cfg.color }}
                          >
                            <Icon size={16} />
                          </div>
                          <span className={`text-xs font-bold capitalize ${isSelected ? 'text-gray-900' : 'text-gray-600'}`}>
                            {cfg.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Location & Details */}
          {step === 3 && (
            <div className="p-5 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-800">Ubicación y detalles</h3>
                <p className="text-xs text-gray-500 mt-0.5">Mueve el pin o toca en el mapa para ajustar el punto exacto.</p>
              </div>

              {/* Interactive Mini Map Picker */}
              <div className="space-y-2">
                <div className="relative h-44 w-full rounded-2xl border border-gray-200 shadow-inner overflow-hidden z-0">
                  <MapContainer
                    center={[location.lat, location.lng]}
                    zoom={16}
                    scrollWheelZoom={false}
                    className="h-full w-full"
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <LocationPickerEvents
                      location={location}
                      onChangeLocation={setLocation}
                    />
                  </MapContainer>
                  <div className="absolute top-2 left-2 pointer-events-none bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] font-medium text-white shadow">
                    Arrastra el marcador azul al bache
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-gray-50 border border-gray-100 px-3.5 py-2">
                  <div className="flex items-center gap-1.5 text-xs text-gray-600">
                    <MapPin size={14} className="text-blue-600 shrink-0" />
                    <span className="font-mono text-[11px]">{location.lat.toFixed(4)}, {location.lng.toFixed(4)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleGetLocation}
                    disabled={isLocating}
                    className="flex items-center gap-1 rounded-lg bg-blue-50 border border-blue-200 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 transition disabled:opacity-50 active:scale-95"
                  >
                    <Locate size={13} className={isLocating ? 'animate-spin' : ''} />
                    <span>{isLocating ? 'Obteniendo...' : 'Mi GPS actual'}</span>
                  </button>
                </div>
                {locationMessage && (
                  <p className="text-[11px] text-blue-600 px-1">{locationMessage}</p>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700">Título / Referencia</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    tipo === 'corte_calle'
                      ? 'ej. Corte total en 5 de Abril'
                      : 'ej. Bache profundo en Av. O\'Higgins'
                  }
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700">Descripción</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={
                    tipo === 'corte_calle'
                      ? 'ej. Calle cerrada por trabajos de repavimentación entre Maipú y 18 de Septiembre.'
                      : 'ej. Bache de gran tamaño en pista derecha cerca del cruce.'
                  }
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700">
                  ¿Cómo quieres que aparezca tu nombre? (opcional)
                </label>
                <input
                  type="text"
                  value={reporterName}
                  onChange={(e) => setReporterName(e.target.value)}
                  placeholder="Vecino/a de Chillán"
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer button */}
        <div className="border-t border-gray-100 p-4 shrink-0 bg-white">
          {step < 3 ? (
            <button
              type="button"
              onClick={() => canProceed && setStep(step + 1)}
              disabled={!canProceed}
              className={`w-full rounded-2xl py-3.5 font-semibold transition ${
                canProceed
                  ? 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]'
                  : 'cursor-not-allowed bg-gray-100 text-gray-400'
              }`}
            >
              Continuar
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canProceed || isSubmitting}
              className="w-full rounded-2xl bg-green-600 py-3.5 font-semibold text-white transition hover:bg-green-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
            >
              {isSubmitting ? 'Guardando reporte...' : 'Enviar reporte'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
