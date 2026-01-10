import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { auth, db, storage } from '../../../firebaseConfig';
import { useTheme } from '../../context/ThemeContext';
import AuthService from '../../services/authService';

import ChallengeService from '../../services/challengeService';
import GamificationService from '../../services/gamificationService';
import HabitService from '../../services/habitService';
import { getLevelInfo } from '../../services/xpService';

const PRESET_AVATARS = ['😎', '🦊', '🚀', '⚡', '👑', '🧘', '💀', '🤖'];

export default function ProfileScreen({ navigation }) {
  const { theme, toggleTheme, isDark } = useTheme();
  const { colors } = theme;
  const user = auth.currentUser;

  const [userData, setUserData] = useState({
    displayName: user?.displayName || 'Usuario',
    email: user?.email,
    avatar: '👤',
    totalXP: 0,
    streakShields: 0 // Leemos escudos
  });
  const [levelInfo, setLevelInfo] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [badges, setBadges] = useState([]);
  const [stats, setStats] = useState({ habits: 0, streak: 0, friends: 0 });

  useEffect(() => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserData({
          displayName: data.username || user.displayName || 'Usuario',
          email: data.email || user.email,
          avatar: data.avatar || '👤',
          totalXP: data.totalXP || 0,
          streakShields: data.streakShields || 0
        });
        const info = getLevelInfo(data.totalXP || 0);
        setLevelInfo(info);
      }
    });
    return () => unsubscribe();
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      const loadStatsAndBadges = async () => {
        if (!user) return;
        try {
          const habits = await HabitService.getUserHabits(user.uid);
          const maxStreak = habits.reduce((max, h) => Math.max(max, h.currentStreak || 0), 0);
          const challenges = await ChallengeService.getMyChallenges(user.uid);
          const daysSinceCreation = 10;

          setStats(prev => ({ ...prev, habits: habits.length, streak: maxStreak }));

          const calculationData = {
            habitsCount: habits.length,
            challengesCount: challenges.length,
            friendsCount: 0,
            maxStreak,
            daysSinceCreation
          };
          const calculatedBadges = GamificationService.calculateBadges(calculationData);
          setBadges(calculatedBadges);
        } catch (error) { console.error("Error stats:", error); }
      };
      loadStatsAndBadges();
    }, [])
  );

  const saveToFirestore = async (newValue) => {
    try { await updateDoc(doc(db, 'users', user.uid), { avatar: newValue }); }
    catch (error) { Alert.alert("Error", "No se pudo actualizar"); }
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.5,
    });
    if (!result.canceled) handleUploadImage(result.assets[0].uri);
  };

  const handleUploadImage = async (uri) => {
    setUploading(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const storageRef = ref(storage, `avatars/${user.uid}`);
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);
      await saveToFirestore(downloadURL);
    } catch (error) { Alert.alert("Error", "Fallo subida"); } finally { setUploading(false); }
  };

  const renderAvatar = () => {
    if (uploading) return <ActivityIndicator color={colors.primary} />;
    const isImage = userData.avatar && userData.avatar.length > 10 && userData.avatar.startsWith('http');
    if (isImage) return <Image source={{ uri: userData.avatar }} style={styles.avatarImage} />;
    return <Text style={styles.avatarEmoji}>{userData.avatar}</Text>;
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <Text style={[styles.screenTitle, { color: colors.text }]}>Perfil</Text>
      </View>

      <View style={[styles.profileCard, { backgroundColor: colors.card, shadowColor: colors.text }]}>
        <TouchableOpacity onPress={pickImage} style={[styles.avatarContainer, { borderColor: colors.background }]}>
          {renderAvatar()}
          <View style={[styles.cameraBadge, { backgroundColor: colors.primary, borderColor: colors.card }]}>
            <Ionicons name="camera" size={12} color="#fff" />
          </View>
        </TouchableOpacity>

        <Text style={[styles.userName, { color: colors.text }]}>{userData.displayName}</Text>
        <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{userData.email}</Text>

        {levelInfo && (
          <TouchableOpacity
            style={{ width: '100%', paddingHorizontal: 20, marginBottom: 20, marginTop: 10 }}
            onPress={() => navigation.navigate('LevelsList', { currentXP: levelInfo.currentXP })}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
              <Text style={{ color: levelInfo.color, fontWeight: 'bold', fontSize: 13 }}>
                Nvl {levelInfo.level} • {levelInfo.title}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: colors.textSecondary, fontSize: 11, marginRight: 5 }}>Ver niveles</Text>
                <Ionicons name="chevron-forward" size={12} color={colors.textSecondary} />
              </View>
            </View>
            <View style={{ height: 6, backgroundColor: isDark ? '#333' : '#E0E0E0', borderRadius: 3, overflow: 'hidden' }}>
              <View style={{ height: '100%', width: `${Math.min(levelInfo.progress * 100, 100)}%`, backgroundColor: levelInfo.color }} />
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: 10, marginTop: 4, textAlign: 'right' }}>
              {levelInfo.currentXP} / {levelInfo.nextLevelXP} XP
            </Text>
          </TouchableOpacity>
        )}

        <View style={[styles.statsRow, { borderColor: colors.border }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.text }]}>{stats.habits}</Text>
            <Text style={styles.statLabel}>Hábitos</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.text }]}>{stats.streak}🔥</Text>
            <Text style={styles.statLabel}>Racha</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.text }]}>{stats.friends}</Text>
            <Text style={styles.statLabel}>Amigos</Text>
          </View>
        </View>
      </View>

      {/* --- INVENTARIO DE OBJETOS --- */}
      <View style={styles.sectionContainer}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginBottom: 10 }]}>TU INVENTARIO</Text>

        <View style={[styles.shopCard, { backgroundColor: colors.card, shadowColor: colors.text }]}>
          <View style={[styles.shopIconBg, { backgroundColor: 'rgba(76, 217, 100, 0.15)' }]}>
            <Ionicons name="shield-checkmark" size={32} color="#4CD964" />
          </View>
          <View style={{ flex: 1, paddingHorizontal: 15 }}>
            <Text style={[styles.itemTitle, { color: colors.text }]}>Escudo de Racha</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
              Disponibles: <Text style={{ fontWeight: 'bold', color: '#4CD964', fontSize: 15 }}>{userData.streakShields || 0}</Text>
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 4, fontStyle: 'italic' }}>
              Se consumen automáticamente si fallas.
            </Text>
          </View>

          {/* Badge informativo en vez de botón comprar */}
          <View style={styles.infoBadge}>
            <Text style={styles.infoBadgeText}>+1 / NIVEL</Text>
          </View>
        </View>
      </View>

      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>LOGROS</Text>
          <View style={styles.counterBadge}>
            <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 12 }}>
              {badges.filter(b => b.unlocked).length} / {badges.length}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.trophyCard, { backgroundColor: isDark ? '#1F2937' : '#fff', shadowColor: "#FFD700" }]}
          onPress={() => navigation.navigate('BadgesList', { badges })}
        >
          <View style={[styles.trophyIconBg, { backgroundColor: isDark ? '#333' : '#FFF9C4' }]}>
            <Ionicons name="trophy" size={28} color="#FFD700" />
          </View>
          <View style={{ flex: 1, marginLeft: 15 }}>
            <Text style={[styles.trophyTitle, { color: colors.text }]}>Sala de Trofeos</Text>
            <View style={styles.miniProgressBarBg}>
              <View style={[styles.miniProgressBarFill, { width: `${badges.length > 0 ? (badges.filter(b => b.unlocked).length / badges.length) * 100 : 0}%` }]} />
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 4 }}>Consulta tu progreso</Text>
          </View>
          <View style={[styles.arrowBg, { backgroundColor: isDark ? '#333' : '#F5F5F5' }]}>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.sectionContainer}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginBottom: 10 }]}>PREFERENCIAS</Text>
        <View style={[styles.settingsCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.settingLabel, { color: colors.text, marginBottom: 10 }]}>Avatar Rápido</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {PRESET_AVATARS.map(emoji => (
              <TouchableOpacity
                key={emoji}
                onPress={() => saveToFirestore(emoji)}
                style={[styles.emojiOption, { backgroundColor: isDark ? '#333' : '#F7F8FA' }]}
              >
                <Text style={{ fontSize: 20 }}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        <TouchableOpacity style={[styles.settingsItem, { backgroundColor: colors.card }]} onPress={toggleTheme}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={[styles.iconBox, { backgroundColor: isDark ? '#444' : '#FFF3E0' }]}>
              <Ionicons name={isDark ? "moon" : "sunny"} size={18} color={isDark ? "#fff" : "#FF9800"} />
            </View>
            <Text style={[styles.settingText, { color: colors.text }]}>Modo Oscuro</Text>
          </View>
          <Ionicons name={isDark ? "toggle" : "toggle-outline"} size={28} color={colors.primary} />
        </TouchableOpacity>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <TouchableOpacity style={styles.settingsItem} onPress={() => AuthService.logout()}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={[styles.iconBox, { backgroundColor: '#FFEBEE' }]}>
              <Ionicons name="log-out" size={20} color="#D32F2F" />
            </View>
            <Text style={[styles.settingText, { color: colors.danger }]}>Cerrar Sesión</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
      <Text style={[styles.version, { color: colors.textSecondary }]}>WeHabit v1.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, marginBottom: 20 },
  screenTitle: { fontSize: 32, fontWeight: '800' },
  profileCard: { marginHorizontal: 20, borderRadius: 24, padding: 20, alignItems: 'center', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 5, marginBottom: 30 },
  avatarContainer: { width: 100, height: 100, borderRadius: 50, borderWidth: 4, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  avatarImage: { width: '100%', height: '100%', borderRadius: 50 },
  avatarEmoji: { fontSize: 50 },
  cameraBadge: { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 2 },
  userName: { fontSize: 20, fontWeight: 'bold', marginBottom: 2 },
  userEmail: { fontSize: 14, marginBottom: 10 },
  statsRow: { flexDirection: 'row', width: '100%', borderTopWidth: 1, paddingTop: 15, justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: 'bold' },
  statLabel: { fontSize: 12, color: '#888', marginTop: 2 },
  statDivider: { width: 1, height: '80%', alignSelf: 'center' },
  sectionContainer: { marginBottom: 25, paddingHorizontal: 20 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingHorizontal: 5 },
  sectionTitle: { fontSize: 13, fontWeight: '700', letterSpacing: 1, marginBottom: 0 },
  counterBadge: { backgroundColor: 'rgba(74, 144, 226, 0.1)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  trophyCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 4 },
  trophyIconBg: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  trophyTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  miniProgressBarBg: { height: 4, width: '100%', backgroundColor: '#eee', borderRadius: 2, overflow: 'hidden' },
  miniProgressBarFill: { height: '100%', backgroundColor: '#FFD700' },
  arrowBg: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  settingsCard: { borderRadius: 16, padding: 15, marginBottom: 10 },
  settingsItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderRadius: 16 },
  settingLabel: { fontSize: 14, fontWeight: '600' },
  emojiOption: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  iconBox: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  settingText: { fontSize: 16, fontWeight: '500' },
  divider: { height: 1, marginVertical: 5 },
  version: { textAlign: 'center', fontSize: 12, marginBottom: 20 },

  // --- NUEVO ESTILO DE INVENTARIO ---
  shopCard: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 20, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  shopIconBg: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  itemTitle: { fontWeight: 'bold', fontSize: 15 },
  infoBadge: { backgroundColor: 'rgba(255, 152, 0, 0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  infoBadgeText: { color: '#FF9800', fontWeight: 'bold', fontSize: 10 }
});