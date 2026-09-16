import { useState } from 'react';
import {
  CheckCircle2,
  MapPin,
  Calendar,
  X,
  Users,
  Ban,
  Wrench,
  RefreshCw,
  AlertCircle,
  Construction,
} from 'lucide-react';
import type { ReportEvent, EventStatus } from '@/data/mockEvents';
import { severityConfig } from '@/data/mockEvents';
import { getDetailModalImageUrl } from '@/services/cloudinaryService';

interface DetailModalProps {
  event: ReportEvent;
  onClose: () => void;
  onConfirm: (id: string) => void;
  onVote: (category: EventStatus, tipoIntervencion?: string) => void;
}

const calculateDaysAgo = (dateStr: string) => {
  const parts = dateStr.split('-');
  const eventTime =
    parts.length === 3
      ? new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).getTime()
      : new Date(dateStr).getTime();
  const diffTime = Date.now() - eventTime;
  return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
};

const formatCLDate = (dateStr: string) => {
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    return new Date(dateStr).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

export default function DetailModal({
  event,
  onClose,
  onConfirm,
  onVote,
}: DetailModalProps) {
  const [isAddingIntervention, setIsAddingIntervention] = useState(false);
  const [interventionText, setInterventionText] = useState('');
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [dragOffsetY, setDragOffsetY] = useState(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartY(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY === null) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartY;
    if (diff > 0) {
      setDragOffsetY(diff);
    }
  };

  const handleTouchEnd = () => {
    if (dragOffsetY > 90) {
      onClose();
    }
    setTouchStartY(null);
    setDragOffsetY(0);
  };

  const cfg = severityConfig[event.severity];
  const isResolved = event.estado === 'resuelto';
  const isPartial = event.estado === 'intervencion_parcial';
  const daysSinceLastConfirm = calculateDaysAgo(event.ultimaConfirmacion || event.date);
  const isOld = daysSinceLastConfirm >= 14 && !isResolved;

  const votes = event.estadoVotos || { activo: 0, intervencion_parcial: 0, resuelto: 0 };
  const activeVotes = votes.activo;
  const partialVotes = votes.intervencion_parcial;
  const resolvedVotes = votes.resuelto;

  const hasPendingVotes =
    (activeVotes > 0 && activeVotes < 3) ||
    (partialVotes > 0 && partialVotes < 3) ||
    (resolvedVotes > 0 && resolvedVotes < 3);

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4 backdrop-blur-[2px] animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl overflow-hidden max-h-[90dvh] sm:max-h-[85vh] flex flex-col animate-slide-up sm:animate-scale-in transition-transform duration-75"
        style={{
          transform: dragOffsetY > 0 ? `translateY(${dragOffsetY}px)` : undefined,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle for mobile gesture */}
        <div
          className="sm:hidden flex items-center justify-center pt-2.5 pb-1.5 bg-white cursor-grab active:cursor-grabbing touch-none select-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-12 h-1.5 rounded-full bg-gray-300" />
        </div>

        {/* Scrollable Container */}
        <div className="overflow-y-auto flex-1 overscroll-contain">
          {/* Photo & top badges */}
          <div className="relative h-48 sm:h-56">
            <img
              src={getDetailModalImageUrl(event.photo)}
              alt={event.title}
              className={`h-full w-full object-cover transition duration-300 ${
                isResolved ? 'grayscale-[40%]' : ''
              }`}
            />
            <button
              onClick={onClose}
              aria-label="Cerrar modal"
              className="absolute top-3 right-3 rounded-full bg-black/40 p-2 text-white backdrop-blur-sm transition hover:bg-black/60"
            >
              <X size={20} />
            </button>

            <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-2">
              {isResolved ? (
                <div className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-lg">
                  <CheckCircle2 size={15} />
                  Reparado • {formatCLDate(event.ultimaConfirmacion || event.date)}
                </div>
              ) : isPartial ? (
                <div className="flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1.5 text-xs font-bold text-white shadow-lg">
                  <Construction size={15} />
                  Intervención parcial
                </div>
              ) : (
                <div className={`flex items-center gap-2 rounded-full ${cfg.bg} px-3 py-1.5 text-sm font-semibold text-white shadow-lg`}>
                  <span className="h-2 w-2 rounded-full bg-white" />
                  {cfg.label}
                </div>
              )}

              {event.tipo === 'corte_calle' && (
                <div className="flex items-center gap-1.5 rounded-full bg-black/70 backdrop-blur-md px-3 py-1.5 text-xs font-bold text-white shadow-lg">
                  <Ban size={14} className="text-red-400" />
                  Corte de calle
                </div>
              )}
            </div>
          </div>

        <div className="p-5 space-y-4">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-gray-900">{event.title}</h2>
              {isResolved ? (
                <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                  Resuelto
                </span>
              ) : isPartial ? (
                <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                  Intervención parcial
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-gray-600">{event.description}</p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <MapPin size={14} />
              {event.lat.toFixed(4)}, {event.lng.toFixed(4)}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar size={14} />
              Reportado: {formatCLDate(event.date)}
            </span>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2.5 text-sm text-gray-600">
            <Users size={16} className="text-gray-400" />
            <span>Reportado por <strong className="text-gray-800">{event.reporter}</strong></span>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-blue-50 px-4 py-3">
            <span className="text-sm font-medium text-blue-900">
              {event.confirmations} persona{event.confirmations !== 1 ? 's' : ''} confirmó{event.confirmations !== 1 ? 'aron' : ''} este reporte
            </span>
            {event.yaConfirme && (
              <span className="flex items-center gap-1 text-sm font-semibold text-green-600">
                <CheckCircle2 size={16} /> Confirmado
              </span>
            )}
          </div>

          {/* Status-specific informative banners */}
          {isResolved ? (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3.5 text-center">
              <p className="flex items-center justify-center gap-2 text-sm font-bold text-emerald-800">
                <CheckCircle2 size={18} className="text-emerald-600" />
                Problema reparado completamente
              </p>
              <p className="mt-0.5 text-xs text-emerald-700">
                Este reporte fue marcado como resuelto el {formatCLDate(event.ultimaConfirmacion || event.date)}.
              </p>
            </div>
          ) : isPartial ? (
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3.5 text-left">
              <p className="flex items-center gap-2 text-xs font-bold text-amber-900">
                <Construction size={16} className="text-amber-600" />
                {event.tipoIntervencion
                  ? `Intervención: ${event.tipoIntervencion}`
                  : 'Intervención parcial registrada'}
                {' • hace '}
                {daysSinceLastConfirm === 0 ? 'hoy' : `${daysSinceLastConfirm} días`}
              </p>
              <p className="mt-0.5 text-[11px] text-amber-800">
                Se aplicó una medida provisoria en la vía mientras se efectúa la reparación definitiva.
              </p>
            </div>
          ) : null}

          {/* Reconfirmation / Consensus Voting actions */}
          {!isResolved && isOld ? (
            isAddingIntervention ? (
              <div className="space-y-3 rounded-2xl bg-amber-50/90 border-2 border-amber-300 p-3.5 animate-slide-up">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900">
                    ¿Qué medida o intervención se realizó?
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAddingIntervention(false)}
                    className="text-xs font-semibold text-gray-500 hover:text-gray-700"
                  >
                    Cancelar
                  </button>
                </div>
                <input
                  type="text"
                  value={interventionText}
                  onChange={(e) => setInterventionText(e.target.value)}
                  placeholder="ej. sacos de arena, señalización, cono provisorio"
                  className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-xs outline-none focus:ring-2 focus:ring-amber-400"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => {
                    onVote('intervencion_parcial', interventionText.trim() || undefined);
                    setIsAddingIntervention(false);
                  }}
                  className="w-full rounded-xl bg-amber-600 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-amber-700 active:scale-95"
                >
                  Votar intervención parcial (+1)
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2.5 rounded-xl bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-900">
                  <AlertCircle size={16} className="text-amber-600 shrink-0" />
                  <span>
                    {event.yaVoteEstado
                      ? 'Ya registraste tu voto sobre el estado de este reporte.'
                      : `Han pasado ${daysSinceLastConfirm} días sin confirmar. Vota para actualizar el estado del reporte:`}
                  </span>
                </div>

                {/* 3 Voting buttons with progress counts */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => onVote('activo')}
                    disabled={event.yaVoteEstado}
                    className={`flex flex-col items-center justify-between gap-1.5 rounded-2xl p-3 text-center text-xs font-bold transition shadow-md ${
                      event.yaVoteEstado
                        ? 'cursor-default bg-gray-100 text-gray-400 shadow-none'
                        : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <RefreshCw size={15} />
                      <span>Sigue igual</span>
                    </div>
                    {activeVotes > 0 && activeVotes < 3 ? (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        event.yaVoteEstado ? 'bg-gray-200 text-gray-600' : 'bg-blue-800/80 text-blue-100'
                      }`}>
                        {activeVotes}/3 votos
                      </span>
                    ) : null}
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsAddingIntervention(true)}
                    disabled={event.yaVoteEstado}
                    className={`flex flex-col items-center justify-between gap-1.5 rounded-2xl p-3 text-center text-xs font-bold transition shadow-md ${
                      event.yaVoteEstado
                        ? 'cursor-default bg-gray-100 text-gray-400 shadow-none'
                        : 'bg-amber-500 text-white hover:bg-amber-600 active:scale-[0.98]'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <Construction size={15} />
                      <span>Intervención</span>
                    </div>
                    {partialVotes > 0 && partialVotes < 3 ? (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        event.yaVoteEstado ? 'bg-gray-200 text-gray-600' : 'bg-amber-700/80 text-amber-100'
                      }`}>
                        {partialVotes}/3 votos
                      </span>
                    ) : null}
                  </button>

                  <button
                    type="button"
                    onClick={() => onVote('resuelto')}
                    disabled={event.yaVoteEstado}
                    className={`flex flex-col items-center justify-between gap-1.5 rounded-2xl p-3 text-center text-xs font-bold transition shadow-md ${
                      event.yaVoteEstado
                        ? 'cursor-default bg-gray-100 text-gray-400 shadow-none'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.98]'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <Wrench size={15} />
                      <span>Reparado</span>
                    </div>
                    {resolvedVotes > 0 && resolvedVotes < 3 ? (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        event.yaVoteEstado ? 'bg-gray-200 text-gray-600' : 'bg-emerald-800/80 text-emerald-100'
                      }`}>
                        {resolvedVotes}/3 votos
                      </span>
                    ) : null}
                  </button>
                </div>

                {/* Subtle progress indicator below buttons */}
                {hasPendingVotes && (
                  <div className="rounded-xl bg-gray-50 border border-gray-200/80 p-3 text-xs text-gray-600 space-y-1.5 animate-fade-in">
                    <p className="font-semibold text-gray-700">Consenso comunitario (umbral: 3 votos):</p>
                    <div className="space-y-1">
                      {resolvedVotes > 0 && resolvedVotes < 3 && (
                        <div className="flex items-center justify-between text-emerald-700 font-medium">
                          <span>{resolvedVotes} de 3 confirmaciones para marcar como reparado</span>
                          <span className="font-bold text-emerald-800">{resolvedVotes}/3</span>
                        </div>
                      )}
                      {partialVotes > 0 && partialVotes < 3 && (
                        <div className="flex items-center justify-between text-amber-700 font-medium">
                          <span>{partialVotes} de 3 confirmaciones para intervención parcial</span>
                          <span className="font-bold text-amber-800">{partialVotes}/3</span>
                        </div>
                      )}
                      {activeVotes > 0 && activeVotes < 3 && (
                        <div className="flex items-center justify-between text-blue-700 font-medium">
                          <span>{activeVotes} de 3 confirmaciones para mantener activo</span>
                          <span className="font-bold text-blue-800">{activeVotes}/3</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          ) : !isResolved ? (
            <button
              onClick={() => onConfirm(event.id)}
              disabled={event.yaConfirme}
              className={`w-full rounded-2xl py-3.5 font-semibold transition ${
                event.yaConfirme
                  ? 'cursor-default bg-gray-100 text-gray-400'
                  : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]'
              }`}
            >
              {event.yaConfirme ? 'Ya confirmaste este reporte' : 'Confirmar reporte'}
            </button>
          ) : null}
        </div>
        </div>
      </div>
    </div>
  );
}

