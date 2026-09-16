import { useState, useEffect } from 'react';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/firebase';
import MapView from '@/components/MapView';
import DetailModal from '@/components/DetailModal';
import ReportFlow from '@/components/ReportFlow';
import StatsBar from '@/components/StatsBar';
import ReportButton from '@/components/ReportButton';
import ProximityAlertBanner from '@/components/ProximityAlertBanner';
import AdminPanel from '@/components/AdminPanel';
import { useProximityAlert } from '@/hooks/useProximityAlert';
import type { ReportEvent, EventStatus } from '@/data/mockEvents';
import {
  subscribeToEvents,
  createEvent,
  confirmEvent,
  voteEventStatus,
} from '@/services/eventsService';

export default function App() {
  const checkIsAdminRoute = () => {
    if (typeof window === 'undefined') return false;
    const path = window.location.pathname.toLowerCase().replace(/\/$/, '');
    const hash = window.location.hash.toLowerCase().replace(/\/$/, '');
    return path === '/admin' || hash === '#/admin' || hash === '#admin';
  };

  const [isAdminRoute, setIsAdminRoute] = useState(checkIsAdminRoute);
  const [events, setEvents] = useState<ReportEvent[]>([]);
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

  const totalReporters = new Set(events.map((e) => e.reporter || e.uid || 'Tú')).size;
  const criticalCount = events.filter((e) => e.severity === 'critico' && e.estado !== 'resuelto').length;

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
    }
  };

  if (isAdminRoute) {
    return <AdminPanel />;
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-gray-100">
      <MapView
        events={events}
        onSelect={setSelectedEvent}
        newReportLocation={newReportLocation}
        userLocation={currentPosition}
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

      <StatsBar
        totalEvents={events.length}
        totalReporters={totalReporters}
        criticalCount={criticalCount}
      />

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
        <ReportFlow
          onClose={() => setShowReport(false)}
          onSubmit={handleNewReport}
          currentUid={userId}
        />
      )}
    </div>
  );
}
