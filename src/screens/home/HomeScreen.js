import { Ionicons } from '@expo/vector-icons';
import {
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where
} from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View
} from 'react-native';
import { auth, db } from '../../../firebaseConfig';
import ConfettiOverlay from '../../components/ConfettiOverlay';
import { useTheme } from '../../context/ThemeContext';
import ChallengeService from '../../services/challengeService';
import FeedbackService from '../../services/feedbackService';
import HabitService from '../../services/habitService';

if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

// Helpers
const getLocalTodayDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDaysDiff = (dateString) => {
  if (!dateString) return 999;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const last = new Date(dateString);
  last.setHours(0, 0, 0, 0);
  return Math.ceil((now - last) / (1000 * 60 * 60 * 24));
};

export default function HomeScreen({ navigation }) {
  const { theme, isDark } = useTheme();
  const { colors } = theme;
  const user = auth.currentUser;

  const [showConfetti, setShowConfetti] = useState(false);
  const [habits, setHabits] = useState([]);
  const [completedIds, setCompletedIds] = useState([]);
  const [userName, setUserName] = useState(user?.displayName || 'Usuario');
  const [userAvatar, setUserAvatar] = useState(null);

  // --- LISTENERS ---
  useEffect(() => {
    if (!user) return;

    // Listener de Usuario
    const unsubUser = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserName(data.username || 'Usuario');
        setUserAvatar(data.avatar || null);
      }
    });

    const qHabits = query(
      collection(db, 'habits'),
      where("userId", "==", user.uid),
      where("isActive", "==", true)
    );

    const unsubHabits = onSnapshot(qHabits, (snapshot) => {
      const loadedHabits = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const habit = { id: docSnap.id, ...data };
        if (habit.currentStreak > 0) {
          const daysDiff = getDaysDiff(habit.lastCompletedDate);
          if (daysDiff > 1) {
            habit.currentStreak = 0;
            updateDoc(doc(db, 'habits', habit.id), { currentStreak: 0 }).catch(e => console.warn(e));
          }
        }
        loadedHabits.push(habit);
      });
      setHabits(loadedHabits);
    });

    const today = getLocalTodayDate();
    const qLogs = query(
      collection(db, 'logs'),
      where("userId", "==", user.uid),
      where("date", "==", today)
    );

    const unsubLogs = onSnapshot(qLogs, (snapshot) => {
      const ids = snapshot.docs.map(doc => doc.data().habitId);
      setCompletedIds(ids);
    });

    return () => { unsubUser(); unsubHabits(); unsubLogs(); };
  }, [user]);

  // --- ACCIONES ---
  const handleCheckIn = async (habitItem) => {
    const habitId = habitItem.id;
    const isCompleted = completedIds.includes(habitId);

    if (isCompleted) FeedbackService.triggerImpactLight();
    else { FeedbackService.triggerSuccess(); setShowConfetti(true); }

    try {
      if (isCompleted) await HabitService.undoCheckIn(habitId, user.uid);
      else {
        await HabitService.checkInHabit(habitId, user.uid);
        const challengeIds = await ChallengeService.findActiveChallengesByHabit(user.uid, habitItem.name);
        if (challengeIds.length > 0) {
          for (const challengeId of challengeIds) await ChallengeService.incrementScore(challengeId, user.uid);
        }
      }
    } catch (error) { Alert.alert("Error", "No se pudo guardar el progreso."); }
  };

  const handleHabitLongPress = (habitItem) => {
    FeedbackService.triggerImpactHeavy();
    Alert.alert("Gestionar Hábito", `¿Qué hacer con "${habitItem.name}"?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Editar", onPress: () => navigation.navigate('CreateHabit', { habitToEdit: habitItem }) },
      { text: "Eliminar", style: "destructive", onPress: async () => { try { await HabitService.deleteHabit(habitItem.id, user.uid); } catch (error) { Alert.alert("Error", "No se pudo eliminar."); } } }
    ]
    );
  };

  // --- AGRUPACIÓN ---
  const groupedCategories = useMemo(() => {
    const grouped = {};
    habits.forEach(habit => {
      const catId = habit.categoryId || 'other';
      if (!grouped[catId]) {
        grouped[catId] = {
          meta: {
            id: catId,
            label: habit.categoryLabel || 'General',
            color: habit.categoryColor || '#8E8E93'
          },
          items: []
        };
      }
      grouped[catId].items.push(habit);
    });
    return Object.values(grouped);
  }, [habits]);

  // Stats
  const totalHabits = habits.length;
  const validCompletedIds = completedIds.filter(id => habits.some(h => h.id === id));
  const completedCount = validCompletedIds.length;
  const progressPercent = totalHabits > 0 ? Math.round((completedCount / totalHabits) * 100) : 0;
  const totalRachas = habits.reduce((acc, h) => acc + (h.currentStreak || 0), 0);

  // --- RENDERIZADORES ---
  const renderHabitItem = (item, categoryColor) => {
    const isCompleted = completedIds.includes(item.id);
    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.habitRow, { backgroundColor: colors.card, borderColor: isDark ? '#333' : '#f0f0f0' }]}
        onLongPress={() => handleHabitLongPress(item)}
        delayLongPress={500}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('HabitDetail', { habit: item })}
      >
        <View style={[styles.iconContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#F5F5F7' }]}>
          <Text style={{ fontSize: 20 }}>{item.icon}</Text>
        </View>

        <View style={{ flex: 1, marginRight: 10 }}>
          <Text style={[styles.habitTitle, { color: colors.text, textDecorationLine: isCompleted ? 'line-through' : 'none', opacity: isCompleted ? 0.5 : 1 }]}>
            {item.name}
          </Text>
          {item.currentStreak > 0 && (
            <Text style={{ fontSize: 11, color: categoryColor, fontWeight: '600', marginTop: 2 }}>
              🔥 {item.currentStreak} días
            </Text>
          )}
        </View>

        <TouchableOpacity onPress={() => handleCheckIn(item)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          {isCompleted ? (
            <Ionicons name="checkmark-circle" size={28} color={categoryColor || colors.primary} />
          ) : (
            <View style={[styles.radioUnchecked, { borderColor: isDark ? '#555' : '#ddd' }]} />
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* HEADER LIMPIO */}
        <View style={styles.minimalHeader}>
          <View>
            <Text style={[styles.greeting, { color: colors.textSecondary }]}>Hola,</Text>
            <Text style={[styles.username, { color: colors.text }]}>{userName}</Text>
          </View>

          {/* CORREGIDO: Navega a 'ProfileTab' que es el nombre en AppTabs.js */}
          <TouchableOpacity
            onPress={() => navigation.navigate('ProfileTab')}
            style={[styles.profileIcon, { backgroundColor: colors.card, overflow: 'hidden' }]}
          >
            {userAvatar && (userAvatar.startsWith('http') || userAvatar.startsWith('file')) ? (
              <Image source={{ uri: userAvatar }} style={{ width: '100%', height: '100%' }} />
            ) : (
              <Text style={{ fontSize: 20 }}>{userAvatar || '👤'}</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* STATS ROW */}
        <View style={styles.statsRow}>
          <View style={[styles.statItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.text }]}>{completedCount}/{totalHabits}</Text>
            <Text style={styles.statLabel}>Hechos</Text>
          </View>
          <View style={[styles.statItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.text }]}>{progressPercent}%</Text>
            <Text style={styles.statLabel}>Progreso</Text>
          </View>
          <View style={[styles.statItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.text }]}>{totalRachas}</Text>
            <Text style={styles.statLabel}>Fuegos</Text>
          </View>
        </View>

        {/* LISTA HÁBITOS */}
        <View style={{ marginTop: 10 }}>
          {habits.length > 0 ? (
            groupedCategories.map(group => (
              <View key={group.meta.id} style={styles.categorySection}>
                <Text style={[styles.categoryHeader, { color: group.meta.color }]}>
                  {group.meta.label.toUpperCase()}
                </Text>
                <View style={styles.habitsList}>
                  {group.items.map(habit => renderHabitItem(habit, group.meta.color))}
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="leaf-outline" size={60} color={colors.textSecondary} style={{ opacity: 0.3 }} />
              <Text style={{ color: colors.textSecondary, marginTop: 10 }}>Tu día está limpio. ¡Crea un hábito!</Text>
            </View>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('CreateHabit')}>
        <View style={[styles.fabCircle, { backgroundColor: colors.text }]}>
          <Ionicons name="add" size={32} color={colors.background} />
        </View>
      </TouchableOpacity>

      <ConfettiOverlay isVisible={showConfetti} onAnimationFinish={() => setShowConfetti(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20 },

  minimalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25, marginTop: 10 },
  greeting: { fontSize: 16 },
  username: { fontSize: 30, fontWeight: '800' },
  profileIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },

  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  statItem: { width: '31%', paddingVertical: 15, borderRadius: 16, alignItems: 'center', borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 3, elevation: 1 },
  statValue: { fontSize: 18, fontWeight: 'bold' },
  statLabel: { fontSize: 11, color: '#888', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },

  categorySection: { marginBottom: 25 },
  categoryHeader: { fontSize: 12, fontWeight: '700', letterSpacing: 1.2, marginBottom: 12, marginLeft: 5 },
  habitsList: { gap: 10 },

  habitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 1
  },
  iconContainer: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  habitTitle: { fontSize: 16, fontWeight: '600' },
  radioUnchecked: { width: 26, height: 26, borderRadius: 13, borderWidth: 2 },

  emptyState: { alignItems: 'center', marginTop: 60 },

  fab: { position: 'absolute', right: 25, bottom: 30 },
  fabCircle: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', shadowColor: "#000", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 }
});