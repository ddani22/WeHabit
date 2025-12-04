import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  updateDoc,
  where, writeBatch
} from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';
// 1. IMPORTAR EL SERVICIO DE FEED (ESTO FALTABA)
import FeedService from './feedService';
import UserService from './userService';

// Helper para calcular diferencia de días
const getDaysDiff = (dateString) => {
  if (!dateString) return 999;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lastDate = new Date(dateString);
  lastDate.setHours(0, 0, 0, 0);
  const diffTime = Math.abs(today - lastDate);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const HabitService = {

  createHabit: async (userId, name, frequency, icon, categoryData) => {
    try {
      const newHabit = {
        userId,
        name,
        frequency,
        categoryId: categoryData?.id || 'other',
        categoryLabel: categoryData?.label || 'General',
        categoryColor: categoryData?.color || '#8E8E93',
        currentStreak: 0,
        bestStreak: 0,
        isActive: true,
        icon,
        isChallenge: false,
        lastCompletedDate: null,
        createdAt: new Date().toISOString()
      };
      const docRef = await addDoc(collection(db, 'habits'), newHabit);
      return { id: docRef.id, ...newHabit };
    } catch (error) { console.error(error); throw error; }
  },

  getUserHabits: async (userId) => {
    try {
      const q = query(collection(db, 'habits'), where("userId", "==", userId), where("isActive", "==", true));
      const querySnapshot = await getDocs(q);
      const habits = [];
      const updates = [];

      querySnapshot.forEach((document) => {
        const data = document.data();
        let habit = { id: document.id, ...data };

        // Auto-reparación de racha
        if (habit.currentStreak > 0) {
          const daysDiff = getDaysDiff(habit.lastCompletedDate);
          if (daysDiff > 1) {
            habit.currentStreak = 0;
            const habitRef = doc(db, 'habits', habit.id);
            updates.push(updateDoc(habitRef, { currentStreak: 0 }));
          }
        }
        habits.push(habit);
      });
      if (updates.length > 0) await Promise.all(updates);
      return habits;
    } catch (error) { console.error(error); throw error; }
  },

  deleteHabit: async (habitId) => {
    try { await deleteDoc(doc(db, 'habits', habitId)); } catch (error) { throw error; }
  },

  // --- AQUÍ ESTÁ LA FUSIÓN CLAVE ---
  checkInHabit: async (habitId, userId) => {
    try {
      const todayISO = new Date().toISOString();
      const todayDate = todayISO.split('T')[0];

      const habitRef = doc(db, 'habits', habitId);
      const habitSnap = await getDoc(habitRef);
      if (!habitSnap.exists()) throw new Error("Hábito no encontrado");
      const habitData = habitSnap.data();

      const daysDiff = getDaysDiff(habitData.lastCompletedDate);
      if (daysDiff === 0) return; // Ya hecho hoy

      // Crear Log
      const logsRef = collection(db, 'logs');
      await addDoc(logsRef, {
        habitId, userId, date: todayDate, completedAt: todayISO, isCompleted: true
      });

      // Calcular Racha
      let newStreak = 1;
      if (daysDiff === 1) newStreak = (habitData.currentStreak || 0) + 1;

      // Actualizar Hábito
      await updateDoc(habitRef, {
        currentStreak: newStreak,
        lastCompletedDate: todayISO,
        bestStreak: Math.max(newStreak, habitData.bestStreak || 0)
      });

      // 2. RECUPERAMOS EL LOG AL FEED (ESTO SE HABÍA BORRADO)
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        const streakMsg = newStreak > 1 ? `¡Racha de ${newStreak} días! 🔥` : "Ha comenzado un hábito";

        await FeedService.logActivity(
          userId,
          userData.username || 'Usuario',
          userData.avatar || null,
          'habit_done',
          `Completó: ${habitData.name}`,
          streakMsg
        );
      }

      let xpEarned = 10;
      if (newStreak > 3) xpEarned += 5;
      UserService.addExperience(userId, xpEarned);

      return true;
    } catch (error) { console.error("Error en checkIn:", error); throw error; }
  },

  updateHabit: async (habitId, updatedFields) => {
    try {
      const habitRef = doc(db, 'habits', habitId);
      await updateDoc(habitRef, updatedFields);
    } catch (error) { console.error(error); throw error; }
  },

  getHabitHistory: async (habitId) => {
    try {
      const user = auth.currentUser;
      if (!user) return [];
      const logsRef = collection(db, 'logs');
      const q = query(logsRef, where("habitId", "==", habitId), where("userId", "==", user.uid));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.data().date);
    } catch (error) { return []; }
  },

  getTodayLogs: async (userId) => {
    const today = new Date().toISOString().split('T')[0];
    const q = query(collection(db, 'logs'), where("userId", "==", userId), where("date", "==", today));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data().habitId);
  },
  /**
   * Deshacer el Check-in de hoy.
   * 1. Borra el log de hoy.
   * 2. Resta 1 a la racha.
   */
  undoCheckIn: async (habitId, userId) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const batch = writeBatch(db);

      // 1. Buscar el log de hoy para borrarlo
      const logsRef = collection(db, 'logs');
      const q = query(
        logsRef,
        where("habitId", "==", habitId),
        where("userId", "==", userId),
        where("date", "==", today)
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) return; // No hay nada que deshacer

      // Borramos todos los logs encontrados (debería ser uno solo)
      snapshot.forEach(doc => {
        batch.delete(doc.ref);
      });

      // 2. Restar 1 a la racha del hábito
      const habitRef = doc(db, 'habits', habitId);
      // Usamos increment(-1) para restar atómicamente
      // Nota: Podríamos verificar que no baje de 0, pero la lógica de UI lo protege
      batch.update(habitRef, {
        currentStreak: increment(-1),
        // Opcional: Podríamos intentar restaurar lastCompletedDate a ayer, 
        // pero para simplificar lo dejamos así (el sistema se auto-corrige mañana)
      });

      // 3. Ejecutar
      await batch.commit();

    } catch (error) {
      console.error("Error deshaciendo hábito:", error);
      throw error;
    }
  },
};

export default HabitService;