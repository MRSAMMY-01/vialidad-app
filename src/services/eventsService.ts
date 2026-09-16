import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  increment,
  arrayUnion,
} from 'firebase/firestore';
import { db } from '@/firebase';
import type { ReportEvent, EventStatus } from '@/data/mockEvents';

const EVENTS_COLLECTION = 'eventos';
export const VOTE_THRESHOLD = 3;

/**
 * Subscribes to real-time updates from Firestore 'eventos' collection.
 */
export function subscribeToEvents(
  onUpdate: (events: ReportEvent[]) => void,
  currentUid?: string | null
) {
  const colRef = collection(db, EVENTS_COLLECTION);

  return onSnapshot(
    colRef,
    (snapshot) => {
      const items: ReportEvent[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const isAuthor = !!currentUid && data.uid === currentUid;
        const yaConfirme = !!currentUid && (data.confirmedUids?.includes(currentUid) ?? false);
        const yaVoteEstado =
          !!currentUid && (isAuthor || (data.votedUids?.includes(currentUid) ?? false));

        return {
          id: docSnap.id,
          lat: Number(data.lat) || 0,
          lng: Number(data.lng) || 0,
          tipo: data.tipo || 'bache',
          severity: data.severity || 'moderado',
          estado: data.estado || 'activo',
          tipoIntervencion: data.tipoIntervencion || undefined,
          ultimaConfirmacion:
            data.ultimaConfirmacion || data.date || new Date().toISOString().split('T')[0],
          estadoVotos: data.estadoVotos || {
            activo: 0,
            intervencion_parcial: 0,
            resuelto: 0,
          },
          title: data.title || '',
          description: data.description || '',
          date: data.date || new Date().toISOString().split('T')[0],
          photo: data.photo || '',
          reporter: data.reporter || 'Vecino/a de Chillán',
          confirmations: Number(data.confirmations) || 0,
          yaConfirme,
          yaVoteEstado,
          uid: data.uid,
          confirmedUids: data.confirmedUids || [],
          votedUids: data.votedUids || [],
        };
      });

      onUpdate(items);
    },
    (error) => {
      console.error('Error listening to Firestore eventos:', error);
    }
  );
}

/**
 * Creates a new report document in Firestore.
 */
export async function createEvent(
  newEvent: Omit<ReportEvent, 'id' | 'yaConfirme' | 'yaVoteEstado'> & { uid?: string }
) {
  const colRef = collection(db, EVENTS_COLLECTION);
  const docData = {
    ...newEvent,
    confirmations: 0,
    confirmedUids: [],
    votedUids: [],
    createdAt: new Date().toISOString(),
  };

  const docRef = await addDoc(colRef, docData);
  return docRef.id;
}

/**
 * Increments confirmation count on an existing event with duplicate protection.
 */
export async function confirmEvent(
  eventId: string,
  currentUid?: string | null,
  existingConfirmedUids?: string[]
) {
  // Prevent duplicate confirmation from same uid
  if (currentUid && existingConfirmedUids?.includes(currentUid)) {
    console.warn('El usuario ya confirmó este reporte.');
    return;
  }

  const eventRef = doc(db, EVENTS_COLLECTION, eventId);
  const today = new Date().toISOString().split('T')[0];

  const updateData: Record<string, any> = {
    confirmations: increment(1),
    ultimaConfirmacion: today,
  };

  if (currentUid) {
    updateData.confirmedUids = arrayUnion(currentUid);
  }

  await updateDoc(eventRef, updateData);
}

/**
 * Registers a status consensus vote using Firestore increment() with duplicate protection.
 * If category reaches 3 votes (VOTE_THRESHOLD), officially updates estado.
 */
export async function voteEventStatus(
  eventId: string,
  category: EventStatus,
  currentVotes: { activo: number; intervencion_parcial: number; resuelto: number },
  tipoIntervencion?: string,
  currentUid?: string | null,
  existingVotedUids?: string[]
) {
  // Prevent duplicate voting from same uid
  if (currentUid && existingVotedUids?.includes(currentUid)) {
    console.warn('El usuario ya emitió un voto en este reporte.');
    return;
  }

  const eventRef = doc(db, EVENTS_COLLECTION, eventId);
  const today = new Date().toISOString().split('T')[0];
  const newVoteCount = (currentVotes[category] || 0) + 1;

  const updateData: Record<string, any> = {
    [`estadoVotos.${category}`]: increment(1),
    confirmations: increment(1),
    ultimaConfirmacion: today,
  };

  if (newVoteCount >= VOTE_THRESHOLD) {
    updateData.estado = category;
    if (category === 'intervencion_parcial' && tipoIntervencion) {
      updateData.tipoIntervencion = tipoIntervencion;
    }
  } else if (category === 'intervencion_parcial' && tipoIntervencion) {
    updateData.tipoIntervencion = tipoIntervencion;
  }

  if (currentUid) {
    updateData.votedUids = arrayUnion(currentUid);
  }

  await updateDoc(eventRef, updateData);
}

/**
 * Permanently deletes a report document from Firestore (Admin only).
 */
export async function deleteEvent(eventId: string) {
  const eventRef = doc(db, EVENTS_COLLECTION, eventId);
  await deleteDoc(eventRef);
}

