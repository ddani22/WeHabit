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
import UserService from './userService';

// Helper para obtener la fecha de hoy (YYYY-MM-DD)
const getTodayDate = () => new Date().toISOString().split('T')[0];

const ChallengeService = {

  /**
   * Crea un reto MULTIJUGADOR.
   */
  createChallenge: async (hostId, opponentIds, challengeName, durationDays = 7) => {
    try {
      const batch = writeBatch(db);
      const challengeRef = doc(collection(db, 'challenges'));

      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(startDate.getDate() + durationDays);

      const allParticipantIds = [hostId, ...opponentIds];

      // Inicializamos a los participantes con fecha vacía
      const participantsData = allParticipantIds.map(uid => ({
        userId: uid,
        currentScore: 0,
        hasFailed: false,
        lastCompletedDate: null // <--- ESTO ES CLAVE
      }));

      const newChallenge = {
        challengeName,
        durationDays,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        participants: participantsData,
        participantIds: allParticipantIds,
        isActive: true
      };

      batch.set(challengeRef, newChallenge);
      await batch.commit();

      return { id: challengeRef.id, ...newChallenge };
    } catch (error) {
      console.error("Error creando reto:", error);
      throw error;
    }
  },

  /**
   * Obtiene los retos activos del usuario.
   */
  getMyChallenges: async (userId) => {
    try {
      const q = query(
        collection(db, 'challenges'),
        where("participantIds", "array-contains", userId),
        where("isActive", "==", true)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error("Error obteniendo retos:", error);
      throw error;
    }
  },

  /**
   * --- FUNCIÓN NUEVA: CHECK-IN DIARIO EN EL RETO ---
   * Marca el día de hoy, suma 1 punto y guarda la fecha.
   */
  checkInChallenge: async (challengeId, userId) => {
    try {
      const challengeRef = doc(db, 'challenges', challengeId);
      const snap = await getDoc(challengeRef);
      if (!snap.exists()) return;

      const data = snap.data();
      const today = getTodayDate();
      const targetScore = data.durationDays;

      const updatedParticipants = data.participants.map(p => {
        if (p.userId === userId) {
          // Si ya está hecho hoy, no hacemos nada
          if (p.lastCompletedDate === today) return p;

          const newScore = (p.currentScore || 0) + 1;

          // Verificar Victoria
          if (newScore === targetScore && p.currentScore !== targetScore) {
            UserService.addExperience(userId, 200); // Premio XP
          }

          return {
            ...p,
            currentScore: newScore,
            lastCompletedDate: today // <--- GUARDAMOS QUE HOY SE HIZO
          };
        }
        return p;
      });

      await updateDoc(challengeRef, { participants: updatedParticipants });
    } catch (error) {
      console.error("Error check-in reto:", error);
      throw error;
    }
  },

  /**
   * --- FUNCIÓN NUEVA: DESHACER CHECK-IN ---
   * Resta el punto y borra la fecha de hoy.
   */
  undoCheckInChallenge: async (challengeId, userId) => {
    try {
      const challengeRef = doc(db, 'challenges', challengeId);
      const snap = await getDoc(challengeRef);
      if (!snap.exists()) return;

      const data = snap.data();
      const today = getTodayDate();

      const updatedParticipants = data.participants.map(p => {
        if (p.userId === userId) {
          // Solo restamos si la última vez fue HOY
          if (p.lastCompletedDate !== today) return p;

          return {
            ...p,
            currentScore: Math.max(0, (p.currentScore || 0) - 1),
            lastCompletedDate: null // <--- BORRAMOS LA FECHA
          };
        }
        return p;
      });

      await updateDoc(challengeRef, { participants: updatedParticipants });
    } catch (error) {
      console.error("Error undo reto:", error);
    }
  },

  /**
   * Rendirse en un reto.
   */
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
    } catch (error) {
      console.error("Error abandonando:", error);
      throw error;
    }
  },

  /**
   * Borrar reto completo (Admin/Creador).
   */
  deleteChallenge: async (id) => {
    try {
      await deleteDoc(doc(db, 'challenges', id));
    } catch (error) {
      console.error("Error eliminando reto:", error);
      throw error;
    }
  }
};

export default ChallengeService;