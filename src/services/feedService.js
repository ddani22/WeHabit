import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDocs,
    limit,
    orderBy,
    query,
    where
} from 'firebase/firestore';
import { db } from '../../firebaseConfig';

// Helper para dividir arrays grandes en trozos pequeños (Chunking)
const chunkArray = (array, size) => {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
};

const FeedService = {

    /**
     * Registra un evento en el muro global.
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
            console.error("Error registrando actividad:", error);
        }
    },

    /**
     * Obtiene las actividades recientes de tus amigos sin límite de 10.
     * Estrategia: Batch Querying + Merge Sort en cliente.
     */
    getFriendsFeed: async (friendIds) => {
        if (!friendIds || friendIds.length === 0) return [];

        try {
            // 1. Dividimos los amigos en lotes de 10 (Límite de Firestore)
            const friendChunks = chunkArray(friendIds, 10);
            const promises = [];

            // 2. Lanzamos una consulta por cada lote en paralelo
            friendChunks.forEach(chunk => {
                const q = query(
                    collection(db, 'activity_feed'),
                    where('userId', 'in', chunk),
                    orderBy('createdAt', 'desc'),
                    limit(20) // Traemos los 20 más recientes de CADA grupo para no perder datos
                );
                promises.push(getDocs(q));
            });

            // 3. Esperamos a que todas respondan
            const snapshots = await Promise.all(promises);

            // 4. Unificamos todos los documentos en una sola lista
            let allActivities = [];
            snapshots.forEach(snap => {
                snap.docs.forEach(doc => {
                    allActivities.push({ id: doc.id, ...doc.data() });
                });
            });

            // 5. Ordenamos en memoria (Memory Sort) por fecha real descendente
            // Esto es crucial porque al unir lotes se pierde el orden global
            allActivities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            // 6. Devolvemos solo los 20 más recientes del total global
            return allActivities.slice(0, 20);

        } catch (error) {
            console.error("Error cargando feed escalable:", error);
            return [];
        }
    },

    /**
     * Elimina una actividad específica.
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