import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text, TextInput, TouchableOpacity,
  View
} from 'react-native';
import { auth } from '../../../firebaseConfig';
import ChallengeService from '../../services/challengeService';
// 1. IMPORTAR HOOK
import { useTheme } from '../../context/ThemeContext';

export default function ChallengeFormScreen({ route, navigation }) {
  const { friendId, friendName } = route.params;
  
  // 2. USAR HOOK
  const { theme, isDark } = useTheme();
  const { colors } = theme;

  const [habitName, setHabitName] = useState('');
  const [duration, setDuration] = useState('7');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!habitName.trim()) return Alert.alert("Falta información", "Ponle un nombre al reto.");
    setLoading(true);
    try {
      const currentUser = auth.currentUser;
      await ChallengeService.createChallenge(currentUser.uid, friendId, habitName, parseInt(duration));
      Alert.alert("¡Reto Lanzado! ⚔️", `Has desafiado a ${friendName}.`);
      navigation.goBack(); 
    } catch (error) {
      Alert.alert("Error", "No se pudo crear el reto.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Desafiar a {friendName}</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Configura las reglas del juego</Text>

      <Text style={[styles.label, { color: colors.text }]}>Nombre del Hábito a Competir</Text>
      <TextInput
        style={[styles.input, { 
            backgroundColor: isDark ? '#1E1E1E' : '#F7F8FA', 
            color: colors.text,
            borderColor: isDark ? '#333' : 'transparent',
            borderWidth: isDark ? 1 : 0
        }]}
        placeholder="Ej. 100 Flexiones..."
        placeholderTextColor={colors.textSecondary}
        value={habitName}
        onChangeText={setHabitName}
        autoFocus
      />

      <Text style={[styles.label, { color: colors.text }]}>Duración (Días)</Text>
      <View style={styles.durationContainer}>
        {['3', '7', '30'].map((d) => (
          <TouchableOpacity 
            key={d}
            style={[
                styles.durationBtn, 
                // Lógica de color de fondo de botones
                { backgroundColor: duration === d ? '#4A90E2' : (isDark ? '#333' : '#F7F8FA') }
            ]}
            onPress={() => setDuration(d)}
          >
            <Text style={[
                styles.durationText, 
                // Lógica de color de texto
                { color: duration === d ? '#fff' : colors.text }
            ]}>
              {d} Días
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity 
        style={styles.createButton} 
        onPress={handleCreate}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>¡LANZAR RETO!</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 5 },
  subtitle: { fontSize: 16, marginBottom: 30 },
  label: { fontSize: 16, fontWeight: '600', marginBottom: 10 },
  input: { padding: 15, borderRadius: 10, fontSize: 16, marginBottom: 25 },
  durationContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 40 },
  durationBtn: { flex: 1, padding: 15, borderRadius: 10, marginHorizontal: 5, alignItems: 'center' },
  durationText: { fontWeight: 'bold' },
  createButton: { backgroundColor: '#FF3B30', padding: 18, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 18 }
});