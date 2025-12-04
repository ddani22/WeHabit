import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth } from '../../../firebaseConfig';
import { useTheme } from '../../context/ThemeContext';
import ChallengeService from '../../services/challengeService';
import FeedbackService from '../../services/feedbackService';
import HabitService from '../../services/habitService';

export default function CategoryDetailScreen({ route, navigation }) {
    const { category, habits: initialHabits } = route.params;

    // --- CORRECCIÓN AQUÍ ---
    const { theme, isDark } = useTheme();
    const { colors } = theme; // Sacamos colors de theme
    // -----------------------

    const user = auth.currentUser;

    const [habits, setHabits] = useState(initialHabits);
    const [completedIds, setCompletedIds] = useState([]);

    useEffect(() => {
        const loadStatus = async () => {
            const todayLogs = await HabitService.getTodayLogs(user.uid);
            setCompletedIds(todayLogs);

            const allHabits = await HabitService.getUserHabits(user.uid);
            // Filtramos asegurándonos de manejar nulos
            const categoryHabits = allHabits.filter(h =>
                (h.categoryId || 'other') === category.meta.id
            );
            setHabits(categoryHabits);
        };
        loadStatus();
    }, []);

    const handleCheckIn = async (habitItem) => {
        const habitId = habitItem.id;
        const isCompleted = completedIds.includes(habitId);

        if (isCompleted) FeedbackService.triggerImpactLight();
        else FeedbackService.triggerSuccess();

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
        } catch (error) { Alert.alert("Error", "No se pudo guardar"); }
    };

    const renderItem = ({ item }) => {
        const isCompleted = completedIds.includes(item.id);
        return (
            <TouchableOpacity
                style={[styles.card, { backgroundColor: colors.card }]}
                onPress={() => navigation.navigate('HabitDetail', { habit: item })}
            >
                <View style={[styles.iconContainer, { backgroundColor: category.meta.color + '20' }]}>
                    <Text style={{ fontSize: 24 }}>{item.icon}</Text>
                </View>
                <View style={{ flex: 1, paddingHorizontal: 15 }}>
                    <Text style={[styles.habitName, { color: colors.text }]}>{item.name}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>🔥 {item.currentStreak} días racha</Text>
                </View>
                <TouchableOpacity onPress={() => handleCheckIn(item)}>
                    <Ionicons
                        name={isCompleted ? "checkmark-circle" : "ellipse-outline"}
                        size={32}
                        color={isCompleted ? "#34C759" : colors.textSecondary}
                    />
                </TouchableOpacity>
            </TouchableOpacity>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { backgroundColor: category.meta.color }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 40 }}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{category.meta.label}</Text>
                    <View style={{ width: 40 }} />
                </View>
                <Text style={styles.headerSubtitle}>{habits.length} hábitos activos</Text>
            </View>

            <FlatList
                data={habits}
                keyExtractor={item => item.id}
                renderItem={renderItem}
                contentContainerStyle={{ padding: 20 }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { padding: 20, paddingBottom: 30, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, marginBottom: 10 },
    headerTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
    headerSubtitle: { color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginTop: 5 },
    backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.2)', justifyContent: 'center', alignItems: 'center' },
    card: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 20, marginBottom: 15, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    iconContainer: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
    habitName: { fontSize: 16, fontWeight: 'bold' }
});