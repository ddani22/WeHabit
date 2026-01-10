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
import FeedService from './feedService'; // <--- IMPORTANTE: Conectamos con el Feed
import UserService from './userService';

/**
 * HELPER: Obtiene la fecha actual en formato YYYY-MM-DD
 * respetando la ZONA HORARIA LOCAL del dispositivo.
 */
const getLocalTodayDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * HELPER: Calcula diferencia de días
 */
const getDaysDiff = (dateString) => {
  if (!dateString) return 999;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const last = new Date(dateString);
  last.setHours(0, 0, 0, 0);
  const diffTime = now - last;
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

        // Verificar si la racha se rompió
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

      if (updates.length > 0) Promise.all(updates).catch(e => console.warn("Background update fail", e));

      return habits;
    } catch (error) { console.error(error); throw error; }
  },

  /**
   * BORRAR HÁBITO (CON LIMPIEZA EN CASCADA)
   * Elimina logs de hoy y feed asociado para evitar "fantasmas" en las estadísticas.
   */
  deleteHabit: async (habitId, userId) => { // <--- OJO: Ahora pedimos userId también
    try {
      const today = getLocalTodayDate();

      // 1. Borrar Log de Hoy (Si estaba completado, lo quitamos)
      const logsRef = collection(db, 'logs');
      const q = query(
        logsRef,
        where("habitId", "==", habitId),
        where("date", "==", today)
      );
      const snapshot = await getDocs(q);

      const batch = writeBatch(db);

      // Añadimos al lote el borrado de logs de hoy
      snapshot.forEach(doc => {
        batch.delete(doc.ref);
      });

      // 2. Borrar el Hábito en sí
      const habitRef = doc(db, 'habits', habitId);
      batch.delete(habitRef);

      // Ejecutamos borrados en DB
      await batch.commit();

      // 3. Limpiar Feed Social (Si se publicó algo)
      // Lo hacemos fuera del batch porque es otro servicio
      if (userId) {
        await FeedService.removeLog(userId, 'habit_done', habitId);
      }

    } catch (error) {
      console.error("Error borrando hábito:", error);
      throw error;
    }
  },

  /**
   * CHECK-IN (CON PUBLICACIÓN EN FEED)
   */
  checkInHabit: async (habitId, userId) => {
    try {
      const todayDate = getLocalTodayDate();
      const completedAtISO = new Date().toISOString();
      let streakUpdatedInfo = null;

      // 1. TRANSACCIÓN ATÓMICA
      await runTransaction(db, async (transaction) => {
        const habitRef = doc(db, 'habits', habitId);
        const habitDoc = await transaction.get(habitRef);

        if (!habitDoc.exists()) throw new Error("Hábito no encontrado");

        const habitData = habitDoc.data();

        // Si ya se hizo hoy, salimos (Idempotencia)
        if (habitData.lastCompletedDate) {
          const lastDateLocal = new Date(habitData.lastCompletedDate);
          const lastDateString = `${lastDateLocal.getFullYear()}-${String(lastDateLocal.getMonth() + 1).padStart(2, '0')}-${String(lastDateLocal.getDate()).padStart(2, '0')}`;
          if (lastDateString === todayDate) {
            streakUpdatedInfo = { alreadyDone: true };
            return;
          }
        }

        const daysDiff = getDaysDiff(habitData.lastCompletedDate);
        let newStreak = habitData.currentStreak || 0;

        if (daysDiff === 1) newStreak += 1;
        else newStreak = 1;

        const newBestStreak = Math.max(newStreak, habitData.bestStreak || 0);

        // Actualizar Hábito
        transaction.update(habitRef, {
          currentStreak: newStreak,
          bestStreak: newBestStreak,
          lastCompletedDate: completedAtISO
        });

        // Crear Log
        const newLogRef = doc(collection(db, 'logs'));
        transaction.set(newLogRef, {
          habitId,
          userId,
          date: todayDate,
          completedAt: completedAtISO,
          isCompleted: true
        });

        streakUpdatedInfo = {
          newStreak,
          habitName: habitData.name,
          daysDiff
        };
      });

      // 2. POST-PROCESAMIENTO: FEED Y XP
      if (streakUpdatedInfo && !streakUpdatedInfo.alreadyDone) {
        const { newStreak, habitName, daysDiff } = streakUpdatedInfo;

        // Solo notificamos si realmente es un día nuevo
        if (daysDiff > 0) {
          try {
            // Recuperar datos de usuario para el feed
            const userDoc = await getDoc(doc(db, 'users', userId));
            const userData = userDoc.exists() ? userDoc.data() : {};
            const username = userData.username || 'Usuario';
            const avatar = userData.avatar || null;

            // --- PUBLICAR EN FEED ---
            // "Usuario completó: Leer" (Racha de X días)
            const desc = newStreak > 1
              ? `¡Mantiene una racha de ${newStreak} días! 🔥`
              : `Ha completado su primer día hoy.`;

            await FeedService.logActivity(
              userId,
              username,
              avatar,
              'habit_done',
              `Completó: ${habitName}`,
              desc,
              habitId // <--- CLAVE: Pasamos el ID para poder borrarlo después
            );

            // --- DAR XP ---
            let xpEarned = 10;
            if (newStreak > 3) xpEarned += 5;
            if (newStreak > 7) xpEarned += 10;
            UserService.addExperience(userId, xpEarned).catch(console.error);

          } catch (postError) {
            console.warn("Error Feed/XP:", postError);
          }
        }
      }

      return true;
    } catch (error) {
      console.error("Error checkIn:", error);
      throw error;
    }
  },

  /**
   * UNDO (CON BORRADO DE FEED)
   */
  undoCheckIn: async (habitId, userId) => {
    try {
      const today = getLocalTodayDate();

      // 1. Borrar Log de base de datos
      const logsRef = collection(db, 'logs');
      const q = query(
        logsRef,
        where("habitId", "==", habitId),
        where("userId", "==", userId),
        where("date", "==", today)
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) return;

      const batch = writeBatch(db);
      snapshot.forEach(doc => {
        batch.delete(doc.ref);
      });

      // 2. Restaurar estado anterior del Hábito
      // (Buscamos la fecha anterior para ser precisos)
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
        const newStreak = Math.max(0, currentStreak - 1);

        batch.update(habitRef, {
          currentStreak: newStreak,
          lastCompletedDate: previousDate
        });
      }

      await batch.commit();

      // 3. --- LIMPIEZA DEL FEED (NUEVO) ---
      // Buscamos y borramos la notificación relacionada con este hábito
      await FeedService.removeLog(userId, 'habit_done', habitId);

    } catch (error) {
      console.error("Error deshaciendo:", error);
      throw error;
    }
  },

  // ... (Resto de métodos sin cambios: updateHabit, deleteMultipleHabits, etc.) ...
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
    const today = getLocalTodayDate();
    const q = query(collection(db, 'logs'), where("userId", "==", userId), where("date", "==", today));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data().habitId);
  }
};

export default HabitService;