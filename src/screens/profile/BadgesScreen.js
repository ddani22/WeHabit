import { Ionicons } from '@expo/vector-icons';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

export default function BadgesScreen({ route }) {
    const { theme, isDark } = useTheme();
    const { colors } = theme;

    // Recibimos las medallas calculadas desde la pantalla anterior
    const { badges } = route.params;

    const renderBadgeRow = ({ item }) => (
        <View style={[
            styles.row,
            { backgroundColor: colors.card, borderBottomColor: colors.border },
            !item.unlocked && { opacity: 0.6 } // Un poco transparente si está bloqueado
        ]}>
            {/* 1. ICONO (Izquierda) */}
            <View style={[
                styles.iconContainer,
                { backgroundColor: item.unlocked ? item.color + '20' : (isDark ? '#333' : '#F0F0F0') }
            ]}>
                <Ionicons
                    name={item.icon}
                    size={24}
                    color={item.unlocked ? item.color : colors.textSecondary}
                />
            </View>

            {/* 2. TEXTO (Centro) */}
            <View style={styles.textContainer}>
                <Text style={[styles.title, { color: colors.text }]}>
                    {item.name}
                </Text>
                <Text style={[styles.description, { color: colors.textSecondary }]}>
                    {item.description}
                </Text>
            </View>

            {/* 3. CHECK (Derecha - Solo si desbloqueado) */}
            <View style={styles.statusContainer}>
                {item.unlocked ? (
                    <Ionicons name="checkmark-circle" size={28} color="#34C759" />
                ) : (
                    <Ionicons name="lock-closed" size={20} color={colors.textSecondary} />
                )}
            </View>
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <FlatList
                data={badges}
                keyExtractor={item => item.id}
                renderItem={renderBadgeRow}
                contentContainerStyle={{ padding: 20 }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        marginBottom: 12,
        borderRadius: 16,
        // Sombra suave
        shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05, shadowRadius: 4, elevation: 2
    },
    iconContainer: {
        width: 50, height: 50, borderRadius: 25,
        justifyContent: 'center', alignItems: 'center',
        marginRight: 15
    },
    textContainer: { flex: 1 },
    title: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
    description: { fontSize: 12, lineHeight: 16 },
    statusContainer: { marginLeft: 10, justifyContent: 'center' }
});