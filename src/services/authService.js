import {
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  signInWithEmailAndPassword
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig'; // Ajusta la ruta según donde esté tu config

/**
 * Servicio de Autenticación y Gestión de Usuarios.
 * Sigue el patrón Facade para abstraer la complejidad de Firebase.
 */
const AuthService = {

  /**
   * Registra un nuevo usuario y crea su documento en Firestore.
   * @param {string} email 
   * @param {string} password 
   * @param {string} username 
   * @returns {Promise<Object>} El objeto de usuario combinado (Auth + Firestore Data)
   */
  register: async (email, password, username) => {
    try {
      // 1. Crear usuario en Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Definir datos iniciales del documento de usuario
      // NOTA: Inicializamos friendList vacío y createdAt para auditoría.
      const userData = {
        id: user.uid,
        email: user.email,
        username: username.trim(),
        friendList: [],
        avatarUrl: null,
        createdAt: new Date().toISOString(),
      };

      // 3. Crear documento en Firestore (users collection)
      await setDoc(doc(db, 'users', user.uid), userData);

      return userData;
    } catch (error) {
      // Estandarización de errores para la UI
      throw _handleAuthError(error);
    }
  },

  /**
   * Inicia sesión y recupera datos extra del perfil.
   * @param {string} email 
   * @param {string} password 
   * @returns {Promise<Object>} Datos del usuario
   */
  login: async (email, password) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Recuperar datos extendidos de Firestore
      const userDoc = await getDoc(doc(db, 'users', user.uid));

      if (userDoc.exists()) {
        return { ...userDoc.data(), id: user.uid };
      } else {
        // Edge Case: Usuario existe en Auth pero no en Firestore (Data corruption)
        throw new Error("PERFIL_NO_ENCONTRADO");
      }
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

  /**
   * Envía un correo de recuperación de contraseña.
   * @param {string} email
   */
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
 * Helper privado para traducir códigos de error de Firebase a mensajes humanos.
 * Esto mejora la UX drásticamente.
 */
const _handleAuthError = (error) => {
  let message = "Ocurrió un error inesperado.";
  const code = error.code || '';

  if (code.includes('auth/email-already-in-use')) message = "El correo ya está registrado.";
  if (code.includes('auth/invalid-email')) message = "El formato del correo es inválido.";
  if (code.includes('auth/user-not-found')) message = "No existe cuenta con este correo."; // <--- Útil para recover
  if (code.includes('auth/wrong-password')) message = "Credenciales incorrectas.";
  if (code.includes('auth/weak-password')) message = "La contraseña es muy débil.";
  if (code.includes('auth/too-many-requests')) message = "Demasiados intentos. Espera unos minutos.";

  return { code, message, originalError: error };
};

export default AuthService;