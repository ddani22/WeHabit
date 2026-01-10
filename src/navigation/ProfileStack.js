import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../context/ThemeContext';

// Importamos las pantallas
import BadgesScreen from '../screens/profile/BadgesScreen';
import LevelsScreen from '../screens/profile/LevelsScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';

const Stack = createNativeStackNavigator();

export default function ProfileStack() {
    const { theme } = useTheme();

    return (
        <Stack.Navigator
            screenOptions={{
                headerStyle: { backgroundColor: theme.colors.background },
                headerTintColor: theme.colors.text,
                headerTitleStyle: { fontWeight: 'bold' },
                headerShadowVisible: false, // Estilo limpio tipo iOS
                headerBackTitleVisible: false, // Solo flecha atrás
            }}
        >
            <Stack.Screen
                name="Profile"
                component={ProfileScreen}
                options={{ headerShown: false }} // El perfil tiene su propia cabecera personalizada
            />

            {/* NOMBRES DE RUTAS ESTANDARIZADOS */}
            <Stack.Screen
                name="LevelsList"
                component={LevelsScreen}
                options={{ title: 'Niveles' }}
            />

            <Stack.Screen
                name="BadgesList"
                component={BadgesScreen}
                options={{ title: 'Medallas' }}
            />
        </Stack.Navigator>
    );
}