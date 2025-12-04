import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';

const FeedbackService = {

    /**
     * Ejecuta vibración y sonido de éxito.
     */
    triggerSuccess: async () => {
        // 1. Vibración de "Éxito" (Dos toques suaves)
        try {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (e) { console.warn("Haptics no disponible"); }

        // 2. Sonido (Requiere fichero assets/sounds/success.mp3)
        try {
            const { sound } = await Audio.Sound.createAsync(
                require('../../assets/sounds/success.mp3')
            );
            // Reproducir
            await sound.playAsync();

            // Limpiar memoria cuando termine (opcional pero buena práctica)
            sound.setOnPlaybackStatusUpdate(async (status) => {
                if (status.didJustFinish) {
                    await sound.unloadAsync();
                }
            });
        } catch (error) {
            // Si no hay archivo de sonido, no rompemos la app, solo lo ignoramos
            console.log("No se pudo reproducir sonido (¿Falta success.mp3?)");
        }
    },

    /**
     * Vibración ligera para interacciones menores (ej: abrir modal)
     */
    triggerImpactLight: async () => {
        try {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch (e) { }
    },

    /**
     * Vibración pesada para acciones destructivas (ej: borrar)
     */
    triggerImpactHeavy: async () => {
        try {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        } catch (e) { }
    }
};

export default FeedbackService;