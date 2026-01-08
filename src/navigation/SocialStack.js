import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../context/ThemeContext';
import ChallengeFormScreen from '../screens/challenges/ChallengeFormScreen';
import CreateChallengeScreen from '../screens/challenges/CreateChallengeScreen'; // <--- 1. IMPORTAR LA PANTALLA
import SocialScreen from '../screens/social/SocialScreen';

const Stack = createNativeStackNavigator();

export default function SocialStack() {
  const { theme } = useTheme();
  const { colors } = theme;

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.card,
        },
        headerTintColor: colors.text,
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

      {/* 2. REGISTRAR LA RUTA "CreateChallenge" */}
      <Stack.Screen
        name="CreateChallenge"
        component={CreateChallengeScreen}
        options={{
          title: 'Nuevo Reto',
          headerBackTitle: 'Volver'
        }}
      />

      {/* Mantengo esta por si la usas para retos directos desde perfil de amigo */}
      <Stack.Screen
        name="ChallengeForm"
        component={ChallengeFormScreen}
        options={{
          title: 'Desafiar Amigo',
          headerBackTitle: 'Volver'
        }}
      />
    </Stack.Navigator>
  );
}