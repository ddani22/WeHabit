import { Ionicons } from '@expo/vector-icons';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { LEVELS } from '../../services/xpService'; // Importamos la lista

export default function LevelsScreen({ route }) {
    const { theme, isDark } = useTheme();
    const { colors } = theme;

    // Recibimos los XP actuales del usuario para saber dónde está
    const { currentXP } = route.params;

    const renderLevelItem = ({ item }) => {
        const isUnlocked = currentXP >= item.xp;
        // Es el nivel actual si está desbloqueado PERO no tienes suficiente XP para el siguiente (si existe)
        // Buscamos el siguiente nivel en la lista
        const nextLevelIndex = LEVELS.findIndex(l => l.level === item.level) + 1;
        const nextLevelXP = LEVELS[nextLevelIndex]?.xp || Infinity;
        const isCurrent = isUnlocked && currentXP < nextLevelXP;

        return (
            <View style={[
                styles.row,
                { backgroundColor: colors.card, borderBottomColor: colors.border },
                !isUnlocked && { opacity: 0.5 }, // Niveles futuros más apagados
                isCurrent && { borderColor: item.color, borderWidth: 2 } // Nivel actual destacado
            ]}>

                {/* 1. Icono de Nivel (Círculo con número) */}
                <View style={[
                    styles.levelBadge,
                    { backgroundColor: isUnlocked ? item.color : (isDark ? '#333' : '#eee') }
                ]}>
                    <Text style={[styles.levelNumber, { color: '#fff' }]}>{item.level}</Text>
                </View>

                {/* 2. Info */}
                <View style={styles.infoContainer}>
                    <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                        Requerido: {item.xp} XP
                    </Text>
                </View>

                {/* 3. Estado (Check, Candado o "Tú") */}
                <View style={styles.statusContainer}>
                    {isCurrent ? (
                        <View style={styles.currentBadge}>
                            <Text style={styles.currentText}>ESTÁS AQUÍ</Text>
                        </View>
                    ) : isUnlocked ? (
                        <Ionicons name="checkmark-circle" size={24} color="#4CD964" />
                    ) : (
                        <Ionicons name="lock-closed" size={20} color={colors.textSecondary} />
                    )}
                </View>
            </View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Cabecera resumen */}
            <View style={[styles.header, { backgroundColor: colors.card }]}>
                <Text style={[styles.xpText, { color: colors.primary }]}>Tu Experiencia Total</Text>
                <Text style={[styles.xpValue, { color: colors.text }]}>{currentXP} XP</Text>
            </View>

            <FlatList
                data={LEVELS}
                keyExtractor={item => item.level.toString()}
                renderItem={renderLevelItem}
                contentContainerStyle={{ padding: 20 }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { padding: 20, alignItems: 'center', marginBottom: 10 },
    xpText: { fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase' },
    xpValue: { fontSize: 32, fontWeight: '900' },

    row: {
        flexDirection: 'row', alignItems: 'center', padding: 15, marginBottom: 10,
        borderRadius: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05, shadowRadius: 4, elevation: 2
    },
    levelBadge: {
        width: 44, height: 44, borderRadius: 22,
        justifyContent: 'center', alignItems: 'center', marginRight: 15
    },
    levelNumber: { fontSize: 18, fontWeight: 'bold' },
    infoContainer: { flex: 1 },
    title: { fontSize: 16, fontWeight: 'bold', marginBottom: 2 },
    subtitle: { fontSize: 12 },

    statusContainer: { alignItems: 'flex-end' },
    currentBadge: {
        backgroundColor: '#FFD700', paddingHorizontal: 8, paddingVertical: 4,
        borderRadius: 8
    },
    currentText: { fontSize: 10, fontWeight: 'bold', color: '#000' }
});