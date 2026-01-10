import {
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  signInWithEmailAndPassword
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';

/**
 * Servicio de Autenticación y Gestión de Usuarios.
 * PATRÓN FACADE + SELF-HEALING
 */
const AuthService = {

  /**
   * Registra un nuevo usuario con el SCHEMA COMPLETO inicializado.
   * Evita errores de "undefined" en gamificación y configuración.
   */
  register: async (email, password, username) => {
    try {
      // 1. Crear usuario en Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Definir datos iniciales (SCHEMA ROBUSTO)
      const userData = {
        id: user.uid,
        email: user.email,
        username: username.trim(),
        avatarUrl: null,

        // Relaciones
        friendList: [],

        // Gamificación (Inicialización vital para UserService)
        totalXP: 0,
        level: 1,

        // Personalización
        customCategories: [],

        // Configuración
        settings: {
          notificationsEnabled: true,
          theme: 'system'
        },

        // Auditoría
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString()
      };

      // 3. Crear documento en Firestore
      await setDoc(doc(db, 'users', user.uid), userData);

      return userData;
    } catch (error) {
      throw _handleAuthError(error);
    }
  },

  /**
   * Inicia sesión con mecanismo de AUTO-CURACIÓN.
   * Si el perfil de Firestore no existe, lo regenera.
   */
  login: async (email, password) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const userRef = doc(db, 'users', user.uid);

      // Recuperar datos extendidos
      let userDoc = await getDoc(userRef);

      // --- SELF-HEALING START ---
      if (!userDoc.exists()) {
        console.warn(`⚠️ Perfil no encontrado para ${user.email}. Regenerando...`);

        // Reconstruimos un perfil básico para salvar la cuenta
        const recoveryData = {
          id: user.uid,
          email: user.email,
          username: user.email.split('@')[0], // Fallback de nombre
          friendList: [],
          totalXP: 0,
          customCategories: [],
          createdAt: new Date().toISOString(),
          recoveredAt: new Date().toISOString()
        };

        await setDoc(userRef, recoveryData);
        userDoc = await getDoc(userRef); // Leer de nuevo
      }
      // --- SELF-HEALING END ---

      return { ...userDoc.data(), id: user.uid };
    } catch (error) {
      throw _handleAuthError(error);
    }
  },

  logout: async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error("Error al cerrar sesión", error);
    }
  },

  recoverPassword: async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
      return true;
    } catch (error) {
      throw _handleAuthError(error);
    }
  },
};

/**
 * Helper de Errores
 */
const _handleAuthError = (error) => {
  let message = "Ocurrió un error inesperado.";
  const code = error.code || '';

  if (code.includes('auth/email-already-in-use')) message = "El correo ya está registrado.";
  if (code.includes('auth/invalid-email')) message = "El formato del correo es inválido.";
  if (code.includes('auth/user-not-found') || code.includes('auth/invalid-credential')) message = "Credenciales incorrectas.";
  if (code.includes('auth/wrong-password')) message = "Contraseña incorrecta.";
  if (code.includes('auth/weak-password')) message = "La contraseña es muy débil (mínimo 6 caracteres).";
  if (code.includes('auth/too-many-requests')) message = "Cuenta bloqueada temporalmente por seguridad. Intenta más tarde.";

  return { code, message, originalError: error };
};

export default AuthService;