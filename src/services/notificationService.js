import * as Notifications from 'expo-notifications';
import { Alert } from 'react-native';

// Configuración para que la notificación se vea incluso con la app abierta
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

const NotificationService = {

    requestPermissions: async () => {
        // 1. Ver estado actual
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        // 2. Si no está concedido, pedirlo
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        // 3. DEBUG: Si falla, avisar al usuario para que vaya a Ajustes
        if (finalStatus !== 'granted') {
            Alert.alert(
                "Permisos Denegados",
                "iOS ha bloqueado las notificaciones. Ve a Ajustes -> Expo Go -> Notificaciones y actívalas manualmente."
            );
            return false;
        }
        return true;
    },

    scheduleDailyReminder: async (hour = 18, minute = 0) => {
        await Notifications.cancelAllScheduledNotificationsAsync();
        const hasPermission = await NotificationService.requestPermissions();
        if (!hasPermission) return;

        await Notifications.scheduleNotificationAsync({
            content: {
                title: "🔥 ¡No rompas tu racha!",
                body: "Tómate 2 minutos para marcar tus hábitos.",
                sound: true,
            },
            trigger: {
                hour: hour,
                minute: minute,
                repeats: true
            },
        });
    },
};

export default NotificationService;