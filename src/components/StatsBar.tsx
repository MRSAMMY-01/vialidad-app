import { AlertTriangle, MapPin, Navigation } from 'lucide-react';

interface StatsBarProps {
  totalEvents: number;
  affectedStreetsCount: number;
  criticalCount: number;
}

export default function StatsBar({
  totalEvents,
  affectedStreetsCount,
  criticalCount,
}: StatsBarProps) {
  return (
    <div className="flex items-center gap-2.5 sm:gap-3.5 rounded-2xl bg-white/95 px-3.5 sm:px-4 py-2 shadow-lg backdrop-blur-md border border-gray-100/90">
      {/* Realtime Live Pulse Indicator */}
      <div className="flex items-center gap-1.5 pr-2 border-r border-gray-200/80">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">En vivo</span>
      </div>

      {/* Total Reportes */}
      <div className="flex items-center gap-1.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
          <MapPin size={13} />
        </div>
        <div className="leading-tight">
          <p className="text-xs font-bold text-gray-900">{totalEvents}</p>
          <p className="text-[9px] text-gray-500 uppercase tracking-tight">reportes</p>
        </div>
      </div>

      <div className="h-6 w-px bg-gray-200" />

      {/* Calles Afectadas */}
      <div className="flex items-center gap-1.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
          <Navigation size={13} />
        </div>
        <div className="leading-tight">
          <p className="text-xs font-bold text-gray-900">{affectedStreetsCount}</p>
          <p className="text-[9px] text-gray-500 uppercase tracking-tight">calles</p>
        </div>
      </div>

      <div className="h-6 w-px bg-gray-200" />

      {/* Críticos */}
      <div className="flex items-center gap-1.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-red-50 text-red-600">
          <AlertTriangle size={13} />
        </div>
        <div className="leading-tight">
          <p className="text-xs font-bold text-gray-900">{criticalCount}</p>
          <p className="text-[9px] text-gray-500 uppercase tracking-tight">críticos</p>
        </div>
      </div>
    </div>
  );
}
