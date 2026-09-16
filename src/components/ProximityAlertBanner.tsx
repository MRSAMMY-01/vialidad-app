import { useEffect } from 'react';
import { OctagonAlert, X, ChevronRight, Gauge } from 'lucide-react';
import type { ProximityAlertInfo } from '@/hooks/useProximityAlert';

interface ProximityAlertBannerProps {
  alert: ProximityAlertInfo;
  onDismiss: () => void;
  onSelect: () => void;
}

export default function ProximityAlertBanner({
  alert,
  onDismiss,
  onSelect,
}: ProximityAlertBannerProps) {
  // Auto-dismiss after 12 seconds if not interacted with
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, 12000);

    return () => clearTimeout(timer);
  }, [alert.timestamp, onDismiss]);

  return (
    <div className="absolute top-3 left-4 right-4 z-[1500] mx-auto max-w-md animate-slide-up">
      <div
        role="alert"
        aria-live="assertive"
        className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-600 via-red-600 to-red-700 p-4 text-white shadow-2xl ring-4 ring-red-500/30"
      >
        {/* Animated warning pulse glow */}
        <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-red-400 opacity-20 blur-xl animate-pulse" />

        <div className="relative flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white backdrop-blur-sm shadow-inner">
            <OctagonAlert size={26} className="text-white animate-bounce" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-red-100 bg-red-800/60 px-2 py-0.5 rounded-full">
                Alerta de proximidad
              </span>
              {alert.speedKmH > 0 && (
                <span className="flex items-center gap-1 text-[11px] text-red-100 font-medium">
                  <Gauge size={12} />
                  {alert.speedKmH} km/h
                </span>
              )}
            </div>

            <h3 className="mt-1 text-base font-extrabold leading-snug text-white">
              ⚠️ Bache crítico adelante
            </h3>

            <p className="mt-0.5 truncate text-xs font-medium text-red-100">
              {alert.event.title} • A ~{alert.distance}m
            </p>

            <div className="mt-2.5 flex items-center gap-2">
              <button
                type="button"
                onClick={onSelect}
                className="flex items-center gap-1 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-red-600 shadow-sm transition hover:bg-red-50 active:scale-95"
              >
                Ver reporte
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={onDismiss}
            aria-label="Cerrar alerta"
            className="shrink-0 rounded-full p-1 text-red-200 hover:bg-white/20 hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
