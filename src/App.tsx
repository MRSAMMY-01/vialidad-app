import { useState, useEffect, lazy, Suspense } from 'react';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/firebase';
import MapView from '@/components/MapView';
import DetailModal from '@/components/DetailModal';
import StatsBar from '@/components/StatsBar';
import ReportButton from '@/components/ReportButton';
import SupportButton from '@/components/SupportButton';
import ProximityAlertBanner from '@/components/ProximityAlertBanner';
import { useProximityAlert } from '@/hooks/useProximityAlert';
import type { ReportEvent, EventStatus, Severity } from '@/data/mockEvents';
import {
  subscribeToEvents,
  createEvent,
  confirmEvent,
  voteEventStatus,
} from '@/services/eventsService';

// Code-split dynamic chunks
const AdminPanel = lazy(() => import('@/components/AdminPanel'));
const ReportFlow = lazy(() => import('@/components/ReportFlow'));

// Helper to extract street names from title/description for unique affected streets calculation
function extractStreetName(title: string, description: string): string {
  const match = title.match(/(?:en\s+|calle\s+|av\.?\s+|avenida\s+|psje\.?\s+|pasaje\s+)([^,.-]+)/i);
  if (match && match[1]) {
    return match[1].trim().toLowerCase();
  }
  return title.trim().toLowerCase();
}

export default function App() {
  const checkIsAdminRoute = () => {
    if (typeof window === 'undefined') return false;
    const path = window.location.pathname.toLowerCase().replace(/\/$/, '');
    const hash = window.location.hash.toLowerCase().replace(/\/$/, '');
    return path === '/admin' || hash === '#/admin' || hash === '#admin';
  };

  const [isAdminRoute, setIsAdminRoute] = useState(checkIsAdminRoute);
  const [events, setEvents] = useState<ReportEvent[]>([]);
  const [severityFilter, setSeverityFilter] = useState<Severity | 'todos'>('todos');
  const [selectedEvent, setSelectedEvent] = useState<ReportEvent | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [newReportLocation, setNewReportLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const handleLocationChange = () => {
      setIsAdminRoute(checkIsAdminRoute());
    };
    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  const { currentPosition, activeAlert, dismissAlert } = useProximityAlert(events);

  const activeEvents = events.filter((e) => e.estado !== 'resuelto');
  const affectedStreetsCount = new Set(
    activeEvents.map((e) => extractStreetName(e.title, e.description)).filter(Boolean)
  ).size;
  const criticalCount = events.filter((e) => e.severity === 'critico' && e.estado !== 'resuelto').length;

  const severityCounts = {
    todos: events.length,
    critico: events.filter((e) => e.severity === 'critico').length,
    moderado: events.filter((e) => e.severity === 'moderado').length,
    leve: events.filter((e) => e.severity === 'leve').length,
  };

  const filteredEvents = events.filter((e) => {
    if (severityFilter !== 'todos' && e.severity !== severityFilter) {
      return false;
    }
    return true;
  });

  // 1. Silent anonymous authentication on mount (only for map/public view)
  useEffect(() => {
    if (isAdminRoute) return;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        try {
          const cred = await signInAnonymously(auth);
          setUserId(cred.user.uid);
        } catch (error) {
          console.error('Error signing in anonymously to Firebase:', error);
        }
      }
    });

    return () => unsubscribeAuth();
  }, [isAdminRoute]);

  // 2. Real-time Firestore sync
  useEffect(() => {
    // Listen to real-time events in Firestore
    const unsubscribeEvents = subscribeToEvents((loadedEvents) => {
      setEvents(loadedEvents);

      // Keep selected event synced in real-time if open
      setSelectedEvent((prev) => {
        if (!prev) return null;
        return loadedEvents.find((e) => e.id === prev.id) || prev;
      });
    }, userId);

    return () => unsubscribeEvents();
  }, [userId]);

  // Handlers communicating directly with Firestore
  const handleConfirm = async (id: string) => {
    try {
      await confirmEvent(id, userId, selectedEvent?.confirmedUids);
    } catch (err) {
      console.error('Error al confirmar reporte en Firestore:', err);
    }
  };

  const handleVote = async (category: EventStatus, tipoIntervencion?: string) => {
    if (!selectedEvent) return;
    try {
      await voteEventStatus(
        selectedEvent.id,
        category,
        selectedEvent.estadoVotos || { activo: 0, intervencion_parcial: 0, resuelto: 0 },
        tipoIntervencion,
        userId,
        selectedEvent.votedUids
      );
    } catch (err) {
      console.error('Error al registrar voto en Firestore:', err);
    }
  };

  const handleNewReport = async (
    eventData: Omit<ReportEvent, 'id' | 'yaConfirme' | 'yaVoteEstado'>
  ) => {
    try {
      const newId = await createEvent({
        ...eventData,
        uid: userId || undefined,
      });
      setNewReportLocation({ lat: eventData.lat, lng: eventData.lng });
      setShowReport(false);

      // Focus on newly created report
      setTimeout(() => {
        const created: ReportEvent = {
          ...eventData,
          id: newId,
          yaConfirme: false,
          yaVoteEstado: true,
        };
        setSelectedEvent(created);
      }, 300);
    } catch (err) {
      console.error('Error al crear reporte en Firestore:', err);
      throw err;
    }
  };

  if (isAdminRoute) {
    return (
      <Suspense
        fallback={
          <div className="flex h-screen w-screen items-center justify-center bg-gray-900 text-white">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              <p className="text-xs text-gray-400 font-medium">Cargando panel de administración...</p>
            </div>
          </div>
        }
      >
        <AdminPanel />
      </Suspense>
    );
  }

  return (
    <main className="relative h-[100dvh] w-screen overflow-hidden bg-gray-100">
      <MapView
        events={filteredEvents}
        onSelect={setSelectedEvent}
        newReportLocation={newReportLocation}
        userLocation={currentPosition}
        selectedSeverity={severityFilter}
        onSelectSeverity={setSeverityFilter}
        severityCounts={severityCounts}
      />

      {/* Show Proximity Alert Banner if active */}
      {activeAlert && (
        <ProximityAlertBanner
          alert={activeAlert}
          onDismiss={dismissAlert}
          onSelect={() => {
            setSelectedEvent(activeAlert.event);
            dismissAlert();
          }}
        />
      )}

      {/* Top Header: Clean Stats Bar */}
      <header className="absolute top-3 left-1/2 z-[1000] -translate-x-1/2 pointer-events-auto">
        <StatsBar
          totalEvents={events.length}
          affectedStreetsCount={affectedStreetsCount}
          criticalCount={criticalCount}
        />
      </header>

      {/* Support Project Button (Bottom-Left) */}
      <SupportButton />

      {/* Report Button (Bottom-Right) */}
      <ReportButton onClick={() => setShowReport(true)} />

      {selectedEvent && (
        <DetailModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onConfirm={handleConfirm}
          onVote={handleVote}
        />
      )}

      {showReport && (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/40 backdrop-blur-xs animate-fade-in p-0 sm:p-4">
              <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white p-8 flex flex-col items-center justify-center gap-3 shadow-2xl">
                <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
                <p className="text-xs font-semibold text-gray-600">Cargando formulario...</p>
              </div>
            </div>
          }
        >
          <ReportFlow
            onClose={() => setShowReport(false)}
            onSubmit={handleNewReport}
            currentUid={userId}
          />
        </Suspense>
      )}
    </main>
  );
}
