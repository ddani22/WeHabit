import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';
import FeedService from './feedService';
import UserService from './userService';

// Helper Fecha Local
const getLocalTodayDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper Días Diferencia
const getDaysDiff = (dateString) => {
  if (!dateString) return 0;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const last = new Date(dateString);
  last.setHours(0, 0, 0, 0);
  const diffTime = now - last;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const HabitService = {

  createHabit: async (userId, name, frequency, icon, categoryData, type = 'positive') => {
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
        type,
        isChallenge: false,
        lastCompletedDate: null,
        lastResetDate: type === 'negative' ? new Date().toISOString() : null,
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

      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      let streakShields = userSnap.exists() ? (userSnap.data().streakShields || 0) : 0;
      let shieldsConsumed = 0;

      querySnapshot.forEach((document) => {
        const data = document.data();
        let habit = { id: document.id, ...data };

        // Negativos (Contador Auto)
        if (habit.type === 'negative') {
          const daysFree = getDaysDiff(habit.lastResetDate);
          if (daysFree !== habit.currentStreak) {
            habit.currentStreak = daysFree;
            updates.push(updateDoc(doc(db, 'habits', habit.id), { currentStreak: daysFree }));
          }
        }
        // Positivos (Escudos)
        else {
          if (habit.currentStreak > 0) {
            const daysDiff = getDaysDiff(habit.lastCompletedDate);
            if (daysDiff > 1) {
              if (streakShields > 0) {
                streakShields--;
                shieldsConsumed++;
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayISO = yesterday.toISOString();

                habit.lastCompletedDate = yesterdayISO;
                updates.push(updateDoc(doc(db, 'habits', habit.id), { lastCompletedDate: yesterdayISO }));
                console.log(`🛡️ Escudo usado en: ${habit.name}`);
              } else {
                habit.currentStreak = 0;
                updates.push(updateDoc(doc(db, 'habits', habit.id), { currentStreak: 0 }));
              }
            }
          }
        }
        habits.push(habit);
      });

      if (updates.length > 0) await Promise.all(updates);
      if (shieldsConsumed > 0) {
        updateDoc(userRef, {
          streakShields: (userSnap.data().streakShields || 0) - shieldsConsumed
        });
      }

      return habits;
    } catch (error) { console.error(error); throw error; }
  },

  deleteHabit: async (habitId, userId) => {
    try {
      const today = getLocalTodayDate();
      const logsRef = collection(db, 'logs');
      const q = query(logsRef, where("habitId", "==", habitId), where("date", "==", today));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.forEach(doc => batch.delete(doc.ref));
      batch.delete(doc(db, 'habits', habitId));
      await batch.commit();
      if (userId) await FeedService.removeLog(userId, 'habit_done', habitId);
    } catch (error) { throw error; }
  },

  checkInHabit: async (habitId, userId) => {
    try {
      const todayDate = getLocalTodayDate();
      const completedAtISO = new Date().toISOString();
      let feedInfo = null;

      await runTransaction(db, async (transaction) => {
        const habitRef = doc(db, 'habits', habitId);
        const habitDoc = await transaction.get(habitRef);

        if (!habitDoc.exists()) throw new Error("Hábito no encontrado");
        const d = habitDoc.data();

        if (d.type === 'negative') throw new Error("Use reset for negative habits");

        if (d.lastCompletedDate) {
          const lastDateLocal = new Date(d.lastCompletedDate);
          const lastDateString = `${lastDateLocal.getFullYear()}-${String(lastDateLocal.getMonth() + 1).padStart(2, '0')}-${String(lastDateLocal.getDate()).padStart(2, '0')}`;
          if (lastDateString === todayDate) return;
        }

        const daysDiff = getDaysDiff(d.lastCompletedDate);
        let newStreak = (d.currentStreak || 0);

        // Si daysDiff es 0 (primera vez) o > 1 (roto), la racha empieza/reinicia en 1
        // Si daysDiff es 1 (ayer), la racha suma
        if (daysDiff === 1) newStreak += 1;
        else newStreak = 1;

        const newBestStreak = Math.max(newStreak, d.bestStreak || 0);

        transaction.update(habitRef, {
          currentStreak: newStreak,
          bestStreak: newBestStreak,
          lastCompletedDate: completedAtISO
        });

        const newLogRef = doc(collection(db, 'logs'));
        transaction.set(newLogRef, {
          habitId,
          userId,
          date: todayDate,
          completedAt: completedAtISO,
          isCompleted: true
        });

        feedInfo = { newStreak, habitName: d.name, daysDiff };
      });

      // --- CORRECCIÓN AQUÍ: Quitamos '&& feedInfo.daysDiff > 0' ---
      // Ahora entra SIEMPRE que haya info, incluso el primer día.
      if (feedInfo) {
        try {
          const userDoc = await getDoc(doc(db, 'users', userId));
          const userData = userDoc.exists() ? userDoc.data() : {};

          const desc = feedInfo.newStreak > 1
            ? `¡Mantiene una racha de ${feedInfo.newStreak} días! 🔥`
            : `Ha completado su primer día hoy.`;

          await FeedService.logActivity(
            userId, userData.username || 'Usuario', userData.avatar,
            'habit_done', `Completó: ${feedInfo.habitName}`, desc, habitId
          );

          // XP
          let xpEarned = 10;
          if (feedInfo.newStreak > 3) xpEarned += 5;
          UserService.addExperience(userId, xpEarned).catch(console.error);

        } catch (e) { console.warn("Feed/XP error", e); }
      }
      return true;
    } catch (error) {
      console.error("Error checkIn:", error);
      throw error;
    }
  },

  undoCheckIn: async (habitId, userId) => {
    try {
      const today = getLocalTodayDate();
      const logsRef = collection(db, 'logs');
      const q = query(logsRef, where("habitId", "==", habitId), where("userId", "==", userId), where("date", "==", today));
      const snapshot = await getDocs(q);

      if (snapshot.empty) return;

      const batch = writeBatch(db);
      snapshot.forEach(doc => batch.delete(doc.ref));

      const qHistory = query(logsRef, where("habitId", "==", habitId), where("userId", "==", userId));
      const historySnap = await getDocs(qHistory);
      const validDates = historySnap.docs
        .map(d => d.data().completedAt)
        .filter(d => {
          if (!d) return false;
          const logDate = new Date(d);
          const logDateStr = `${logDate.getFullYear()}-${String(logDate.getMonth() + 1).padStart(2, '0')}-${String(logDate.getDate()).padStart(2, '0')}`;
          return logDateStr !== today;
        })
        .sort().reverse();
      const previousDate = validDates.length > 0 ? validDates[0] : null;

      const habitRef = doc(db, 'habits', habitId);
      const habitSnap = await getDoc(habitRef);
      if (habitSnap.exists()) {
        const currentStreak = habitSnap.data().currentStreak || 0;
        batch.update(habitRef, {
          currentStreak: Math.max(0, currentStreak - 1),
          lastCompletedDate: previousDate
        });
      }
      await batch.commit();
      await FeedService.removeLog(userId, 'habit_done', habitId);

    } catch (error) { console.error("Error undo:", error); throw error; }
  },

  resetNegativeHabit: async (habitId) => {
    try {
      const nowISO = new Date().toISOString();
      const habitRef = doc(db, 'habits', habitId);
      await updateDoc(habitRef, {
        currentStreak: 0,
        lastResetDate: nowISO
      });
    } catch (error) {
      console.error("Error resetting negative habit:", error);
      throw error;
    }
  },

  updateHabit: async (habitId, updatedFields) => {
    try { await updateDoc(doc(db, 'habits', habitId), updatedFields); }
    catch (error) { console.error(error); throw error; }
  },

  deleteMultipleHabits: async (habitIds) => {
    try {
      const batch = writeBatch(db);
      habitIds.forEach(id => batch.delete(doc(db, 'habits', id)));
      await batch.commit();
    } catch (error) { console.error(error); throw error; }
  },

  moveHabitsToCategory: async (habitIds, newCategoryId, newCategoryLabel, newCategoryColor) => {
    try {
      const batch = writeBatch(db);
      habitIds.forEach(id => {
        batch.update(doc(db, 'habits', id), {
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
    const today = getLocalTodayDate();
    const q = query(collection(db, 'logs'), where("userId", "==", userId), where("date", "==", today));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data().habitId);
  }
};

export default HabitService;