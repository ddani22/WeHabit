import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import FeedService from './feedService'; // <--- IMPORTANTE
import UserService from './userService';

// Helper Fecha Local
const getLocalTodayDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const ChallengeService = {

  // ... (createChallenge, getMyChallenges, findActiveChallengesByHabit se quedan igual) ...
  createChallenge: async (hostId, opponentIds, challengeName, durationDays = 7) => {
    // ... (código existente de crear reto) ...
    // REPLICA TU CÓDIGO EXISTENTE DE CREATE O COPIA EL DE TURNOS ANTERIORES SI LO NECESITAS
    // AQUÍ SOLO PONGO LO QUE CAMBIA EN CHECK-IN/UNDO
    try {
      const batch = writeBatch(db);
      const challengeRef = doc(collection(db, 'challenges'));
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(startDate.getDate() + durationDays);
      const allParticipantIds = [hostId, ...opponentIds];
      const participantsData = allParticipantIds.map(uid => ({
        userId: uid, currentScore: 0, hasFailed: false, lastCompletedDate: null
      }));
      const newChallenge = {
        challengeName, durationDays,
        startDate: startDate.toISOString(), endDate: endDate.toISOString(),
        participants: participantsData, participantIds: allParticipantIds, isActive: true
      };
      batch.set(challengeRef, newChallenge);
      await batch.commit();
      return { id: challengeRef.id, ...newChallenge };
    } catch (error) { throw error; }
  },

  getMyChallenges: async (userId) => {
    const q = query(collection(db, 'challenges'), where("participantIds", "array-contains", userId), where("isActive", "==", true));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  findActiveChallengesByHabit: async (userId, habitName) => {
    try {
      const q = query(collection(db, 'challenges'), where("participantIds", "array-contains", userId), where("isActive", "==", true), where("challengeName", "==", habitName));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => d.id);
    } catch (error) { return []; }
  },

  incrementScore: async (challengeId, userId) => {
    return ChallengeService.checkInChallenge(challengeId, userId);
  },

  /**
   * CHECK-IN CON LOG AL FEED
   */
  checkInChallenge: async (challengeId, userId) => {
    try {
      const challengeRef = doc(db, 'challenges', challengeId);
      const snap = await getDoc(challengeRef);
      if (!snap.exists()) return;

      const data = snap.data();
      const today = getLocalTodayDate();
      const targetScore = data.durationDays;
      let xpToAward = 0;
      let feedEvent = null; // Para guardar datos del feed

      const updatedParticipants = data.participants.map(p => {
        if (p.userId === userId) {
          if (p.lastCompletedDate === today) return p; // Ya hecho

          const newScore = (p.currentScore || 0) + 1;

          // Preparamos datos para el Feed
          feedEvent = {
            type: 'challenge_progress',
            title: `Avanzó en reto: ${data.challengeName}`,
            desc: `${newScore}/${targetScore} días completados`
          };

          if (newScore === targetScore && p.currentScore !== targetScore) {
            xpToAward = 200;
            feedEvent = {
              type: 'challenge_won',
              title: `¡GANÓ EL RETO: ${data.challengeName}! 🏆`,
              desc: `Completó los ${targetScore} días.`
            };
          }

          return { ...p, currentScore: newScore, lastCompletedDate: today };
        }
        return p;
      });

      await updateDoc(challengeRef, { participants: updatedParticipants });

      // XP
      if (xpToAward > 0) UserService.addExperience(userId, xpToAward).catch(console.error);

      // FEED (FIRE & FORGET)
      if (feedEvent) {
        // Recuperamos datos de usuario para el feed
        const userDoc = await getDoc(doc(db, 'users', userId));
        const userData = userDoc.exists() ? userDoc.data() : {};

        FeedService.logActivity(
          userId,
          userData.username || 'Usuario',
          userData.avatar || null,
          feedEvent.type,
          feedEvent.title,
          feedEvent.desc,
          challengeId // <--- IMPORTANTE: Enviamos ID para poder borrarlo
        );
      }

    } catch (error) { console.error(error); throw error; }
  },

  /**
   * UNDO CON LIMPIEZA DE FEED
   */
  undoCheckInChallenge: async (challengeId, userId) => {
    try {
      const challengeRef = doc(db, 'challenges', challengeId);
      const snap = await getDoc(challengeRef);
      if (!snap.exists()) return;

      const data = snap.data();
      const today = getLocalTodayDate();

      const updatedParticipants = data.participants.map(p => {
        if (p.userId === userId) {
          if (p.lastCompletedDate !== today) return p;

          return {
            ...p,
            currentScore: Math.max(0, (p.currentScore || 0) - 1),
            lastCompletedDate: null
          };
        }
        return p;
      });

      await updateDoc(challengeRef, { participants: updatedParticipants });

      // --- LIMPIEZA DEL FEED ---
      // Borramos cualquier log de 'challenge_progress' o 'challenge_won' asociado a este reto
      await FeedService.removeLog(userId, 'challenge_progress', challengeId);
      await FeedService.removeLog(userId, 'challenge_won', challengeId);

    } catch (error) { console.error(error); }
  },

  giveUpChallenge: async (challengeId, userId) => {
    try {
      const challengeRef = doc(db, 'challenges', challengeId);
      const snap = await getDoc(challengeRef);
      if (!snap.exists()) return;
      const data = snap.data();
      const updated = data.participants.map(p =>
        p.userId === userId ? { ...p, hasFailed: true } : p
      );
      await updateDoc(challengeRef, { participants: updated });
    } catch (error) { throw error; }
  },

  deleteChallenge: async (id) => {
    try { await deleteDoc(doc(db, 'challenges', id)); } catch (error) { throw error; }
  }
};

export default ChallengeService;