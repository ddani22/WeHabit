import AsyncStorage from '@react-native-async-storage/async-storage'; // <--- IMPORTAR
import { NavigationContainer } from '@react-navigation/native';
import { onAuthStateChanged } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { auth } from '../../firebaseConfig';

import AppTabs from './AppTabs';
import AuthStack from './AuthStack';

export default function RootNavigator() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Estado para saber si es la primera vez
  const [isFirstLaunch, setIsFirstLaunch] = useState(null);

  useEffect(() => {
    // 1. Verificar si ya vio el onboarding
    const checkOnboarding = async () => {
      try {
        const value = await AsyncStorage.getItem('hasSeenOnboarding');
        if (value === null) {
          setIsFirstLaunch(true); // Primera vez
        } else {
          setIsFirstLaunch(false); // Ya lo vio
        }
      } catch (e) {
        setIsFirstLaunch(false);
      }
    };

    checkOnboarding();

    // 2. Suscripción a Firebase Auth
    const unsubscribe = onAuthStateChanged(auth, (authenticatedUser) => {
      setUser(authenticatedUser ? authenticatedUser : null);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Esperamos a que cargue Auth Y la comprobación de Onboarding
  if (loading || isFirstLaunch === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {user ? (
        <AppTabs />
      ) : (
        // Pasamos la decisión al AuthStack
        <AuthStack initialRouteName={isFirstLaunch ? "Onboarding" : "Login"} />
      )}
    </NavigationContainer>
  );
}