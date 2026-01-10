import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import RootNavigator from './src/navigation/RootNavigator';

// Importar el servicio refactorizado
import NotificationService from './src/services/notificationService';

const MainLayout = () => {
  const { isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <RootNavigator />
    </>
  );
};

export default function App() {

  // --- LÓGICA DE INICIO ---
  useEffect(() => {
    const initNotifications = async () => {
      // Intentamos programar el recordatorio por defecto (18:00)
      // PERO pasamos 'false' como tercer argumento para NO sobrescribir
      // si el usuario ya configuró otra hora anteriormente.
      await NotificationService.scheduleDailyReminder(18, 0, false);
    };

    initNotifications();
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <MainLayout />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}