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
  where,
  writeBatch
} from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';
import FeedService from './feedService';
import UserService from './userService';

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

  // --- CORRECCIÓN APLICADA AQUÍ ---
  checkInHabit: async (habitId, userId) => {
    try {
      const todayISO = new Date().toISOString();
      const todayDate = todayISO.split('T')[0];

      const habitRef = doc(db, 'habits', habitId);
      const habitSnap = await getDoc(habitRef);
      if (!habitSnap.exists()) throw new Error("Hábito no encontrado");
      const habitData = habitSnap.data();

      const daysDiff = getDaysDiff(habitData.lastCompletedDate);

      // 1. CONSULTA CORREGIDA: AÑADIDO where("userId", "==", userId)
      const logsRef = collection(db, 'logs');
      const qLog = query(
        logsRef,
        where("habitId", "==", habitId),
        where("date", "==", todayDate),
        where("userId", "==", userId) // <--- ESTE FILTRO FALTABA
      );
      const snapLog = await getDocs(qLog);

      // Si no existe log de hoy, lo creamos
      if (snapLog.empty) {
        await addDoc(logsRef, {
          habitId, userId, date: todayDate, completedAt: todayISO, isCompleted: true
        });
      } else {
        // Si ya existe, no hacemos nada más (ya está marcado)
        return true;
      }

      // 2. CALCULAR RACHA
      let newStreak = habitData.currentStreak || 0;

      if (daysDiff > 0) {
        if (daysDiff === 1) {
          newStreak += 1;
        } else {
          newStreak = 1;
        }
      }

      // 3. ACTUALIZAR HÁBITO
      await updateDoc(habitRef, {
        currentStreak: newStreak,
        lastCompletedDate: todayISO,
        bestStreak: Math.max(newStreak, habitData.bestStreak || 0)
      });

      // 4. FEED Y XP
      if (daysDiff > 0) {
        try {
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
        } catch (feedError) { console.warn("Error feed:", feedError); }

        let xpEarned = 10;
        if (newStreak > 3) xpEarned += 5;
        UserService.addExperience(userId, xpEarned);
      }

      return true;
    } catch (error) { console.error("Error en checkIn:", error); throw error; }
  },

  undoCheckIn: async (habitId, userId) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const batch = writeBatch(db);

      const logsRef = collection(db, 'logs');
      const q = query(
        logsRef,
        where("habitId", "==", habitId),
        where("userId", "==", userId),
        where("date", "==", today)
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) return;

      snapshot.forEach(doc => {
        batch.delete(doc.ref);
      });

      const habitRef = doc(db, 'habits', habitId);
      batch.update(habitRef, {
        currentStreak: increment(-1),
      });

      await batch.commit();
    } catch (error) {
      console.error("Error deshaciendo:", error);
      throw error;
    }
  },

  updateHabit: async (habitId, updatedFields) => {
    try {
      const habitRef = doc(db, 'habits', habitId);
      await updateDoc(habitRef, updatedFields);
    } catch (error) { console.error(error); throw error; }
  },

  deleteMultipleHabits: async (habitIds) => {
    try {
      const batch = writeBatch(db);
      habitIds.forEach(id => {
        const habitRef = doc(db, 'habits', id);
        batch.delete(habitRef);
      });
      await batch.commit();
    } catch (error) { console.error("Error borrando grupo:", error); throw error; }
  },

  moveHabitsToCategory: async (habitIds, newCategoryId, newCategoryLabel, newCategoryColor) => {
    try {
      const batch = writeBatch(db);
      habitIds.forEach(id => {
        const habitRef = doc(db, 'habits', id);
        batch.update(habitRef, {
          categoryId: newCategoryId,
          categoryLabel: newCategoryLabel,
          categoryColor: newCategoryColor
        });
      });
      await batch.commit();
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
  }
};

export default HabitService;