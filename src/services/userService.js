import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  where,
  writeBatch
} from 'firebase/firestore';
import { db } from '../../firebaseConfig';

const UserService = {

  getUserDocument: async (userId) => {
    const docRef = doc(db, 'users', userId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : null;
  },

  searchUsers: async (searchTerm) => {
    const usersRef = collection(db, 'users');
    const q = query(
      usersRef,
      where('username', '>=', searchTerm),
      where('username', '<=', searchTerm + '\uf8ff'),
      limit(10)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  sendFriendRequest: async (fromId, fromName, fromAvatar, toId) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', fromId));
      const friendList = userDoc.data().friendList || [];
      if (friendList.includes(toId)) throw new Error("Ja sou amics.");

      const q = query(collection(db, 'friend_requests'), where('fromId', '==', fromId), where('toId', '==', toId));
      const existing = await getDocs(q);
      if (!existing.empty) throw new Error("Sol·licitud ja enviada.");

      await import('firebase/firestore').then(({ addDoc, collection }) =>
        addDoc(collection(db, 'friend_requests'), {
          fromId, fromName, fromAvatar, toId, status: 'pending', timestamp: new Date()
        })
      );
    } catch (error) { throw error; }
  },

  getIncomingRequests: async (userId) => {
    const q = query(collection(db, 'friend_requests'), where('toId', '==', userId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  acceptFriendRequest: async (reqId, fromId, myId) => {
    const batch = writeBatch(db);
    const reqRef = doc(db, 'friend_requests', reqId);
    batch.delete(reqRef);
    // Aquí iría la lógica de arrayUnion si la tienes implementada
  },

  rejectFriendRequest: async (reqId) => {
    await deleteDoc(doc(db, 'friend_requests', reqId));
  },

  getFriendsDetails: async (friendIds) => {
    if (!friendIds || friendIds.length === 0) return [];
    const q = query(collection(db, 'users'), where('__name__', 'in', friendIds.slice(0, 10)));
    const s = await getDocs(q);
    return s.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  // --- LÓGICA DE GAMIFICACIÓN CORREGIDA ---

  addExperience: async (userId, amount) => {
    try {
      const userRef = doc(db, 'users', userId);

      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) return;

        const data = userDoc.data();
        const currentTotalXP = data.totalXP || 0; // 'XP' mayúscula
        const currentLevel = data.level || 1;
        const currentShields = data.streakShields || 0;

        // --- CORRECCIÓN AQUÍ ---
        const newTotalXp = currentTotalXP + amount; // Ahora coinciden las variables
        let newLevel = currentLevel;
        let newShields = currentShields;

        // Lógica de Nivel: (Nivel * 1000) XP necesarios para el siguiente
        const xpForNextLevel = currentLevel * 1000;

        if (newTotalXp >= xpForNextLevel) {
          // ¡SUBIDA DE NIVEL!
          newLevel += 1;

          // RECOMPENSA: +1 ESCUDO (Máximo 5)
          if (newShields < 5) {
            newShields += 1;
          }
        }

        transaction.update(userRef, {
          totalXP: newTotalXp,
          level: newLevel,
          streakShields: newShields
        });
      });
    } catch (e) { console.error("Error adding XP:", e); }
  }
};

export default UserService;