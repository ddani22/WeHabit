import {
    addDoc,
    collection,
    deleteDoc,
    getDocs,
    limit,
    orderBy,
    query,
    serverTimestamp,
    where
} from 'firebase/firestore';
import { db } from '../../firebaseConfig';

const FeedService = {
    /**
     * Registra una actividad en el feed público.
     * @param {string} userId - ID del usuario
     * @param {string} username - Nombre a mostrar
     * @param {string} avatar - URL del avatar
     * @param {string} type - 'habit_done' | 'challenge_won' | 'challenge_progress'
     * @param {string} title - Título principal (ej. "Completó: Leer")
     * @param {string} description - Subtítulo (ej. "Racha de 5 días")
     * @param {string} relatedId - (OPCIONAL) ID del hábito o reto para poder borrarlo luego si se hace Undo
     */
    logActivity: async (userId, username, avatar, type, title, description = '', relatedId = null) => {
        try {
            await addDoc(collection(db, 'feed'), {
                userId,
                username,
                avatar,
                type,
                title,
                description,
                relatedId, // <--- CLAVE: Guardamos el ID del objeto original
                timestamp: serverTimestamp()
            });
        } catch (error) {
            console.error("Error logging activity:", error);
            // No lanzamos error para no bloquear la app por un log fallido
        }
    },

    /**
     * OBTIENE EL FEED DE AMIGOS
     */
    getFriendsFeed: async (friendIds) => {
        try {
            // Nota: Firestore tiene límite de 10 items en 'in'. 
            // En producción real, esto se haría con paginación o backend functions.
            // Aquí cogemos los últimos 20 globales de esos amigos.
            if (!friendIds || friendIds.length === 0) return [];

            // Cortamos a 10 para evitar crash de Firestore en demo
            const safeIds = friendIds.slice(0, 10);

            const q = query(
                collection(db, 'feed'),
                where('userId', 'in', safeIds),
                orderBy('timestamp', 'desc'),
                limit(20)
            );

            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error("Error getting feed:", error);
            return [];
        }
    },

    /**
   * BORRADO ROBUSTO (SIN ÍNDICES COMPLEJOS)
   * Busca por ID de objeto y filtra en memoria para asegurar el borrado.
   */
    removeLog: async (userId, type, relatedId) => {
        try {
            if (!relatedId) return;

            // 1. Buscamos SOLO por relatedId (Esto usa el índice automático, no falla nunca)
            const q = query(
                collection(db, 'feed'),
                where('relatedId', '==', relatedId)
            );

            const snapshot = await getDocs(q);

            // 2. Filtramos en memoria para asegurar que sea TU log y del tipo correcto
            const docsToDelete = snapshot.docs.filter(doc => {
                const data = doc.data();
                return data.userId === userId && data.type === type;
            });

            // 3. Borramos los duplicados si los hubiera
            const deletePromises = docsToDelete.map(doc => deleteDoc(doc.ref));
            await Promise.all(deletePromises);

            console.log(`Feed limpiado: ${deletePromises.length} elementos eliminados.`);

        } catch (error) {
            console.error("Error removing log:", error);
        }
    },
    /**
     * Borrar manualmente (para la pulsación larga del admin)
     */
    deleteActivity: async (feedId) => {
        try {
            await deleteDoc(doc(db, 'feed', feedId));
        } catch (error) {
            console.error(error);
            throw error;
        }
    }
};

export default FeedService;