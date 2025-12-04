import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { BarChart, ProgressChart } from "react-native-chart-kit";
import { auth } from '../../../firebaseConfig';
import { useTheme } from '../../context/ThemeContext';

import ChallengeService from '../../services/challengeService';
import FeedbackService from '../../services/feedbackService';
import HabitService from '../../services/habitService';

export default function HabitDetailScreen({ route, navigation }) {
  const { habit } = route.params;
  const { theme } = useTheme();
  const { colors } = theme;
  const user = auth.currentUser;
  const screenWidth = Dimensions.get("window").width;

  // --- ESTADOS DE DATOS ---
  const [markedDates, setMarkedDates] = useState({});
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentStreak, setCurrentStreak] = useState(habit.currentStreak);

  // --- ESTADOS DEL TEMPORIZADOR ---
  const [timerDuration, setTimerDuration] = useState(10 * 60);
  const [timeLeft, setTimeLeft] = useState(10 * 60);
  const [isActive, setIsActive] = useState(false);
  const [hasStarted, setHasStarted] = useState(false); // Para saber si se ha usado

  // --- 1. PROTECCIÓN DE SALIDA (GESTIÓN DEL BOTÓN ATRÁS) ---
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      // Si no ha empezado o ya terminó (0), dejamos salir
      if (!hasStarted || timeLeft === 0 || timeLeft === timerDuration) {
        return;
      }

      // Si está en medio de una sesión (Activo o Pausado), preguntamos
      e.preventDefault();

      Alert.alert(
        '¿Detener sesión?',
        'Si sales ahora, el temporizador se reiniciará.',
        [
          { text: 'Quedarme', style: 'cancel', onPress: () => { } },
          {
            text: 'Salir',
            style: 'destructive',
            onPress: () => navigation.dispatch(e.data.action), // Forzamos la salida
          },
        ]
      );
    });

    return unsubscribe;
  }, [navigation, hasStarted, timeLeft, timerDuration]);

  // --- 2. CARGA DE DATOS ---
  useEffect(() => {
    const loadHistory = async () => {
      const dates = await HabitService.getHabitHistory(habit.id);
      setTotalCount(dates.length);

      const marks = {};
      dates.forEach(date => {
        marks[date] = {
          selected: true,
          selectedColor: colors.success,
          disableTouchEvent: true
        };
      });
      setMarkedDates(marks);
      setLoading(false);
    };
    loadHistory();
  }, []);

  // --- 3. LÓGICA DEL TEMPORIZADOR (OPTIMIZADA) ---
  useEffect(() => {
    let interval = null;
    if (isActive && timeLeft > 0) {
      setHasStarted(true); // Marcamos que ha empezado
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive]);

  // Efecto separado para detectar el fin
  useEffect(() => {
    if (timeLeft === 0 && hasStarted) {
      setIsActive(false);
      setHasStarted(false); // Reseteamos estado
      handleCompleteTimer();
    }
  }, [timeLeft]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const toggleTimer = () => {
    FeedbackService.triggerImpactLight();
    setIsActive(!isActive);
    setHasStarted(true);
  };

  const resetTimer = () => {
    setIsActive(false);
    setHasStarted(false);
    setTimeLeft(timerDuration);
  };

  const setCustomDuration = (minutes) => {
    setIsActive(false);
    setHasStarted(false);
    setTimerDuration(minutes * 60);
    setTimeLeft(minutes * 60);
  };

  const handleCompleteTimer = async () => {
    FeedbackService.triggerSuccess();
    Alert.alert("¡Tiempo Completado! 🎉", "Hábito marcado automáticamente.");

    setCurrentStreak(prev => prev + 1);
    const today = new Date().toISOString().split('T')[0];
    setMarkedDates(prev => ({
      ...prev,
      [today]: { selected: true, selectedColor: colors.success }
    }));
    setTotalCount(prev => prev + 1);

    try {
      await HabitService.checkInHabit(habit.id, user.uid);
      const challengeIds = await ChallengeService.findActiveChallengesByHabit(user.uid, habit.name);
      if (challengeIds.length > 0) {
        for (const challengeId of challengeIds) await ChallengeService.incrementScore(challengeId, user.uid);
      }
    } catch (error) {
      console.error("Error check-in auto", error);
    }
  };

  // --- DATOS GRÁFICOS ---
  const processWeeklyData = (dates) => {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    dates.forEach(dateStr => {
      const dayIndex = new Date(dateStr + 'T12:00:00').getDay();
      counts[dayIndex]++;
    });
    const sunday = counts.shift();
    counts.push(sunday);
    return {
      labels: ["L", "M", "X", "J", "V", "S", "D"],
      datasets: [{ data: counts }]
    };
  };

  const calculateSuccessRate = () => {
    if (!habit.createdAt) return 0;
    const created = new Date(habit.createdAt);
    const now = new Date();
    const diffTime = Math.abs(now - created);
    const daysSinceCreation = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
    const rate = totalCount / daysSinceCreation;
    return rate > 1 ? 1 : rate;
  };

  const weeklyData = processWeeklyData(Object.keys(markedDates));
  const successRate = calculateSuccessRate();
  const ringData = { labels: ["Éxito"], data: [successRate] };

  // Color de cabecera (fallback a primary si no hay)
  const headerColor = habit.categoryColor || colors.primary;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>

      {/* --- NUEVA CABECERA PERSONALIZADA CON BOTÓN ATRÁS --- */}
      <View style={[styles.customHeader, { backgroundColor: headerColor }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{habit.name}</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Icono Grande */}
        <View style={styles.headerIconContainer}>
          <Text style={{ fontSize: 50 }}>{habit.icon}</Text>
        </View>

        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>🔥 {currentStreak} días</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>✅ {totalCount} veces</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* TIMER */}
        <View style={[styles.timerCard, { backgroundColor: colors.card }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
            <Ionicons name="timer-outline" size={24} color={colors.primary} style={{ marginRight: 8 }} />
            <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>Modo Enfoque</Text>
          </View>

          <View style={styles.clockContainer}>
            <Text style={[styles.timerText, { color: isActive ? colors.primary : colors.text }]}>
              {formatTime(timeLeft)}
            </Text>
          </View>

          <View style={styles.controlsRow}>
            <TouchableOpacity
              style={[styles.controlBtn, { backgroundColor: isActive ? '#FF3B30' : '#34C759' }]}
              onPress={toggleTimer}
            >
              <Ionicons name={isActive ? "pause" : "play"} size={24} color="#fff" />
              <Text style={styles.controlText}>{isActive ? "PAUSAR" : "INICIAR"}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.resetBtn, { borderColor: colors.border }]} onPress={resetTimer}>
              <Ionicons name="refresh" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.presetsRow}>
            {[5, 10, 20, 30].map(min => (
              <TouchableOpacity
                key={min}
                style={[
                  styles.presetBtn,
                  { backgroundColor: timeLeft === min * 60 ? colors.primary : colors.background }
                ]}
                onPress={() => setCustomDuration(min)}
              >
                <Text style={{
                  color: timeLeft === min * 60 ? '#fff' : colors.text,
                  fontWeight: 'bold'
                }}>{min}m</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* GRÁFICOS */}
        <View style={[styles.chartContainer, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Rendimiento Semanal</Text>
          {!loading && (
            <BarChart
              data={weeklyData}
              width={screenWidth - 60}
              height={220}
              yAxisLabel=""
              yAxisSuffix=""
              fromZero={true}
              chartConfig={{
                backgroundColor: colors.card,
                backgroundGradientFrom: colors.card,
                backgroundGradientTo: colors.card,
                decimalPlaces: 0,
                color: (opacity = 1) => colors.primary,
                labelColor: (opacity = 1) => colors.textSecondary,
                barPercentage: 0.7,
              }}
              style={{ marginVertical: 8, borderRadius: 16 }}
              showValuesOnTopOfBars
            />
          )}
        </View>

        <View style={[styles.chartContainer, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Consistencia Global</Text>
          {!loading && (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              <ProgressChart
                data={ringData}
                width={screenWidth - 60}
                height={160}
                strokeWidth={16}
                radius={60}
                chartConfig={{
                  backgroundGradientFrom: colors.card,
                  backgroundGradientTo: colors.card,
                  color: (opacity = 1) => colors.success,
                  labelColor: (opacity = 1) => colors.text,
                }}
                hideLegend={true}
              />
              <View style={{ position: 'absolute', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.text }}>
                  {Math.round(successRate * 100)}%
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* CALENDARIO */}
        <View style={[styles.calendarContainer, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Historial Completo</Text>
          <Calendar
            markedDates={markedDates}
            theme={{
              backgroundColor: colors.card,
              calendarBackground: colors.card,
              textSectionTitleColor: colors.textSecondary,
              selectedDayBackgroundColor: colors.success,
              selectedDayTextColor: '#ffffff',
              todayTextColor: colors.primary,
              dayTextColor: colors.text,
              textDisabledColor: '#444',
              arrowColor: colors.primary,
              monthTextColor: colors.text,
            }}
          />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // HEADER NUEVO
  customHeader: { padding: 20, paddingBottom: 30, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, marginBottom: 10, alignItems: 'center' },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 30, alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.2)', justifyContent: 'center', alignItems: 'center' },

  headerIconContainer: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginVertical: 15 },
  badgeRow: { flexDirection: 'row', gap: 10 },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.2)' },
  badgeText: { fontWeight: '600', fontSize: 13, color: '#fff' },

  scrollContent: { padding: 20 },

  // Timer
  timerCard: { padding: 20, borderRadius: 24, marginBottom: 20, alignItems: 'center' },
  clockContainer: { width: 200, height: 200, borderRadius: 100, borderWidth: 8, borderColor: 'rgba(0,0,0,0.05)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  timerText: { fontSize: 48, fontWeight: '900', fontVariant: ['tabular-nums'] },
  controlsRow: { flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 20 },
  controlBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 30, gap: 10 },
  controlText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  resetBtn: { padding: 12, borderRadius: 30, borderWidth: 1 },
  presetsRow: { flexDirection: 'row', gap: 10 },
  presetBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 12 },

  // Sections
  chartContainer: { padding: 20, borderRadius: 24, marginBottom: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
  calendarContainer: { padding: 20, borderRadius: 24, marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 }
});