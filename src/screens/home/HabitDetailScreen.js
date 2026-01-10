import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { auth } from '../../../firebaseConfig';
import { useTheme } from '../../context/ThemeContext';
import HabitService from '../../services/habitService';

const SCREEN_WIDTH = Dimensions.get('window').width;
const DAYS_OF_WEEK = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export default function HabitDetailScreen({ route, navigation }) {
  const { habit } = route.params; // Hábito inicial pasado por navegación
  const { theme, isDark } = useTheme();
  const { colors } = theme;
  const user = auth.currentUser;

  // Estados
  const [habitData, setHabitData] = useState(habit); // Estado local por si actualizamos
  const [history, setHistory] = useState([]); // Array de fechas ["2023-10-01", ...]
  const [loading, setLoading] = useState(true);

  // Estado del Calendario
  const [currentDate, setCurrentDate] = useState(new Date()); // Para navegar entre meses

  // --- CARGA DE DATOS ---
  useFocusEffect(
    useCallback(() => {
      const loadHistory = async () => {
        try {
          // 1. Obtener historial de fechas completadas
          const dates = await HabitService.getHabitHistory(habitData.id);
          setHistory(dates);

          // 2. Refrescar datos del hábito (por si cambiaron rachas en segundo plano)
          const updatedHabits = await HabitService.getUserHabits(user.uid);
          const current = updatedHabits.find(h => h.id === habitData.id);
          if (current) setHabitData(current);

        } catch (error) {
          console.error("Error cargando historial:", error);
        } finally {
          setLoading(false);
        }
      };
      loadHistory();
    }, [habitData.id])
  );

  // --- LÓGICA DEL CALENDARIO ---
  const changeMonth = (increment) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + increment);
    setCurrentDate(newDate);
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    return days;
  };

  const getFirstDayOfMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month, 1).getDay(); // 0 = Domingo, 1 = Lunes...
  };

  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);

    // Nombres de meses en español
    const monthNames = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];

    const days = [];

    // Celdas vacías antes del primer día
    for (let i = 0; i < firstDay; i++) {
      days.push(<View key={`empty-${i}`} style={styles.calendarDay} />);
    }

    // Celdas con días
    for (let day = 1; day <= daysInMonth; day++) {
      // Formato YYYY-MM-DD para comparar con el historial
      const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isCompleted = history.includes(dateString);

      // Verificar si es hoy
      const today = new Date();
      const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

      days.push(
        <View key={day} style={styles.calendarDay}>
          <View style={[
            styles.dayCircle,
            isCompleted && { backgroundColor: habitData.categoryColor || colors.primary },
            !isCompleted && isToday && { borderWidth: 2, borderColor: colors.primary }, // Hoy pero no hecho
            !isCompleted && !isToday && { backgroundColor: isDark ? '#333' : '#F0F0F0' } // Día normal vacío
          ]}>
            <Text style={[
              styles.dayText,
              isCompleted ? { color: '#fff', fontWeight: 'bold' } : { color: colors.textSecondary }
            ]}>
              {day}
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.calendarContainer, { backgroundColor: colors.card }]}>
        {/* Cabecera Calendario */}
        <View style={styles.calendarHeader}>
          <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.arrowBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.monthTitle, { color: colors.text }]}>
            {monthNames[month]} {year}
          </Text>
          <TouchableOpacity onPress={() => changeMonth(1)} style={styles.arrowBtn}>
            <Ionicons name="chevron-forward" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Días de la semana */}
        <View style={styles.weekDaysRow}>
          {DAYS_OF_WEEK.map((d, i) => (
            <Text key={i} style={styles.weekDayText}>{d}</Text>
          ))}
        </View>

        {/* Grid de días */}
        <View style={styles.daysGrid}>
          {days}
        </View>
      </View>
    );
  };

  // --- ACCIONES ---
  const handleDelete = () => {
    Alert.alert(
      "Eliminar Hábito",
      "¿Estás seguro? Se borrará todo el historial y las estadísticas asociadas.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await HabitService.deleteHabit(habitData.id, user.uid);
              navigation.goBack();
            } catch (error) {
              Alert.alert("Error", "No se pudo eliminar.");
            }
          }
        }
      ]
    );
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>

      {/* HEADER VISUAL CON GRADIENTE */}
      <View style={styles.headerContainer}>
        <LinearGradient
          colors={[habitData.categoryColor || colors.primary, isDark ? '#1a1a1a' : '#ffffff']}
          style={styles.headerGradient}
        >
          <View style={styles.navBar}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate('CreateHabit', { habitToEdit: habitData })}
              style={styles.editBtn}
            >
              <Ionicons name="pencil" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.iconContainer}>
            <Text style={{ fontSize: 50 }}>{habitData.icon}</Text>
          </View>
          <Text style={styles.habitName}>{habitData.name}</Text>
          <Text style={styles.categoryLabel}>{habitData.categoryLabel || 'General'}</Text>
        </LinearGradient>
      </View>

      <View style={styles.contentContainer}>

        {/* TARJETAS DE ESTADÍSTICAS */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.card }]}>
            <Ionicons name="flame" size={24} color="#FF9500" />
            <Text style={[styles.statNumber, { color: colors.text }]}>{habitData.currentStreak || 0}</Text>
            <Text style={styles.statLabel}>Racha Actual</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card }]}>
            <Ionicons name="trophy" size={24} color="#FFD700" />
            <Text style={[styles.statNumber, { color: colors.text }]}>{habitData.bestStreak || 0}</Text>
            <Text style={styles.statLabel}>Mejor Racha</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card }]}>
            <Ionicons name="calendar" size={24} color="#4CD964" />
            <Text style={[styles.statNumber, { color: colors.text }]}>{history.length}</Text>
            <Text style={styles.statLabel}>Total Días</Text>
          </View>
        </View>

        {/* CALENDARIO HEATMAP */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>HISTORIAL DE PROGRESO</Text>
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
        ) : (
          renderCalendar()
        )}

        {/* BOTÓN BORRAR */}
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteText}>Eliminar Hábito</Text>
          <Ionicons name="trash-outline" size={20} color="#FF3B30" />
        </TouchableOpacity>

        <View style={{ height: 50 }} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerContainer: { height: 250, width: '100%' },
  headerGradient: { flex: 1, paddingTop: 50, paddingHorizontal: 20, alignItems: 'center' },
  navBar: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', position: 'absolute', top: 50, left: 20, right: 20, zIndex: 10 },
  backBtn: { padding: 10, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 20 },
  editBtn: { padding: 10, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 20 },

  iconContainer: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 15, marginTop: 20 },
  habitName: { fontSize: 28, fontWeight: '800', color: '#fff', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
  categoryLabel: { fontSize: 14, color: 'rgba(255,255,255,0.9)', marginTop: 5, backgroundColor: 'rgba(0,0,0,0.2)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, overflow: 'hidden' },

  contentContainer: { flex: 1, paddingHorizontal: 20, marginTop: -30 },

  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
  statCard: { width: '31%', padding: 15, borderRadius: 20, alignItems: 'center', shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5 },
  statNumber: { fontSize: 22, fontWeight: 'bold', marginVertical: 5 },
  statLabel: { fontSize: 10, color: '#888', textTransform: 'uppercase', fontWeight: '600' },

  sectionTitle: { fontSize: 13, fontWeight: '700', marginBottom: 15, letterSpacing: 1 },

  // Estilos del Calendario
  calendarContainer: { borderRadius: 24, padding: 15, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3, marginBottom: 25 },
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  monthTitle: { fontSize: 18, fontWeight: 'bold' },
  arrowBtn: { padding: 5 },
  weekDaysRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 10 },
  weekDayText: { color: '#888', fontSize: 12, width: (SCREEN_WIDTH - 70) / 7, textAlign: 'center' },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarDay: { width: (SCREEN_WIDTH - 70) / 7, height: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 5 },
  dayCircle: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  dayText: { fontSize: 12 },

  deleteButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 15, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255, 59, 48, 0.3)', backgroundColor: 'rgba(255, 59, 48, 0.05)' },
  deleteText: { color: '#FF3B30', fontWeight: 'bold', marginRight: 8 }
});