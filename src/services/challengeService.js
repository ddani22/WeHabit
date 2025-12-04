import {
  collection,
  doc, getDoc,
  getDocs,
  query,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import UserService from './userService';

const ChallengeService = {

  /**
   * Crea un reto MULTIJUGADOR.
   * @param {string} hostId - ID del creador
   * @param {Array} opponentIds - Array con los IDs de los amigos desafiados
   */
  createChallenge: async (hostId, opponentIds, challengeName, durationDays = 7) => {
    try {
      const batch = writeBatch(db); // Iniciamos el paquete

      // 1. Preparar referencia del Reto
      const challengeRef = doc(collection(db, 'challenges'));

      // 2. Definir fechas
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(startDate.getDate() + durationDays);

      // 3. Preparar Participantes (Host + Oponentes)
      // Unimos mi ID con los de mis amigos seleccionados
      const allParticipantIds = [hostId, ...opponentIds];

      // Creamos la estructura de datos para el array de objetos
      const participantsData = allParticipantIds.map(uid => ({
        userId: uid,
        currentScore: 0,
        hasFailed: false
      }));

      const newChallenge = {
        challengeName: challengeName,
        durationDays: durationDays,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        participants: participantsData,
        participantIds: allParticipantIds, // Array simple para búsquedas
        isActive: true
      };

      // 4. Plantilla del Hábito
      const habitTemplate = {
        name: challengeName,
        frequency: [0, 1, 2, 3, 4, 5, 6],
        categoryId: 'challenges',
        categoryLabel: 'Retos',
        categoryColor: '#FF9800',
        currentStreak: 0,
        bestStreak: 0,
        isActive: true,
        icon: '⚔️',
        isChallenge: true,
        challengeId: challengeRef.id,
        lastCompletedDate: null,
        createdAt: new Date().toISOString()
      };

      // 5. ENCOLAR OPERACIONES (BATCH)

      // A) Crear el Reto
      batch.set(challengeRef, newChallenge);

      // B) Crear un Hábito para CADA participante
      allParticipantIds.forEach(uid => {
        const newHabitRef = doc(collection(db, 'habits'));
        batch.set(newHabitRef, {
          ...habitTemplate,
          userId: uid // Asignamos el hábito a este usuario
        });
      });

      // 6. Ejecutar todo
      await batch.commit();

      return { id: challengeRef.id, ...newChallenge };

    } catch (error) {
      console.error("Error creando reto grupal:", error);
      throw error;
    }
  },

  // ... (MANTÉN EL RESTO DE FUNCIONES IGUAL: getMyChallenges, incrementScore, etc.)

  getMyChallenges: async (userId) => {
    // ... (Tu código existente)
    try {
      const q = query(
        collection(db, 'challenges'),
        where("participantIds", "array-contains", userId),
        where("isActive", "==", true)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error("Error", error); throw error;
    }
  },

  incrementScore: async (challengeId, userId) => {
    try {
      const challengeRef = doc(db, 'challenges', challengeId);
      const challengeSnap = await getDoc(challengeRef);
      if (!challengeSnap.exists()) return;

      const data = challengeSnap.data();
      const targetScore = data.durationDays; // Meta para ganar

      const updatedParticipants = data.participants.map(p => {
        if (p.userId === userId) {
          const newScore = (p.currentScore || 0) + 1;

          // --- DETECTAR VICTORIA ---
          if (newScore === targetScore) {
            // ¡HAS GANADO EL RETO!
            // Solo damos puntos si acaba de llegar a la meta (para no dar dobles)
            if (p.currentScore !== targetScore) {
              UserService.addExperience(userId, 200);
            }
          }
          // -------------------------

          return { ...p, currentScore: newScore };
        }
        return p;
      });

      await updateDoc(challengeRef, { participants: updatedParticipants });
    } catch (e) { console.error(e); }
  },

  findActiveChallengesByHabit: async (userId, habitName) => {
    // ... (Tu código existente)
    try {
      const q = query(
        collection(db, 'challenges'),
        where("participantIds", "array-contains", userId),
        where("isActive", "==", true),
        where("challengeName", "==", habitName)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.id);
    } catch (e) { return []; }
  },

  giveUpChallenge: async (challengeId, userId) => {
    try {
      const batch = writeBatch(db);

      // A) Actualizar el Reto
      const challengeRef = doc(db, 'challenges', challengeId);
      const challengeSnap = await getDoc(challengeRef);
      if (!challengeSnap.exists()) throw new Error("Reto no encontrado");

      const data = challengeSnap.data();
      const updatedParticipants = data.participants.map(p => {
        if (p.userId === userId) {
          return { ...p, hasFailed: true }; // Marcamos la derrota
        }
        return p;
      });

      batch.update(challengeRef, { participants: updatedParticipants });

      // B) Buscar y Borrar el Hábito asociado
      // Buscamos en habits donde challengeId == este reto AND userId == este usuario
      const q = query(
        collection(db, 'habits'),
        where("challengeId", "==", challengeId),
        where("userId", "==", userId)
      );
      const habitSnap = await getDocs(q);

      habitSnap.forEach((doc) => {
        batch.delete(doc.ref); // Lo añadimos a la cola de borrado
      });

      // Ejecutar todo
      await batch.commit();

    } catch (error) {
      console.error("Error abandonando reto:", error);
      throw error;
    }
  },

  /**
   * Resta 1 punto al usuario en el reto (cuando desmarca el hábito).
   * Evita que baje de 0.
   */
  decrementScore: async (challengeId, userId) => {
    try {
      const challengeRef = doc(db, 'challenges', challengeId);
      const challengeSnap = await getDoc(challengeRef);

      if (!challengeSnap.exists()) return;

      const data = challengeSnap.data();

      // Buscamos al usuario y le restamos 1 (sin bajar de 0)
      const updatedParticipants = data.participants.map(p => {
        if (p.userId === userId) {
          const newScore = Math.max(0, (p.currentScore || 0) - 1);
          return { ...p, currentScore: newScore };
        }
        return p;
      });

      await updateDoc(challengeRef, {
        participants: updatedParticipants
      });

    } catch (error) {
      console.error("Error restando puntaje:", error);
    }
  },
};

export default ChallengeService;