import { createNativeStackNavigator } from '@react-navigation/native-stack';
import CreateHabitScreen from '../screens/home/CreateHabitScreen';
import HomeScreen from '../screens/home/HomeScreen';
// 1. IMPORTAR HOOK
import { useTheme } from '../context/ThemeContext';
import HabitDetailScreen from '../screens/home/HabitDetailScreen';

const Stack = createNativeStackNavigator();

export default function HomeStack() {
  // 2. USAR HOOK
  const { theme } = useTheme();
  const { colors } = theme;

  return (
    <Stack.Navigator
      screenOptions={{
        // 3. APLICAR ESTILOS DINÁMICOS AL HEADER
        headerStyle: {
          backgroundColor: colors.card, // Cabecera negra en dark mode
        },
        headerTintColor: colors.text, // Flecha y Texto blancos en dark mode
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        // Eliminar la línea divisoria fea en Android/iOS si quieres un look más limpio
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="HabitList"
        component={HomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CreateHabit"
        component={CreateHabitScreen}
        options={{
          title: 'Nuevo Hábito',
          headerBackTitle: 'Volver' // Texto del botón atrás (iOS)
        }}
      />

      <Stack.Screen
        name="HabitDetail"
        component={HabitDetailScreen}
        options={{ title: 'Progreso', headerBackTitle: 'Volver' }}
      />
    </Stack.Navigator>
  );
}