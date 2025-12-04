import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../context/ThemeContext';
import BadgesScreen from '../screens/profile/BadgesScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';

const Stack = createNativeStackNavigator();

export default function ProfileStack() {
    const { theme } = useTheme();
    const { colors } = theme;

    return (
        <Stack.Navigator
            screenOptions={{
                headerStyle: { backgroundColor: colors.card },
                headerTintColor: colors.text,
                headerShadowVisible: false,
            }}
        >
            <Stack.Screen
                name="ProfileMain"
                component={ProfileScreen}
                options={{ headerShown: false }} // El perfil ya tiene su propia cabecera bonita
            />
            <Stack.Screen
                name="BadgesList"
                component={BadgesScreen}
                options={{ title: 'Sala de Trofeos', headerBackTitle: 'Perfil' }}
            />
        </Stack.Navigator>
    );
}