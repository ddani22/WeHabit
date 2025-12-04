import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView, Platform,
  StyleSheet,
  Text, TextInput, TouchableOpacity,
  View
} from 'react-native';
import AuthService from '../../services/authService';
// IMPORTAR HOOK
import { useTheme } from '../../context/ThemeContext';

export default function LoginScreen({ navigation }) {
  // USAR HOOK
  const { theme, isDark } = useTheme();
  const { colors } = theme;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    // ... (Tu lógica de login no cambia) ...
    if (!email || !password) { Alert.alert('Error', 'Por favor completa todos los campos'); return; }
    setLoading(true);
    try { await AuthService.login(email, password); }
    catch (error) { Alert.alert('Error de Acceso', error.message); }
    finally { setLoading(false); }
  };

  const handleRecover = async () => {
    if (!email) {
      Alert.alert("Atención", "Por favor, escribe tu correo electrónico en el campo de arriba primero.");
      return;
    }

    try {
      await AuthService.recoverPassword(email);
      Alert.alert(
        "Correo Enviado",
        "Revisa tu bandeja de entrada (y spam). Hemos enviado un enlace para restablecer tu contraseña."
      );
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      // FONDO DINÁMICO
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View style={[
        styles.formContainer,
        // TARJETA DINÁMICA
        { backgroundColor: colors.card }
      ]}>
        <Text style={[styles.title, { color: colors.text }]}>WeHabit</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Inicia sesión para continuar</Text>

        <TextInput
          style={[styles.input, {
            backgroundColor: isDark ? '#333' : '#f0f0f0',
            color: colors.text
          }]}
          placeholder="Correo electrónico"
          placeholderTextColor={colors.textSecondary}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          style={[styles.input, {
            backgroundColor: isDark ? '#333' : '#f0f0f0',
            color: colors.text
          }]}
          placeholder="Contraseña"
          placeholderTextColor={colors.textSecondary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={styles.forgotButton}
          onPress={handleRecover}
        >
          <Text style={[styles.forgotText, { color: colors.textSecondary }]}>
            ¿Olvidaste tu contraseña?
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>INGRESAR</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => navigation.navigate('Register')}
        >
          <Text style={styles.linkText}>¿No tienes cuenta? Regístrate</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// Los estilos base se mantienen igual
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center' },
  formContainer: { padding: 20, marginHorizontal: 20, borderRadius: 15, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5 },
  title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
  subtitle: { fontSize: 16, textAlign: 'center', marginBottom: 30 },
  input: { padding: 15, borderRadius: 10, marginBottom: 15, fontSize: 16 },
  button: { backgroundColor: '#4A90E2', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  linkButton: { marginTop: 20, alignItems: 'center' },
  linkText: { color: '#4A90E2', fontSize: 14 },
  forgotButton: {
    alignSelf: 'flex-end', // Alinear a la derecha
    marginBottom: 20,
    paddingVertical: 5,
  },
  forgotText: {
    fontSize: 14,
    textDecorationLine: 'underline', // Subrayado para que parezca enlace
  },
});