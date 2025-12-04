import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { BarChart } from "react-native-chart-kit";
import { useTheme } from '../../context/ThemeContext';
import HabitService from '../../services/habitService';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function HabitDetailScreen({ route, navigation }) {
  const { habit } = route.params;
  const { theme } = useTheme();
  const { colors } = theme;

  const [markedDates, setMarkedDates] = useState({});
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState({
    labels: ["L", "M", "X", "J", "V", "S", "D"],
    datasets: [{ data: [0, 0, 0, 0, 0, 0, 0] }]
  });

  // --- CARGA DE DATOS ---
  useEffect(() => {
    const loadData = async () => {
      try {
        const dates = await HabitService.getHabitHistory(habit.id);
        setTotalCount(dates.length);

        // 1. Preparar Calendario
        const marks = {};
        dates.forEach(date => {
          marks[date] = {
            selected: true,
            selectedColor: colors.success,
            disableTouchEvent: true
          };
        });
        setMarkedDates(marks);

        // 2. Preparar Gráfico Semanal
        processWeeklyData(dates);

      } catch (error) {
        console.error("Error cargando historial:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const processWeeklyData = (dates) => {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    dates.forEach(dateStr => {
      const dayIndex = new Date(dateStr + 'T12:00:00').getDay();
      counts[dayIndex]++;
    });
    // Ajustar Lunes a Domingo
    const sunday = counts.shift();
    counts.push(sunday);

    setChartData({
      labels: ["L", "M", "X", "J", "V", "S", "D"],
      datasets: [{ data: counts }]
    });
  };

  // Color del tema (o gris por defecto)
  const accentColor = habit.categoryColor || colors.primary;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* --- CABECERA COMPACTA (DENTRO DEL SCROLL) --- */}
        <View style={[styles.headerCard, { backgroundColor: colors.card }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {/* Icono */}
            <View style={[styles.iconBox, { backgroundColor: accentColor + '20' }]}>
              <Text style={{ fontSize: 32 }}>{habit.icon}</Text>
            </View>

            {/* Textos */}
            <View style={{ flex: 1, marginLeft: 15 }}>
              <Text style={[styles.title, { color: colors.text }]}>{habit.name}</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                {habit.categoryLabel || 'General'}
              </Text>
            </View>
          </View>

          {/* Badges (Racha y Total) */}
          <View style={styles.statsRow}>
            <View style={[styles.statBadge, { backgroundColor: colors.background }]}>
              <Ionicons name="flame" size={16} color="#FF9500" style={{ marginRight: 5 }} />
              <Text style={[styles.statText, { color: colors.text }]}>
                <Text style={{ fontWeight: 'bold' }}>{habit.currentStreak}</Text> días racha
              </Text>
            </View>
            <View style={[styles.statBadge, { backgroundColor: colors.background }]}>
              <Ionicons name="checkmark-circle" size={16} color="#34C759" style={{ marginRight: 5 }} />
              <Text style={[styles.statText, { color: colors.text }]}>
                <Text style={{ fontWeight: 'bold' }}>{totalCount}</Text> veces total
              </Text>
            </View>
          </View>
        </View>

        {/* --- GRÁFICO SEMANAL --- */}
        <View style={[styles.sectionContainer, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Rendimiento Semanal</Text>
          {loading ? <ActivityIndicator color={accentColor} /> : (
            <BarChart
              data={chartData}
              width={SCREEN_WIDTH - 60}
              height={220}
              yAxisLabel=""
              yAxisSuffix=""
              fromZero={true}
              chartConfig={{
                backgroundColor: colors.card,
                backgroundGradientFrom: colors.card,
                backgroundGradientTo: colors.card,
                decimalPlaces: 0,
                color: (opacity = 1) => accentColor,
                labelColor: (opacity = 1) => colors.textSecondary,
                barPercentage: 0.5,
              }}
              style={{ marginVertical: 8, borderRadius: 16, paddingRight: 0 }}
              showValuesOnTopOfBars
            />
          )}
        </View>

        {/* --- CALENDARIO --- */}
        <View style={[styles.sectionContainer, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Historial Completo</Text>
          <Calendar
            markedDates={markedDates}
            theme={{
              backgroundColor: colors.card,
              calendarBackground: colors.card,
              textSectionTitleColor: colors.textSecondary,
              selectedDayBackgroundColor: accentColor, // Usamos el color de la categoría
              selectedDayTextColor: '#ffffff',
              todayTextColor: accentColor,
              dayTextColor: colors.text,
              textDisabledColor: '#444',
              arrowColor: accentColor,
              monthTextColor: colors.text,
              textMonthFontWeight: 'bold',
            }}
          />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: 20 },

  // Botón Volver Flotante (Simple y limpio)
  floatingBackBtn: {
    position: 'absolute', top: 50, left: 20, zIndex: 10,
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 5
  },

  // Cabecera Compacta
  headerCard: {
    borderRadius: 20, padding: 20, marginBottom: 20,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3
  },
  iconBox: {
    width: 60, height: 60, borderRadius: 30,
    justifyContent: 'center', alignItems: 'center'
  },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 2 },

  statsRow: { flexDirection: 'row', marginTop: 20, gap: 10 },
  statBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
    flex: 1, justifyContent: 'center'
  },
  statText: { fontSize: 12 },

  // Secciones
  sectionContainer: {
    borderRadius: 20, padding: 20, marginBottom: 20,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3
  },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 15 }
});