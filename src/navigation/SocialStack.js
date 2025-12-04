import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ChallengeFormScreen from '../screens/challenges/ChallengeFormScreen';
import SocialScreen from '../screens/social/SocialScreen';
// 1. IMPORTAR HOOK
import { useTheme } from '../context/ThemeContext';

const Stack = createNativeStackNavigator();

export default function SocialStack() {
  // 2. USAR HOOK
  const { theme } = useTheme();
  const { colors } = theme;

  return (
    <Stack.Navigator
      screenOptions={{
        // 3. APLICAR ESTILOS DINÁMICOS
        headerStyle: {
          backgroundColor: colors.card,
        },
        headerTintColor: colors.text, // Esto cambia el color de la flecha "Atrás"
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen 
        name="SocialList" 
        component={SocialScreen} 
        options={{ headerShown: false }} 
      />
      <Stack.Screen 
        name="ChallengeForm" 
        component={ChallengeFormScreen} 
        options={{ 
          title: 'Nuevo Reto', 
          headerBackTitle: 'Volver'
        }} 
      />
    </Stack.Navigator>
  );
}