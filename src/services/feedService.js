import {
    addDoc,
    collection,
    deleteDoc,
    deleteField,
    doc,
    getDocs,
    limit,
    orderBy,
    query,
    serverTimestamp,
    updateDoc,
    where
} from 'firebase/firestore';
import { db } from '../../firebaseConfig';

const FeedService = {
    /**
     * Registra actividad
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
                relatedId,
                reactions: {}, // Inicializamos el mapa de reacciones vacío
                timestamp: serverTimestamp()
            });
        } catch (error) {
            console.error("Error logging activity:", error);
        }
    },

    getFriendsFeed: async (friendIds) => {
        try {
            if (!friendIds || friendIds.length === 0) return [];
            // Limitamos a 10 amigos para la query 'in' por seguridad
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
     * NUEVO: GESTIONAR REACCIONES
     * toggleReaction('feed123', 'userABC', 'fire')
     */
    toggleReaction: async (feedId, userId, reactionType) => {
        try {
            const feedRef = doc(db, 'feed', feedId);

            // La clave del mapa será el userId
            const fieldPath = `reactions.${userId}`;

            // Si queremos alternar (si ya existe, borrarlo? o cambiarlo?)
            // Estrategia simple: Escribimos el nuevo valor. 
            // Si queremos hacer toggle (quitar si ya está), lo haríamos en la UI antes de llamar aquí 
            // o enviamos 'null' para borrar.

            if (reactionType === null) {
                // Borrar reacción
                await updateDoc(feedRef, {
                    [fieldPath]: deleteField()
                });
            } else {
                // Poner reacción (fire, clap, etc.)
                await updateDoc(feedRef, {
                    [fieldPath]: reactionType
                });
            }
        } catch (error) {
            console.error("Error reacting:", error);
            throw error;
        }
    },

    removeLog: async (userId, type, relatedId) => {
        try {
            if (!relatedId) return;
            const q = query(collection(db, 'feed'), where('relatedId', '==', relatedId));
            const snapshot = await getDocs(q);
            const docsToDelete = snapshot.docs.filter(doc => {
                const data = doc.data();
                return data.userId === userId && data.type === type;
            });
            const deletePromises = docsToDelete.map(doc => deleteDoc(doc.ref));
            await Promise.all(deletePromises);
        } catch (error) { console.error("Error removing log:", error); }
    },

    deleteActivity: async (feedId) => {
        try { await deleteDoc(doc(db, 'feed', feedId)); }
        catch (error) { throw error; }
    }
};

export default FeedService;