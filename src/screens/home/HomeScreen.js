import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { doc, getDoc } from 'firebase/firestore';
import { useCallback, useState } from 'react';
import {
  Alert, Platform,
  RefreshControl, ScrollView,
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
import UserService from '../../services/userService';

if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

export default function HomeScreen({ navigation }) {
  const { theme, isDark } = useTheme();
  const { colors } = theme;
  const user = auth.currentUser;
  const [showConfetti, setShowConfetti] = useState(false);
  const [habits, setHabits] = useState([]);
  const [completedIds, setCompletedIds] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserName] = useState(user?.displayName || 'Usuario');

  // --- CARGA DE DATOS ---
  const loadHabits = async () => {
    if (!user) return;
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        setUserName(userDoc.data().username || 'Usuario');
      }
      const habitsData = await HabitService.getUserHabits(user.uid);
      setHabits(habitsData);
      const todayLogs = await HabitService.getTodayLogs(user.uid);
      setCompletedIds(todayLogs);
    } catch (error) { console.error(error); }
    finally { setRefreshing(false); }
  };

  useFocusEffect(
    useCallback(() => { loadHabits(); }, [])
  );

  // --- 1. GESTIÓN DE HÁBITOS (Check, Editar, Borrar) ---
  const handleCheckIn = async (habitItem) => {
    const habitId = habitItem.id;
    const isCompleted = completedIds.includes(habitId);

    if (isCompleted) {
      FeedbackService.triggerImpactLight();
    } else {
      FeedbackService.triggerSuccess();
      setShowConfetti(true); // <--- ¡AQUÍ! Activamos la fiesta
    }

    if (isCompleted) {
      setCompletedIds(prev => prev.filter(id => id !== habitId));
      setHabits(prev => prev.map(h => h.id === habitId ? { ...h, currentStreak: Math.max(0, h.currentStreak - 1) } : h));
    } else {
      setCompletedIds(prev => [...prev, habitId]);
      setHabits(prev => prev.map(h => h.id === habitId ? { ...h, currentStreak: h.currentStreak + 1 } : h));
    }

    try {
      if (isCompleted) await HabitService.undoCheckIn(habitId, user.uid);
      else {
        await HabitService.checkInHabit(habitId, user.uid);
        const challengeIds = await ChallengeService.findActiveChallengesByHabit(user.uid, habitItem.name);
        if (challengeIds.length > 0) {
          for (const challengeId of challengeIds) await ChallengeService.incrementScore(challengeId, user.uid);
        }
      }
    } catch (error) { loadHabits(); }
  };

  // RESTAURADO: Menú de opciones del hábito
  const handleHabitLongPress = (habitItem) => {
    FeedbackService.triggerImpactHeavy();
    Alert.alert(
      "Gestionar Hábito",
      `¿Qué quieres hacer con "${habitItem.name}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Editar",
          onPress: () => navigation.navigate('CreateHabit', { habitToEdit: habitItem })
        },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await HabitService.deleteHabit(habitItem.id);
              loadHabits();
            } catch (error) {
              Alert.alert("Error", "No se pudo eliminar.");
            }
          }
        }
      ]
    );
  };

  // --- 2. GESTIÓN DE CATEGORÍAS (NUEVO: Borrar) ---
  const handleCategoryLongPress = (group) => {
    // Protegemos las categorías por defecto o especiales (si quisieras)
    // Aquí permitimos borrar cualquiera personalizada.

    FeedbackService.triggerImpactHeavy();
    Alert.alert(
      "Borrar Categoría",
      `¿Eliminar la categoría "${group.meta.label}"? Los hábitos se mantendrán pero perderán el grupo si editas.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              // Construimos el objeto original para borrarlo del array
              const categoryObject = {
                id: group.meta.id,
                label: group.meta.label,
                color: group.meta.color
              };
              await UserService.deleteCustomCategory(user.uid, categoryObject);
              Alert.alert("Eliminada", "Categoría borrada. Recarga para ver cambios.");
              loadHabits();
            } catch (e) {
              Alert.alert("Info", "No se pudo borrar (quizás es una categoría por defecto).");
            }
          }
        }
      ]
    );
  };

  // --- AGRUPACIÓN ---
  const groupedHabits = {};
  habits.forEach(habit => {
    const catId = habit.categoryId || 'other';
    if (!groupedHabits[catId]) {
      groupedHabits[catId] = {
        meta: {
          id: catId,
          label: habit.categoryLabel || 'General',
          color: habit.categoryColor || '#8E8E93'
        },
        items: []
      };
    }
    groupedHabits[catId].items.push(habit);
  });

  const categories = Object.values(groupedHabits);
  const leftColumn = categories.filter((_, i) => i % 2 === 0);
  const rightColumn = categories.filter((_, i) => i % 2 !== 0);

  // --- CÁLCULO STATS ---
  const totalHabits = habits.length;
  const completedCount = completedIds.length;
  const progressPercent = totalHabits > 0 ? Math.round((completedCount / totalHabits) * 100) : 0;
  const totalRachas = habits.reduce((acc, h) => acc + (h.currentStreak || 0), 0);

  // --- RENDERIZADORES ---

  const renderMiniHabit = (item) => {
    const isCompleted = completedIds.includes(item.id);
    return (
      <TouchableOpacity
        key={item.id}
        style={styles.miniHabitRow}
        // CONECTAMOS EL LONG PRESS AQUÍ
        onLongPress={() => handleHabitLongPress(item)}
        delayLongPress={500}
        activeOpacity={0.7}
        // Navegación normal al detalle
        onPress={() => navigation.navigate('HabitDetail', { habit: item })}
      >
        <View style={styles.miniHabitIcon}>
          <Text style={{ fontSize: 12 }}>{item.icon}</Text>
        </View>
        <Text style={styles.miniHabitName} numberOfLines={1}>{item.name}</Text>

        {/* El botón de check tiene su propio onPress que detiene la propagación */}
        <TouchableOpacity onPress={() => handleCheckIn(item)}>
          {isCompleted ? (
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
          ) : (
            <View style={styles.radioUnchecked} />
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderCategoryCard = (group) => {
    const previewItems = group.items.slice(0, 2);
    const hiddenCount = group.items.length - previewItems.length;

    return (
      <TouchableOpacity
        key={group.meta.id}
        style={[styles.categoryCard, { backgroundColor: group.meta.color }]}
        activeOpacity={0.9}
        onPress={() => navigation.navigate('CategoryDetail', { category: group, habits: group.items })}
        // CONECTAMOS EL LONG PRESS DE CATEGORÍA AQUÍ
        onLongPress={() => handleCategoryLongPress(group)}
        delayLongPress={600} // Un poco más largo para evitar accidentes
      >
        <View style={styles.categoryHeader}>
          <Text style={styles.categoryTitle}>{group.meta.label}</Text>
          <Text style={styles.categoryCount}>{group.items.length} hábito{group.items.length !== 1 ? 's' : ''}</Text>
        </View>

        <View style={styles.habitsList}>
          {previewItems.map(habit => renderMiniHabit(habit))}
          {hiddenCount > 0 && (
            <Text style={styles.moreText}>+ {hiddenCount} más...</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadHabits} tintColor={colors.text} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ height: 20 }} />

        {/* DASHBOARD */}
        <LinearGradient
          colors={['#FF00CC', '#FF9933']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.dashboardCard}
        >
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

        {/* GRID MASONRY */}
        {habits.length > 0 ? (
          <View style={styles.masonryContainer}>
            <View style={styles.column}>
              {leftColumn.map(group => renderCategoryCard(group))}
            </View>
            <View style={styles.column}>
              {rightColumn.map(group => renderCategoryCard(group))}
            </View>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={{ color: colors.textSecondary }}>No hay hábitos aún.</Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreateHabit')}
      >
        <LinearGradient colors={['#FF00CC', '#FF9933']} style={styles.fabGradient}>
          <Ionicons name="add" size={30} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>

      {/* COMPONENTE DE CONFETTI SUPERPUESTO */}
      <ConfettiOverlay
        isVisible={showConfetti}
        onAnimationFinish={() => setShowConfetti(false)}
      />
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
  masonryContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  column: { width: '48%' },
  categoryCard: { borderRadius: 20, padding: 15, marginBottom: 15, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 3 },
  categoryHeader: { marginBottom: 12 },
  categoryTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  categoryCount: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  habitsList: { gap: 8 },
  moreText: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontStyle: 'italic', marginTop: 5 },
  miniHabitRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: 8 },
  miniHabitIcon: { marginRight: 8 },
  miniHabitName: { color: '#fff', fontWeight: 'bold', fontSize: 12, flex: 1, marginRight: 5 },
  radioUnchecked: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.6)' },
  emptyState: { alignItems: 'center', marginTop: 50 },
  fab: { position: 'absolute', right: 20, bottom: 20, borderRadius: 30, elevation: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4 },
  fabGradient: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center' }
});