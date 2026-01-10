import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configuración de comportamiento cuando la app está en primer plano
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

const NotificationService = {

    /**
     * Solicita permisos de notificación de forma robusta.
     */
    requestPermissions: async () => {
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('daily-reminder', {
                name: 'Recordatorio Diario',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FF231F7C',
            });
        }

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            return false;
        }
        return true;
    },

    /**
     * Programa el recordatorio diario.
     * @param {number} hour - Hora (0-23)
     * @param {number} minute - Minuto (0-59)
     * @param {boolean} shouldOverride - Si es true, cancela lo anterior y fuerza la nueva hora.
     */
    scheduleDailyReminder: async (hour = 18, minute = 0, shouldOverride = true) => {
        const hasPermission = await NotificationService.requestPermissions();
        if (!hasPermission) return false;

        // 1. Verificar si ya hay notificaciones para no machacar preferencias
        if (!shouldOverride) {
            const scheduled = await Notifications.getAllScheduledNotificationsAsync();
            if (scheduled.length > 0) {
                // Ya existe una configuración, no tocamos nada (respetamos al usuario)
                return true;
            }
        }

        // 2. Limpiar anteriores si estamos forzando o configurando de cero
        await Notifications.cancelAllScheduledNotificationsAsync();

        // 3. Programar la nueva
        const trigger = {
            hour,
            minute,
            repeats: true,
        };

        try {
            await Notifications.scheduleNotificationAsync({
                content: {
                    title: "🔥 ¡No rompas tu racha!",
                    body: "Es hora de marcar tus hábitos del día.",
                    sound: true,
                },
                trigger,
            });
            return true;
        } catch (error) {
            console.error("Error programando notificación:", error);
            return false;
        }
    },

    /**
     * Cancela todas las notificaciones (ej. el usuario las desactiva en ajustes).
     */
    cancelAll: async () => {
        await Notifications.cancelAllScheduledNotificationsAsync();
    },

    /**
     * Devuelve la hora programada actual (útil para mostrar en UI).
     * Retorna { hour, minute } o null.
     */
    getCurrentSchedule: async () => {
        const scheduled = await Notifications.getAllScheduledNotificationsAsync();
        if (scheduled.length > 0 && scheduled[0].trigger) {
            // Expo devuelve estructuras diferentes según OS, intentamos normalizar
            const trigger = scheduled[0].trigger;
            if (trigger.hour !== undefined && trigger.minute !== undefined) {
                return { hour: trigger.hour, minute: trigger.minute };
            }
            // Fallback para triggers de fecha
            if (trigger.dateComponents) {
                return {
                    hour: trigger.dateComponents.hour,
                    minute: trigger.dateComponents.minute
                };
            }
        }
        return null;
    }
};

export default NotificationService;