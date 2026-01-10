import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';

const AuthService = {
  login: async (email, password) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      throw error;
    }
  },

  register: async (email, password, username) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await updateProfile(user, { displayName: username });

      // CREAR DOCUMENTO DE USUARIO INICIAL
      await setDoc(doc(db, 'users', user.uid), {
        username: username,
        email: email,
        createdAt: new Date(),
        avatar: '👤',
        xp: 0,
        totalXP: 0,
        level: 1,
        streakShields: 1, // <--- CAMBIO: Empiezan con 1 Escudo
        friendList: []
      });

      return user;
    } catch (error) {
      throw error;
    }
  },

  logout: async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error(error);
    }
  }
};

export default AuthService;