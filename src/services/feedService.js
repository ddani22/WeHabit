import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDocs,
    limit,
    orderBy,
    query, where
} from 'firebase/firestore';
import { db } from '../../firebaseConfig';

const FeedService = {

    /**
     * Registra un evento en el muro global.
     * @param {string} userId - Quién lo hizo
     * @param {string} username - Nombre (para no tener que buscarlo luego)
     * @param {string} avatar - Foto (igual, para optimizar lectura)
     * @param {string} type - 'habit_done' | 'challenge_won'
     * @param {string} title - Ej: "Ha completado 'Leer'"
     * @param {string} description - Ej: "Racha de 12 días 🔥"
     */
    logActivity: async (userId, username, avatar, type, title, description) => {
        try {
            await addDoc(collection(db, 'activity_feed'), {
                userId,
                username,
                avatar,
                type,
                title,
                description,
                createdAt: new Date().toISOString()
            });
        } catch (error) {
            // Si falla el log, no rompemos la app, solo lo ignoramos
            console.error("Error registrando actividad:", error);
        }
    },

    /**
     * Obtiene las actividades recientes de tus amigos.
     */
    getFriendsFeed: async (friendIds) => {
        if (!friendIds || friendIds.length === 0) return [];

        try {
            // NOTA: Firestore limita el operador 'in' a 10 valores.
            // Para este MVP, tomamos solo los primeros 10 amigos para evitar errores.
            // En una app real, haríamos múltiples consultas.
            const safeFriendIds = friendIds.slice(0, 10);

            const q = query(
                collection(db, 'activity_feed'),
                where('userId', 'in', safeFriendIds),
                orderBy('createdAt', 'desc'),
                limit(20) // Traemos los últimos 20 eventos
            );

            const snap = await getDocs(q);
            return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error("Error cargando feed:", error);
            return [];
        }
    },

    /**
   * Elimina una actividad específica (Solo si eres el dueño).
   */
    deleteActivity: async (activityId) => {
        try {
            await deleteDoc(doc(db, 'activity_feed', activityId));
        } catch (error) {
            console.error("Error borrando actividad:", error);
            throw error;
        }
    }
};

export default FeedService;