import { doc, setDoc, getDocs, collection, serverTimestamp, increment } from 'firebase/firestore';
import { db } from '@/firebase';

const SESSIONS_COLLECTION = 'sessions';

export interface SessionMetrics {
  totalUniqueUsers: number;
  returningUsers: number;
  totalSessions: number;
}

/**
 * Registers a session for the user for the current date (YYYY-MM-DD).
 * Increments visitCount and updates lastSeenAt atomically.
 */
export async function registerSession(uid: string): Promise<void> {
  if (!uid) return;

  try {
    const today = new Date().toISOString().split('T')[0];
    const sessionId = `${uid}_${today}`;
    const sessionRef = doc(db, SESSIONS_COLLECTION, sessionId);

    await setDoc(
      sessionRef,
      {
        uid,
        date: today,
        lastSeenAt: serverTimestamp(),
        visitCount: increment(1),
      },
      { merge: true }
    );
  } catch (err) {
    // Silent fail so tracking never disrupts UX
    console.warn('Error registrando sesión de usuario:', err);
  }
}

/**
 * Fetches and calculates session analytics for the Admin Panel.
 * Reads all documents from 'sessions' and groups by uid on client.
 */
export async function getSessionMetrics(): Promise<SessionMetrics> {
  try {
    const colRef = collection(db, SESSIONS_COLLECTION);
    const snapshot = await getDocs(colRef);

    const userDatesMap = new Map<string, Set<string>>();

    snapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();
      const uid = data.uid;
      const date = data.date;

      if (uid && date) {
        if (!userDatesMap.has(uid)) {
          userDatesMap.set(uid, new Set());
        }
        userDatesMap.get(uid)!.add(date);
      }
    });

    const totalUniqueUsers = userDatesMap.size;
    let returningUsers = 0;

    userDatesMap.forEach((datesSet) => {
      if (datesSet.size > 1) {
        returningUsers += 1;
      }
    });

    return {
      totalUniqueUsers,
      returningUsers,
      totalSessions: snapshot.docs.length,
    };
  } catch (err) {
    console.error('Error fetching session metrics in AdminPanel:', err);
    return {
      totalUniqueUsers: 0,
      returningUsers: 0,
      totalSessions: 0,
    };
  }
}
