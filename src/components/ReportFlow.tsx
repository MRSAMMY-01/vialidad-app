import { useState, type ChangeEvent } from 'react';
import {
  Camera,
  X,
  Check,
  ChevronLeft,
  AlertTriangle,
  AlertCircle,
  OctagonAlert,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import type { Severity, EventType, ReportEvent } from '@/data/mockEvents';
import { severityConfig, mockGpsLocation } from '@/data/mockEvents';
import { isWithinNubleBounds, OUT_OF_BOUNDS_MESSAGE } from '@/utils/geoBounds';
import { compressAndUploadImage } from '@/services/cloudinaryService';
import FixedPinLocationPicker from '@/components/FixedPinLocationPicker';

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
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [detectedAddress, setDetectedAddress] = useState<string | null>(null);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  // Reporter name selection state (default chip vs custom text)
  const [isCustomReporter, setIsCustomReporter] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('nombreReportero');
      return !!saved && saved.trim() !== '' && saved !== 'Vecino/a de Ñuble' && saved !== 'Vecino/a de Chillán';
    }
    return false;
  });

  const [reporterName, setReporterName] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('nombreReportero');
      if (saved && saved.trim() !== '' && saved !== 'Vecino/a de Ñuble' && saved !== 'Vecino/a de Chillán') {
        return saved;
      }
    }
    return '';
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const typeOptions: {
    key: EventType;
    label: string;
    emoji: string;
    description: string;
  }[] = [
    {
      key: 'bache',
      label: 'Bache',
      emoji: '🕳️',
      description: 'Hoyos, desniveles, grietas, pavimento en mal estado',
    },
    {
      key: 'corte_calle',
      label: 'Obstrucción',
      emoji: '🚧',
      description: 'Bloqueo del paso: contenedores, escombros acumulados o estructuras en la calzada o ciclovía',
    },
    {
      key: 'peligro_via',
      label: 'Peligro en la vía',
      emoji: '⚠️',
      description: 'Riesgo de accidente: tapas de alcantarilla abiertas, cables caídos, postes inclinados o derrumbes',
    },
    {
      key: 'otro',
      label: 'Otro problema',
      emoji: '➕',
      description: 'Otros incidentes viales que requieran atención',
    },
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
    } catch (err: unknown) {
      console.error('Error al subir imagen a Cloudinary:', err);
      const msg = err instanceof Error ? err.message : 'No se pudo subir la foto. Comprueba tu conexión a internet.';
      setUploadError(msg);
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
    if (!photo || !title.trim() || !description.trim() || !severity) return;

    try {
      setIsSubmitting(true);
      setSubmitError(null);
      const today = new Date().toISOString().split('T')[0];
      const finalReporter = isCustomReporter && reporterName.trim()
        ? reporterName.trim()
        : 'Vecino/a de Ñuble';

      if (typeof window !== 'undefined') {
        if (isCustomReporter && reporterName.trim()) {
          localStorage.setItem('nombreReportero', reporterName.trim());
        }
      }

      const newEvent: Omit<ReportEvent, 'id' | 'yaConfirme' | 'yaVoteEstado'> = {
        lat: location.lat,
        lng: location.lng,
        tipo,
        severity,
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
    } catch (err: unknown) {
      console.error('Error submitting report to Firestore:', err);
      const errorObj = err as { code?: string; message?: string } | undefined;
      const isPermissionOrCooldown =
        errorObj?.code === 'permission-denied' ||
        errorObj?.message?.toLowerCase().includes('permission') ||
        errorObj?.message?.toLowerCase().includes('permiso') ||
        errorObj?.message?.toLowerCase().includes('insufficient');

      if (isPermissionOrCooldown) {
        setSubmitError('Ya reportaste recientemente. Espera unos minutos antes de crear otro reporte.');
      } else {
        setSubmitError(errorObj?.message || 'Hubo un problema al enviar el reporte. Inténtalo nuevamente.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceed =
    step === 1
      ? !!photo && !isUploadingPhoto && !uploadError
      : step === 2
        ? !!severity
        : step === 3
          ? locationConfirmed
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
        if (!isWithinNubleBounds(coords.latitude, coords.longitude)) {
          setLocationMessage(OUT_OF_BOUNDS_MESSAGE);
          setIsLocating(false);
          return;
        }
        setLocation({ lat: coords.latitude, lng: coords.longitude });
        setLocationConfirmed(true);
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
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 }
    );
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/50 backdrop-blur-xs animate-fade-in p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl animate-slide-up overflow-hidden max-h-[92dvh] flex flex-col"
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
              <h2 className="text-base font-bold text-gray-900">Reportar problema</h2>
              <p className="text-xs text-gray-500">Paso {step} de 4</p>
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
          {[1, 2, 3, 4].map((s) => (
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
                <p className="text-xs text-gray-500 mt-0.5">Selecciona la opción que mejor describe la situación.</p>
              </div>

              {/* Type selector list with descriptions */}
              <div className="space-y-2">
                {typeOptions.map(({ key, label, emoji, description }) => {
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
                      }}
                      className={`w-full text-left flex items-start gap-3 rounded-2xl border-2 p-3 transition-all duration-200 ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/70 text-gray-900 shadow-sm ring-1 ring-blue-600/30'
                          : 'border-gray-200 hover:border-gray-300 bg-white text-gray-700'
                      }`}
                    >
                      <span className="text-xl shrink-0 mt-0.5 select-none" role="img" aria-label={label}>
                        {emoji}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-gray-900">{label}</span>
                          {isSelected && (
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-white shadow-xs">
                              <Check size={10} strokeWidth={3} />
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-500 leading-snug mt-0.5">{description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Severity selector for ALL categories */}
              <div className="space-y-2 pt-2 border-t border-gray-100">
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
                        className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 p-3 transition-all duration-200 ${
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
            </div>
          )}

          {/* Step 3: SOLO Ubicación (Pin fijo central + Mapa que se mueve + Nominatim) */}
          {step === 3 && (
            <div className="p-5 space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-800">Ubicación exacta</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Busca la calle o mueve el mapa para centrar el pin en el daño vial.
                </p>
              </div>

              {/* Enhanced Fixed Pin Location Picker */}
              <FixedPinLocationPicker
                location={location}
                onChangeLocation={(loc) => {
                  setLocation(loc);
                  setLocationConfirmed(true);
                }}
                onInteract={() => setLocationConfirmed(true)}
                locationConfirmed={locationConfirmed}
                onGpsClick={handleGetLocation}
                isLocating={isLocating}
                gpsMessage={locationMessage}
                onAddressResolved={setDetectedAddress}
              />
            </div>
          )}

          {/* Step 4: SOLO Detalles (Título, Descripción, Reportero) */}
          {step === 4 && (
            <div className="p-5 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-800">Detalles del reporte</h3>
                <p className="text-xs text-gray-500 mt-0.5">Describe el problema para informar a la comunidad.</p>
              </div>

              {/* Summary card header */}
              <div className="flex items-center gap-3 rounded-2xl bg-gray-50 border border-gray-100 p-3">
                {photo && (
                  <img src={photo} alt="Miniatura" className="h-12 w-12 rounded-xl object-cover border border-gray-200" />
                )}
                <div className="flex-1 min-w-0 text-xs">
                  <span className="font-bold text-gray-900 capitalize block truncate">
                    {tipo === 'bache'
                      ? 'Bache'
                      : tipo === 'corte_calle'
                        ? 'Obstrucción'
                        : tipo === 'peligro_via'
                          ? 'Peligro en la vía'
                          : 'Otro problema'}
                  </span>
                  <span className="text-[11px] text-gray-600 font-medium block truncate">
                    {detectedAddress ? `📍 ${detectedAddress}` : `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`}
                  </span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize shrink-0 ${
                  severity === 'critico'
                    ? 'bg-red-100 text-red-700'
                    : severity === 'moderado'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-green-100 text-green-700'
                }`}>
                  {severity ? severityConfig[severity]?.label || severity : 'Crítico'}
                </span>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700">Título / Referencia *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    tipo === 'bache'
                      ? 'ej. Bache profundo en Av. O\'Higgins'
                      : tipo === 'corte_calle'
                        ? 'ej. Contenedores o escombros bloqueando la ciclovía'
                        : tipo === 'peligro_via'
                          ? 'ej. Tapa de alcantarilla abierta en calzada'
                          : 'ej. Problema en calzada'
                  }
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700">Descripción detallada *</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={
                    tipo === 'bache'
                      ? 'ej. Bache de gran tamaño en pista derecha cerca del cruce.'
                      : tipo === 'corte_calle'
                        ? 'ej. Estructura pesada o escombros acumulados ocupando el paso.'
                        : tipo === 'peligro_via'
                          ? 'ej. Peligro inminente por alcantarilla sin tapa o cables a baja altura.'
                          : 'ej. Describe la situación con el mayor detalle posible.'
                  }
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Reporter name selectable chips */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-700 block">
                  ¿Cómo quieres que aparezca tu nombre?
                </label>

                {!isCustomReporter ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Chip 1: Preseleccionado por defecto */}
                    <button
                      type="button"
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-50 border-2 border-blue-600 text-blue-700 text-xs font-bold shadow-xs cursor-default"
                    >
                      <Check size={14} className="text-blue-600" />
                      <span>Vecino/a de Ñuble</span>
                    </button>

                    {/* Chip 2: Escribir mi nombre */}
                    <button
                      type="button"
                      onClick={() => setIsCustomReporter(true)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gray-50 border border-gray-300 hover:border-gray-400 hover:bg-gray-100 text-gray-700 text-xs font-medium transition active:scale-95"
                    >
                      <span>+ Escribir mi nombre</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5 animate-scale-in">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-gray-500 font-medium">Ingresa tu nombre o apodo:</span>
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomReporter(false);
                          setReporterName('');
                          if (typeof window !== 'undefined') {
                            localStorage.removeItem('nombreReportero');
                          }
                        }}
                        className="text-[11px] text-blue-600 font-semibold hover:underline"
                      >
                        ← Usar "Vecino/a de Ñuble"
                      </button>
                    </div>
                    <input
                      type="text"
                      value={reporterName}
                      onChange={(e) => setReporterName(e.target.value)}
                      placeholder="ej. Carlos Soto"
                      autoFocus
                      className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>

              {/* Rate limit / Cooldown / Error alert */}
              {submitError && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-3.5 flex items-start gap-2.5 text-xs text-amber-900 shadow-sm animate-slide-up">
                  <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-bold text-amber-950">Atención</p>
                    <p className="text-amber-800 leading-relaxed">{submitError}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer button */}
        <div className="border-t border-gray-100 p-4 shrink-0 bg-white">
          {step === 3 ? (
            <button
              type="button"
              onClick={() => canProceed && setStep(step + 1)}
              disabled={!canProceed}
              className={`w-full rounded-2xl py-3.5 font-bold transition shadow-sm flex items-center justify-center gap-1.5 ${
                canProceed
                  ? 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]'
                  : 'cursor-not-allowed bg-gray-100 text-gray-400'
              }`}
            >
              <span className="truncate max-w-[320px]">
                {detectedAddress ? `Confirmar: ${detectedAddress} →` : 'Confirmar esta ubicación →'}
              </span>
            </button>
          ) : step < 4 ? (
            <button
              type="button"
              onClick={() => canProceed && setStep(step + 1)}
              disabled={!canProceed}
              className={`w-full rounded-2xl py-3.5 font-bold transition shadow-sm ${
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
              className="w-full rounded-2xl bg-green-600 py-3.5 font-bold text-white shadow-sm transition hover:bg-green-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
            >
              {isSubmitting ? 'Guardando reporte...' : 'Enviar reporte'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
