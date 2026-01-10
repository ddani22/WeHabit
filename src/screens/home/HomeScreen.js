import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
  Platform,
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

// Helpers de fecha locales
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

  // --- LISTENERS EN TIEMPO REAL ---
  useEffect(() => {
    if (!user) return;

    const unsubUser = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) setUserName(docSnap.data().username || 'Usuario');
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

  // --- ACCIONES DE HÁBITOS (Solo estas quedan activas) ---
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
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            // AHORA PASAMOS user.uid TAMBIÉN
            await HabitService.deleteHabit(habitItem.id, user.uid);
          } catch (error) {
            Alert.alert("Error", "No se pudo eliminar.");
          }
        }
      }
    ]
    );
  };

  // NOTA: He eliminado handleCategoryLongPress porque ya no se usará.

  // --- MEMOIZACIÓN (LISTA ÚNICA) ---
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

  // --- RENDERIZADOR HÁBITO (HÍBRIDO POSITIVO/NEGATIVO) ---
  const renderMiniHabit = (item) => {
    const isNegative = item.type === 'negative';
    const isCompleted = completedIds.includes(item.id);

    // ACCIÓN HÁBITO NEGATIVO (Reset)
    const handleNegativePress = () => {
      Alert.alert(
        "Reiniciar Contador",
        `¿Has recaído en "${item.name}"? El contador volverá a 0.`,
        [
          { text: "No, falsa alarma", style: "cancel" },
          {
            text: "Sí, he fallado",
            style: "destructive",
            onPress: async () => {
              try {
                await HabitService.resetNegativeHabit(item.id);
                FeedbackService.triggerError(); // Vibración de fallo
              } catch (e) { Alert.alert("Error", "No se pudo reiniciar"); }
            }
          }
        ]
      );
    };

    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.miniHabitRow, isNegative && { backgroundColor: 'rgba(255, 59, 48, 0.1)' }]}
        onLongPress={() => handleHabitLongPress(item)}
        delayLongPress={500}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('HabitDetail', { habit: item })}
      >
        <View style={styles.miniHabitIcon}><Text style={{ fontSize: 12 }}>{item.icon}</Text></View>

        <View style={{ flex: 1, marginRight: 10 }}>
          <Text style={[styles.miniHabitName, isNegative && { color: colors.danger }]} numberOfLines={1}>{item.name}</Text>
          {isNegative && (
            <Text style={{ fontSize: 10, color: colors.textSecondary }}>
              {item.currentStreak} días libre
            </Text>
          )}
        </View>

        {isNegative ? (
          // BOTÓN RESET (Solo para hábitos negativos)
          <TouchableOpacity onPress={handleNegativePress} style={styles.resetBtn}>
            <Ionicons name="refresh" size={16} color={colors.danger} />
          </TouchableOpacity>
        ) : (
          // CHECKBOX NORMAL (Para hábitos positivos)
          <TouchableOpacity onPress={() => handleCheckIn(item)}>
            {isCompleted ? <Ionicons name="checkmark-circle" size={24} color={colors.primary} /> : <View style={styles.radioUnchecked} />}
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const renderCategoryCard = (group) => {
    const previewItems = group.items.slice(0, 3);
    const hiddenCount = group.items.length - previewItems.length;

    return (
      // CAMBIO IMPORTANTE: Usamos View en lugar de TouchableOpacity
      // Esto desactiva cualquier interacción con la tarjeta en sí (ni click, ni long press)
      <View
        key={group.meta.id}
        style={[styles.categoryCard, { backgroundColor: group.meta.color }]}
      >
        <View style={styles.categoryHeader}>
          <Text style={styles.categoryTitle}>{group.meta.label}</Text>
          <Text style={styles.categoryCount}>{group.items.length} hábito{group.items.length !== 1 ? 's' : ''}</Text>
        </View>
        <View style={styles.habitsList}>
          {previewItems.map(habit => renderMiniHabit(habit))}
          {hiddenCount > 0 && <Text style={styles.moreText}>+ {hiddenCount} más...</Text>}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={{ height: 20 }} />

        {/* DASHBOARD */}
        <LinearGradient colors={['#FF00CC', '#FF9933']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.dashboardCard}>
          <View style={{ marginBottom: 15 }}>
            <Text style={styles.welcomeText}>Hola,</Text>
            <Text style={styles.usernameText}>{userName} 👋</Text>
          </View>
          <View style={styles.statsContainer}>
            <View style={styles.statBox}>
              <View style={styles.statIconBg}><Ionicons name="checkmark-circle-outline" size={20} color="#fff" /></View>
              <Text style={styles.statBigNumber}>{completedCount}/{totalHabits}</Text>
              <Text style={styles.statLabel}>Hechos</Text>
            </View>
            <View style={styles.statBox}>
              <View style={styles.statIconBg}><Ionicons name="trending-up" size={20} color="#fff" /></View>
              <Text style={styles.statBigNumber}>{progressPercent}%</Text>
              <Text style={styles.statLabel}>Progreso</Text>
            </View>
            <View style={styles.statBox}>
              <View style={styles.statIconBg}><Ionicons name="flame-outline" size={20} color="#fff" /></View>
              <Text style={styles.statBigNumber}>{totalRachas}</Text>
              <Text style={styles.statLabel}>Rachas</Text>
            </View>
          </View>
        </LinearGradient>

        {/* LISTA DE CATEGORÍAS (NO INTERACTIVAS) */}
        {habits.length > 0 ? (
          <View style={styles.categoriesListContainer}>
            {groupedCategories.map(group => renderCategoryCard(group))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={{ color: colors.textSecondary }}>No hay hábitos aún.</Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('CreateHabit')}>
        <LinearGradient colors={['#FF00CC', '#FF9933']} style={styles.fabGradient}>
          <Ionicons name="add" size={30} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>
      <ConfettiOverlay isVisible={showConfetti} onAnimationFinish={() => setShowConfetti(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 15 },
  dashboardCard: { borderRadius: 24, padding: 20, marginBottom: 20, marginTop: 40, shadowColor: "#FF00CC", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
  welcomeText: { color: 'rgba(255,255,255,0.8)', fontSize: 16 },
  usernameText: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  statsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  statBox: { alignItems: 'center', width: '30%' },
  statIconBg: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  statBigNumber: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  statLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 10, marginTop: 2 },

  categoriesListContainer: {
    gap: 15
  },
  categoryCard: {
    borderRadius: 20,
    padding: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },

  categoryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  categoryTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  categoryCount: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
  habitsList: { gap: 8 },
  moreText: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontStyle: 'italic', marginTop: 5 },
  miniHabitRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: 10 },
  miniHabitIcon: { marginRight: 10 },
  miniHabitName: { color: '#fff', fontWeight: 'bold', fontSize: 14, flex: 1, marginRight: 10 },
  radioUnchecked: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.6)' },
  emptyState: { alignItems: 'center', marginTop: 50 },
  fab: { position: 'absolute', right: 20, bottom: 20, borderRadius: 30, elevation: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4 },
  fabGradient: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center' }
});