import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeStack from './HomeStack';
import ProfileStack from './ProfileStack';
import SocialStack from './SocialStack';

// 1. IMPORTAMOS EL HOOK
import { useTheme } from '../context/ThemeContext';

const Tab = createBottomTabNavigator();

export default function AppTabs() {
  // 2. OBTENEMOS LOS COLORES
  const { theme, isDark } = useTheme();
  const { colors } = theme;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        // 3. ESTILOS DE LA BARRA INFERIOR
        tabBarStyle: {
          backgroundColor: colors.card, // Se pondrá negra o blanca
          borderTopColor: isDark ? '#333' : '#e0e0e0',
          paddingBottom: 5,
          height: 60,
        },
        // 4. COLORES DE LOS ICONOS ACTIVOS/INACTIVOS
        tabBarActiveTintColor: colors.primary, // Azul
        tabBarInactiveTintColor: isDark ? '#888' : 'gray', // Gris adaptado

        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'HomeTab') iconName = focused ? 'list' : 'list-outline';
          else if (route.name === 'SocialTab') iconName = focused ? 'people' : 'people-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStack}
        options={{ title: 'Mis Rachas' }}
      />
      <Tab.Screen
        name="SocialTab"
        component={SocialStack}
        options={{ title: 'Social' }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStack}
        options={{
          title: 'Perfil',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? "person" : "person-outline"} size={size} color={color} />
          )
        }}
      />
    </Tab.Navigator>
  );
}