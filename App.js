import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react'; // <--- Importar useEffect
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import RootNavigator from './src/navigation/RootNavigator';

// Importar el servicio nuevo
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
    NotificationService.scheduleDailyReminder(18, 0);
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <MainLayout />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}