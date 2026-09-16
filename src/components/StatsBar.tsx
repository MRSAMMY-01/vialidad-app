import { AlertTriangle, Users, MapPin } from 'lucide-react';

interface StatsBarProps {
  totalEvents: number;
  totalReporters: number;
  criticalCount: number;
}

export default function StatsBar({ totalEvents, totalReporters, criticalCount }: StatsBarProps) {
  return (
    <div className="absolute top-3 left-1/2 z-[1000] -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-2xl bg-white/95 px-4 py-2.5 shadow-lg backdrop-blur-md">
        <div className="flex items-center gap-1.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100">
            <MapPin size={15} className="text-blue-600" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold text-gray-900">{totalEvents}</p>
            <p className="text-[10px] text-gray-500">reportes</p>
          </div>
        </div>

        <div className="h-8 w-px bg-gray-200" />

        <div className="flex items-center gap-1.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-100">
            <Users size={15} className="text-green-600" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold text-gray-900">{totalReporters}</p>
            <p className="text-[10px] text-gray-500">usuarios</p>
          </div>
        </div>

        <div className="h-8 w-px bg-gray-200" />

        <div className="flex items-center gap-1.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-100">
            <AlertTriangle size={15} className="text-red-600" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold text-gray-900">{criticalCount}</p>
            <p className="text-[10px] text-gray-500">críticos</p>
          </div>
        </div>
      </div>
    </div>
  );
}
