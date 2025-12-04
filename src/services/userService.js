import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore';
import { db } from '../../firebaseConfig';

const UserService = {

  /**
   * Busca usuarios por nombre de usuario exacto.
   */
  searchUsers: async (searchTerm) => {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where("username", "==", searchTerm));

      const querySnapshot = await getDocs(q);
      const users = [];
      querySnapshot.forEach((doc) => {
        users.push({ id: doc.id, ...doc.data() });
      });
      return users;
    } catch (error) {
      console.error("Error buscando usuarios:", error);
      throw error;
    }
  },

  /**
   * Agrega un ID de amigo a tu lista personal.
   */
  addFriend: async (currentUserId, friendId) => {
    try {
      const userRef = doc(db, 'users', currentUserId);
      await updateDoc(userRef, {
        friendList: arrayUnion(friendId)
      });
      return true;
    } catch (error) {
      console.error("Error agregando amigo:", error);
      throw error;
    }
  },

  /**
   * --- NUEVA FUNCIÓN QUE FALTABA ---
   * Obtiene los detalles (avatar, nombre) de una lista de IDs.
   */
  getFriendsDetails: async (friendIds) => {
    try {
      if (!friendIds || friendIds.length === 0) return [];

      const usersRef = collection(db, 'users');

      // NOTA: Firestore limita el operador 'in' a 10 elementos por consulta.
      // Para un MVP está bien, para producción habría que hacer lotes.
      // Asumimos que guardamos el campo 'id' dentro del documento (como hicimos en authService).
      const q = query(usersRef, where("id", "in", friendIds));

      const querySnapshot = await getDocs(q);
      const friends = [];
      querySnapshot.forEach((doc) => {
        friends.push({ id: doc.id, ...doc.data() });
      });

      return friends;
    } catch (error) {
      console.error("Error obteniendo detalles de amigos:", error);
      throw error; // O devolver [] si prefieres no romper la UI
    }
  },

  /**
   * Obtiene las categorías personalizadas del usuario.
   */
  getUserCategories: async (userId) => {
    try {
      const userRef = doc(db, 'users', userId);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        return snap.data().customCategories || [];
      }
      return [];
    } catch (error) {
      console.error("Error obteniendo categorías:", error);
      return [];
    }
  },

  /**
   * Crea una nueva categoría personalizada.
   */
  addCustomCategory: async (userId, newCategory) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        customCategories: arrayUnion(newCategory)
      });
      return true;
    } catch (error) {
      console.error("Error creando categoría:", error);
      throw error;
    }
  },

  /**
   * 1. Enviar una solicitud de amistad
   */
  sendFriendRequest: async (fromUserId, fromUsername, fromAvatar, toUserId) => {
    try {
      // Verificar si ya existe una solicitud pendiente (Opcional, pero recomendado)
      const requestsRef = collection(db, 'friend_requests');
      const q = query(
        requestsRef,
        where("fromId", "==", fromUserId),
        where("toId", "==", toUserId)
      );
      const snap = await getDocs(q);
      if (!snap.empty) throw new Error("Ya enviaste una solicitud");

      // Crear la solicitud
      await addDoc(collection(db, 'friend_requests'), {
        fromId: fromUserId,
        fromName: fromUsername,
        fromAvatar: fromAvatar || null, // Guardamos datos básicos para no tener que buscarlos luego
        toId: toUserId,
        status: 'pending',
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error enviando solicitud:", error);
      throw error;
    }
  },

  /**
   * 2. Ver mis solicitudes pendientes (Gente que quiere ser mi amiga)
   */
  getIncomingRequests: async (myUserId) => {
    try {
      const q = query(
        collection(db, 'friend_requests'),
        where("toId", "==", myUserId)
      );
      const snap = await getDocs(q);
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error("Error obteniendo solicitudes:", error);
      return [];
    }
  },

  /**
   * 3. Aceptar solicitud (Amistad MUTUA y borrar la solicitud)
   */
  acceptFriendRequest: async (requestId, requesterId, myUserId) => {
    try {
      const batch = writeBatch(db);

      // A) Añadirme a su lista
      const requesterRef = doc(db, 'users', requesterId);
      batch.update(requesterRef, { friendList: arrayUnion(myUserId) });

      // B) Añadirlo a mi lista
      const myRef = doc(db, 'users', myUserId);
      batch.update(myRef, { friendList: arrayUnion(requesterId) });

      // C) Borrar la solicitud
      const requestRef = doc(db, 'friend_requests', requestId);
      batch.delete(requestRef);

      await batch.commit();
    } catch (error) {
      console.error("Error aceptando:", error);
      throw error;
    }
  },

  /**
   * 4. Rechazar solicitud
   */
  rejectFriendRequest: async (requestId) => {
    try {
      await deleteDoc(doc(db, 'friend_requests', requestId));
    } catch (error) {
      console.error("Error rechazando:", error);
      throw error;
    }
  },

  /**
   * Suma XP al usuario de forma atómica.
   */
  addExperience: async (userId, amount) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        totalXP: increment(amount)
      });
    } catch (error) {
      console.error("Error sumando XP:", error);
    }
  },

  /**
   * Borra una categoría personalizada de la lista del usuario.
   * Nota: Los hábitos de esta categoría no se borran, pero se quedarán "huérfanos" 
   * o mantendrán el color antiguo hasta que los edites.
   */
  deleteCustomCategory: async (userId, categoryObject) => {
    try {
      const userRef = doc(db, 'users', userId);
      // arrayRemove requiere el objeto EXACTO que guardaste (id, label, color)
      await updateDoc(userRef, {
        customCategories: arrayRemove(categoryObject)
      });
    } catch (error) {
      console.error("Error borrando categoría:", error);
      throw error;
    }
  }
};

export default UserService;